import type { Model } from '../model/Model'
import type { FieldMeta } from '../core/metadata'
import { RelationBuilderBase, type RelationBuilderType, type RelationTargetInput, type RelationTarget, type PendingRelationOperation } from './base'

const INTERNAL_PROPS = ['loaded', 'relationName', 'targetFn', 'many', 'type', 'required', 'pivot']

export interface BelongsToOptions {
    required?: boolean
}

export interface HasOneOptions {
    required?: boolean
}

export abstract class SingleRelationBuilderBase extends RelationBuilderBase {
    constructor(
        targetFn: () => typeof Model,
        relationName: string,
        options: {
            type: RelationBuilderType
            required?: boolean
            pivot?: Record<string, FieldMeta>
        },
    ) {
        super(targetFn, relationName, { ...options, many: false })
    }

    protected createProxy(): this {
        return new Proxy(this, {
            get: (target, property, receiver) => {
                if (Reflect.has(target, property)) {
                    const ownValue = Reflect.get(target, property, receiver)
                    if (typeof ownValue === 'function') {
                        return ownValue.bind(receiver)
                    }
                    return ownValue
                }

                const loaded = target.getLoaded<unknown>()
                if (loaded && typeof loaded === 'object') {
                    const loadedValue = Reflect.get(loaded as object, property)
                    if (typeof loadedValue === 'function') {
                        return undefined
                    }
                    return loadedValue
                }

                return undefined
            },
            set: (target, property, value, receiver) => {
                if (typeof property === 'string' && INTERNAL_PROPS.includes(property)) {
                    ; (target as Record<string, unknown>)[property] = value
                    return true
                }
                if (Reflect.has(target, property)) {
                    return Reflect.set(target, property, value, receiver)
                }
                const loadedModel = target.ensureLoadedOne()
                return Reflect.set(loadedModel as object, property, value)
            },
        }) as this
    }

    clear(): this {
        return this.setLoaded(undefined)
    }

    protected ensureLoadedOne(): Model {
        const loaded = this.getLoaded<Model>()
        if (loaded) return loaded
        const TargetModel = this.targetFn() as unknown as new () => Model
        const instance = new TargetModel()
        this.setLoaded(instance)
        return instance
    }

    private attachLoadedModel(model: Model): void {
        this.setLoaded(model)
    }

    private detachLoadedTarget(target: RelationTargetInput | undefined): void {
        if (target === undefined) {
            this.setLoaded(undefined)
            return
        }
        const current = this.getLoaded<Model>()
        if (!current) return
        const keys = new Set(this.toItems(target).map(item => this.resolveKey(item)))
        if (keys.has(this.resolveKey(current))) {
            this.setLoaded(undefined)
        }
    }

    protected applyPendingOperationInternal(operation: PendingRelationOperation): void {
        if (operation.operation === 'detach') {
            this.detachLoadedTarget((operation.model ?? operation.key) as RelationTargetInput | undefined)
            return
        }

        if (operation.operation === 'attach' || operation.operation === 'sync' || operation.operation === 'toggle') {
            if (operation.model) {
                const items = this.toItems(operation.model as RelationTargetInput)
                const first = items[0]
                if (first instanceof Object && 'constructor' in first) {
                    this.attachLoadedModel(first as Model)
                }
            }
            else {
                this.setLoaded(undefined)
            }
            return
        }

        if (operation.model) {
            const items = this.toItems(operation.model as RelationTargetInput)
            const first = items[0]
            if (first instanceof Object && 'constructor' in first) {
                this.attachLoadedModel(first as Model)
            }
        }
    }

    set(model: RelationTarget): this {
        this.clearPendingOperations()
        this.attach(model)
        return this
    }

    toggle(model: RelationTargetInput, options?: Record<string, unknown>): this {
        const normalizedOptions = this.normalizeOptions(options)
        const items = this.toItems(model)
        items.forEach((item) => {
            if (item && typeof item === 'object' && 'constructor' in item) {
                const relationModel = item as Model
                if (relationModel._isDeleted) {
                    throw new Error(`Relation ${this.relationName} toggle() cannot target a deleted model.`)
                }
                this.queue({ operation: 'toggle', model: relationModel, options: normalizedOptions })
                return
            }
            this.queue({ operation: 'toggle', key: this.resolveKey(item), options: normalizedOptions })
        })
        return this
    }
}

export class BelongsToBuilder<T extends Model> extends SingleRelationBuilderBase {
    constructor(targetFn: () => new () => T, relationName: string, options?: BelongsToOptions) {
        super(targetFn as unknown as () => typeof Model, relationName, {
            type: 'belongsTo',
            required: options?.required ?? false,
        })
    }
}

export class HasOneBuilder<T extends Model> extends SingleRelationBuilderBase {
    constructor(targetFn: () => new () => T, relationName: string, options?: HasOneOptions) {
        super(targetFn as unknown as () => typeof Model, relationName, {
            type: 'hasOne',
            required: options?.required ?? false,
        })
    }
}
