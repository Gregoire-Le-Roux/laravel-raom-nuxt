import type { Model } from '../model/Model'
import type { FieldMeta } from '../core/metadata'
import { RelationBuilderBase, type RelationBuilderType, type RelationTargetInput, type PendingRelationOperation } from './base'

const INTERNAL_PROPS = ['loaded', 'relationName', 'targetFn', 'many', 'type', 'required', 'pivot']

export interface BelongsToManyOptions {
    required?: boolean
    pivot?: Record<string, FieldMeta>
}

export interface HasManyOptions {
    required?: boolean
}

export abstract class ManyRelationBuilderBase extends RelationBuilderBase {
    constructor(
        targetFn: () => typeof Model,
        relationName: string,
        options: {
            type: RelationBuilderType
            required?: boolean
            pivot?: Record<string, FieldMeta>
        },
    ) {
        super(targetFn, relationName, { ...options, many: true })
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
                const loadedArray = Array.isArray(loaded) ? loaded : []

                if (property === Symbol.iterator) {
                    return loadedArray[Symbol.iterator].bind(loadedArray)
                }

                if (typeof property === 'string' && /^\d+$/.test(property)) {
                    return loadedArray.at(Number(property))
                }

                const arrayValue = Reflect.get(loadedArray as object, property)
                if (typeof arrayValue === 'function') {
                    return arrayValue.bind(loadedArray)
                }

                return arrayValue
            },
            set: (target, property, value, receiver) => {
                if (typeof property === 'string' && INTERNAL_PROPS.includes(property)) {
                    ; (target as Record<string, unknown>)[property] = value
                    return true
                }
                if (Reflect.has(target, property)) {
                    return Reflect.set(target, property, value, receiver)
                }
                const loadedArray = target.ensureLoadedMany()
                if (typeof property === 'string' && /^\d+$/.test(property)) {
                    loadedArray[Number(property)] = value
                    return true
                }
                return Reflect.set(loadedArray as object, property, value)
            },
        }) as this
    }

    clear(): this {
        return this.setLoaded([])
    }

    protected ensureLoadedMany(): unknown[] {
        const loaded = this.getLoaded<unknown[]>()
        if (Array.isArray(loaded)) return loaded
        const initialized: unknown[] = []
        this.setLoaded(initialized)
        return initialized
    }

    private attachLoadedModel(model: Model): void {
        const loadedArray = this.ensureLoadedMany() as Model[]
        if (!loadedArray.includes(model)) {
            loadedArray.push(model)
        }
    }

    private detachLoadedTarget(target: RelationTargetInput | undefined): void {
        const loadedArray = this.getLoaded<Model[]>()
        if (!Array.isArray(loadedArray)) return

        const items = target === undefined ? [] : this.toItems(target)
        if (items.length === 0) {
            loadedArray.splice(0, loadedArray.length)
            return
        }

        const keys = new Set(items.map(item => this.resolveKey(item)))
        const remaining = loadedArray.filter(item => !keys.has(this.resolveKey(item)))
        this.setLoaded(remaining)
    }

    protected applyPendingOperationInternal(operation: PendingRelationOperation): void {
        if (operation.operation === 'detach') {
            this.detachLoadedTarget((operation.model ?? operation.key) as RelationTargetInput | undefined)
            return
        }

        if (operation.operation === 'attach' || operation.operation === 'sync' || operation.operation === 'toggle') {
            if (operation.model) {
                const items = this.toItems(operation.model as RelationTargetInput)
                items.forEach((item) => {
                    if (item instanceof Object && 'constructor' in item) {
                        this.attachLoadedModel(item as Model)
                    }
                })
            }
            return
        }

        if (operation.model) {
            const items = this.toItems(operation.model as RelationTargetInput)
            items.forEach((item) => {
                if (item instanceof Object && 'constructor' in item) {
                    this.attachLoadedModel(item as Model)
                }
            })
        }
    }

    sync(
        model: RelationTargetInput,
        callbackOrOptions?: ((q: Model) => void) | Record<string, unknown>,
        maybeOptions?: Record<string, unknown>,
    ): this {
        const options = this.normalizeOptions(typeof callbackOrOptions === 'function' ? maybeOptions : callbackOrOptions)
        const items = this.toItems(model)

        items.forEach((item) => {
            if (item && typeof item === 'object' && 'constructor' in item) {
                const relationModel = item as Model
                if (relationModel._isNew || relationModel._isDeleted) {
                    throw new Error(`Relation ${this.relationName} sync() expects persisted, non-deleted models.`)
                }
                this.queue({ operation: 'sync', model: relationModel, options })
                return
            }
            this.queue({ operation: 'sync', key: this.resolveKey(item), options })
        })

        return this
    }

    toggle(
        model: RelationTargetInput,
        callbackOrOptions?: ((q: Model) => void) | Record<string, unknown>,
        maybeOptions?: Record<string, unknown>,
    ): this {
        const options = this.normalizeOptions(typeof callbackOrOptions === 'function' ? maybeOptions : callbackOrOptions)
        const items = this.toItems(model)

        items.forEach((item) => {
            if (item && typeof item === 'object' && 'constructor' in item) {
                const relationModel = item as Model
                if (relationModel._isDeleted) {
                    throw new Error(`Relation ${this.relationName} toggle() cannot target a deleted model.`)
                }
                this.queue({ operation: 'toggle', model: relationModel, options })
                return
            }
            this.queue({ operation: 'toggle', key: this.resolveKey(item), options })
        })

        return this
    }
}



export class HasManyBuilder<T extends Model> extends ManyRelationBuilderBase {
    constructor(targetFn: () => new () => T, relationName: string, options?: HasManyOptions) {
        super(targetFn as unknown as () => typeof Model, relationName, {
            type: 'hasMany',
            required: options?.required ?? false,
        })
    }
}

export class BelongsToManyBuilder<T extends Model> extends ManyRelationBuilderBase {
    constructor(targetFn: () => new () => T, relationName: string, options?: BelongsToManyOptions) {
        super(targetFn as unknown as () => typeof Model, relationName, {
            type: 'belongsToMany',
            required: options?.required ?? false,
            pivot: options?.pivot,
        })
    }
}
