import type { Model } from '../model/Model'
import type { FieldMeta } from '../core/metadata'
import { MetadataStorage } from '../core/metadata'

export type RelationTarget = Model | { id?: unknown } | number | string
export type RelationTargetInput = RelationTarget | RelationTarget[]

export type RelationBuilderType = 'belongsTo' | 'belongsToMany' | 'hasOne' | 'hasMany'

export interface PendingRelationOperation {
    operation: 'attach' | 'detach' | 'sync' | 'toggle' | 'create' | 'update'
    key?: unknown | unknown[]
    model?: Model | Model[]
    options?: Record<string, unknown>
}

export abstract class RelationBuilderBase {
    declare save: never
    declare update: never
    declare ['delete']: never

    protected readonly many: boolean
    protected relationName: string
    protected targetFn: () => typeof Model
    protected type: RelationBuilderType
    protected required: boolean
    protected pivot: Record<string, FieldMeta>
    protected loaded: unknown
    protected owner?: Model
    protected pendingOperations: PendingRelationOperation[] = []

    constructor(
        targetFn: () => typeof Model,
        relationName: string,
        options: {
            many: boolean
            type: RelationBuilderType
            required?: boolean
            pivot?: Record<string, FieldMeta>
        },
    ) {
        this.targetFn = targetFn
        this.relationName = relationName
        this.many = options.many
        this.type = options.type
        this.required = options.required ?? false
        this.pivot = options.pivot ?? {}

        return this.createProxy()
    }

    protected abstract createProxy(): this

    abstract clear(): this

    protected abstract applyPendingOperationInternal(operation: PendingRelationOperation): void

    bindProperty(propertyName: string): this {
        if (!this.relationName) {
            this.relationName = propertyName
        }
        return this
    }

    bindOwner(owner: Model): this {
        this.owner = owner
        return this
    }

    getOwner(): Model | undefined {
        return this.owner
    }

    registerMetadata(modelClass: typeof Model, propertyName: string): this {
        this.bindProperty(propertyName)
        const meta = MetadataStorage.getResource(modelClass)
        const relationAlreadyRegistered = meta.relations.some(r => r.property === this.relationName)
        if (!relationAlreadyRegistered) {
            meta.relations.push({
                property: this.relationName,
                target: this.targetFn,
                many: this.many,
                type: this.type,
                required: this.required,
                pivot: this.pivot,
            })
        }
        return this
    }

    getLoaded<T = unknown>(): T | undefined {
        return this.loaded as T | undefined
    }

    setLoaded(value: unknown): this {
        this.unregisterLoadedParents(this.loaded)
        this.loaded = value
        this.registerLoadedParents(value)
        return this
    }

    getPendingOperations(): PendingRelationOperation[] {
        return [...this.pendingOperations]
    }

    hasPendingOperations(): boolean {
        return this.pendingOperations.length > 0
    }

    clearPendingOperations(): this {
        this.pendingOperations = []
        return this
    }

    applyPendingOperations(): this {
        for (const operation of this.pendingOperations) {
            this.applyPendingOperationInternal(operation)
        }
        this.pendingOperations = []
        return this
    }

    protected toItems(input: RelationTargetInput): RelationTarget[] {
        return Array.isArray(input) ? input : [input]
    }

    protected resolveKey(target: RelationTarget): unknown {
        if (target instanceof Object && 'getKey' in target && typeof (target as Record<string, unknown>).getKey === 'function') {
            return (target as { getKey(): unknown }).getKey()
        }
        if (target && typeof target === 'object' && 'id' in target) {
            return (target as { id?: unknown }).id
        }
        return target
    }

    protected normalizeOptions(options?: Record<string, unknown>): Record<string, unknown> | undefined {
        if (!options) return undefined
        return Object.fromEntries(
            Object.entries(options).map(([key, value]) => [
                key.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase(),
                value,
            ]),
        )
    }

    protected queue(operation: PendingRelationOperation): this {
        this.pendingOperations.push(operation)
        return this
    }

    private registerLoadedParents(value: unknown): void {
        if (!this.owner) return
        const register = (item: unknown) => {
            if (item && typeof item === 'object' && 'registerParentRelation' in item && typeof (item as Record<string, unknown>).registerParentRelation === 'function') {
                (item as { registerParentRelation(owner: Model, relation: string): void }).registerParentRelation(this.owner!, this.relationName)
            }
        }
        if (Array.isArray(value)) {
            value.forEach(register)
            return
        }
        register(value)
    }

    private unregisterLoadedParents(value: unknown): void {
        if (!this.owner) return
        const unregister = (item: unknown) => {
            if (item && typeof item === 'object' && 'unregisterParentRelation' in item && typeof (item as Record<string, unknown>).unregisterParentRelation === 'function') {
                (item as { unregisterParentRelation(owner: Model, relation: string): void }).unregisterParentRelation(this.owner!, this.relationName)
            }
        }
        if (Array.isArray(value)) {
            value.forEach(unregister)
            return
        }
        unregister(value)
    }

    attach(
        model: RelationTargetInput,
        callbackOrOptions?: ((q: Model) => void) | Record<string, unknown>,
        maybeOptions?: Record<string, unknown>,
    ): this {
        const items = this.toItems(model)
        const callback = typeof callbackOrOptions === 'function' ? callbackOrOptions : undefined
        const options = this.normalizeOptions(typeof callbackOrOptions === 'function' ? maybeOptions : callbackOrOptions)

        items.forEach((item) => {
            if (item && typeof item === 'object' && 'constructor' in item) {
                const relationModel = item as Model
                if (relationModel._isDeleted) {
                    throw new Error(`Relation ${this.relationName} cannot attach a deleted model.`)
                }
                callback?.(relationModel)
                this.queue({
                    operation: relationModel._isNew ? 'create' : (Object.keys(relationModel._changes).length > 0 ? 'update' : 'attach'),
                    model: relationModel,
                    options,
                })
                return
            }
            this.queue({ operation: 'attach', key: this.resolveKey(item), options })
        })

        return this
    }

    detach(model: RelationTargetInput): this {
        const items = this.toItems(model)
        items.forEach((item) => {
            if (item && typeof item === 'object' && 'constructor' in item) {
                const relationModel = item as Model
                if (relationModel._isNew) {
                    throw new Error(`Relation ${this.relationName} cannot detach a model that has not been persisted yet.`)
                }
                this.queue({ operation: 'detach', model: relationModel })
                return
            }
            this.queue({ operation: 'detach', key: this.resolveKey(item) })
        })
        return this
    }

    create(attributes: Record<string, unknown> = {}, callback?: (q: Model) => void): this {
        const TargetModel = this.targetFn() as unknown as typeof Model
        const model = (TargetModel as unknown as { create(data: Record<string, unknown>): Model }).create(attributes)
        callback?.(model)
        this.queue({ operation: 'create', model })
        return this
    }
}
