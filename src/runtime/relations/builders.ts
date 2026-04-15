import type { Model } from '../model/Model'
import type { FieldMeta } from '../core/metadata'
import { MetadataStorage } from '../core/metadata'

type RelationTarget = Model | { id?: unknown } | number | string
type RelationTargetInput = RelationTarget | RelationTarget[]

type RelationBuilderType = 'belongsTo' | 'belongsToMany' | 'hasOne' | 'hasMany'

interface BelongsToOptions {
  required?: boolean
}

interface BelongsToManyOptions {
  required?: boolean
  pivot?: Record<string, FieldMeta>
}

interface HasOneOptions {
  required?: boolean
}

interface HasManyOptions {
  required?: boolean
}

export interface PendingRelationOperation {
  operation: 'attach' | 'detach' | 'sync' | 'toggle' | 'create' | 'update'
  key?: unknown | unknown[]
  model?: Model | Model[]
  options?: Record<string, unknown>
}

class RelationBuilderBase {
  declare save: never
  declare update: never
  declare ['delete']: never

  protected relationName: string
  protected targetFn: () => typeof Model
  protected many: boolean
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

    return this.createModelLikeProxy()
  }

  private createModelLikeProxy(): this {
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

        if (target.many) {
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
        }

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
        if (
          typeof property === 'string'
          && ['loaded', 'relationName', 'targetFn', 'many', 'type', 'required', 'pivot'].includes(property)
        ) {
          ; (target as Record<string, unknown>)[property] = value
          return true
        }

        if (Reflect.has(target, property)) {
          return Reflect.set(target, property, value, receiver)
        }

        if (target.many) {
          const loadedArray = target.ensureLoadedMany()
          if (typeof property === 'string' && /^\d+$/.test(property)) {
            loadedArray[Number(property)] = value
            return true
          }

          return Reflect.set(loadedArray as object, property, value)
        }

        const loadedModel = target.ensureLoadedOne()
        return Reflect.set(loadedModel as object, property, value)
      },
    }) as this
  }

  private ensureLoadedOne(): Model {
    const loaded = this.getLoaded<Model>()
    if (loaded) {
      return loaded
    }

    const TargetModel = this.targetFn() as unknown as new () => Model
    const instance = new TargetModel()
    this.setLoaded(instance)
    return instance
  }

  private ensureLoadedMany(): unknown[] {
    const loaded = this.getLoaded<unknown[]>()
    if (Array.isArray(loaded)) {
      return loaded
    }

    const initialized: unknown[] = []
    this.setLoaded(initialized)
    return initialized
  }

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
    const relationAlreadyRegistered = meta.relations.some(relation => relation.property === this.relationName)

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

  clear(): this {
    this.setLoaded(this.many ? [] : undefined)
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
      this.applyPendingOperation(operation)
    }

    this.pendingOperations = []
    return this
  }

  private toItems(input: RelationTargetInput): RelationTarget[] {
    return Array.isArray(input) ? input : [input]
  }

  private resolveKey(target: RelationTarget): unknown {
    if (target instanceof Object && 'getKey' in target && typeof target.getKey === 'function') {
      return target.getKey()
    }

    if (target && typeof target === 'object' && 'id' in target) {
      return target.id
    }

    return target
  }

  private normalizeOptions(options?: Record<string, unknown>) {
    if (!options) {
      return undefined
    }

    return Object.fromEntries(
      Object.entries(options).map(([key, value]) => [
        key.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase(),
        value,
      ]),
    )
  }

  private queue(operation: PendingRelationOperation): this {
    this.pendingOperations.push(operation)
    return this
  }

  private registerLoadedParents(value: unknown): void {
    if (!this.owner) {
      return
    }

    const register = (item: unknown) => {
      if (item && typeof item === 'object' && 'registerParentRelation' in item && typeof item.registerParentRelation === 'function') {
        item.registerParentRelation(this.owner!, this.relationName)
      }
    }

    if (Array.isArray(value)) {
      value.forEach(register)
      return
    }

    register(value)
  }

  private unregisterLoadedParents(value: unknown): void {
    if (!this.owner) {
      return
    }

    const unregister = (item: unknown) => {
      if (item && typeof item === 'object' && 'unregisterParentRelation' in item && typeof item.unregisterParentRelation === 'function') {
        item.unregisterParentRelation(this.owner!, this.relationName)
      }
    }

    if (Array.isArray(value)) {
      value.forEach(unregister)
      return
    }

    unregister(value)
  }

  private attachLoadedModel(model: Model): void {
    if (this.many) {
      const loadedArray = this.ensureLoadedMany() as Model[]
      if (!loadedArray.includes(model)) {
        loadedArray.push(model)
      }
      return
    }

    this.setLoaded(model)
  }

  private detachLoadedTarget(target: RelationTargetInput | undefined): void {
    if (this.many) {
      const loadedArray = this.getLoaded<Model[]>()
      if (!Array.isArray(loadedArray)) {
        return
      }

      const items = target === undefined ? [] : this.toItems(target)
      if (items.length === 0) {
        loadedArray.splice(0, loadedArray.length)
        return
      }

      const keys = new Set(items.map(item => this.resolveKey(item)))
      const remaining = loadedArray.filter(item => !keys.has(this.resolveKey(item)))
      this.setLoaded(remaining)
      return
    }

    if (target === undefined) {
      this.setLoaded(undefined)
      return
    }

    const current = this.getLoaded<Model>()
    if (!current) {
      return
    }

    const keys = new Set(this.toItems(target).map(item => this.resolveKey(item)))
    if (keys.has(this.resolveKey(current))) {
      this.setLoaded(undefined)
    }
  }

  private applyPendingOperation(operation: PendingRelationOperation): void {
    if (operation.operation === 'detach') {
      this.detachLoadedTarget((operation.model ?? operation.key) as RelationTargetInput | undefined)
      return
    }

    if (operation.operation === 'attach' || operation.operation === 'sync' || operation.operation === 'toggle') {
      if (operation.model) {
        const items = this.toItems(operation.model)
        items.forEach((item) => {
          if (item instanceof Object && 'constructor' in item) {
            this.attachLoadedModel(item as Model)
          }
        })
      }
      else if (!this.many) {
        this.setLoaded(undefined)
      }
      return
    }

    if (operation.model) {
      const items = this.toItems(operation.model)
      items.forEach((item) => {
        if (item instanceof Object && 'constructor' in item) {
          this.attachLoadedModel(item as Model)
        }
      })
    }
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
        if ((relationModel as Model)._isDeleted) {
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

  create(attributes: Record<string, unknown> = {}, callback?: (q: Model) => void): this {
    const TargetModel = this.targetFn() as unknown as typeof Model
    const model = (TargetModel as unknown as { create(data: Record<string, unknown>): Model }).create(attributes)
    callback?.(model)
    this.queue({ operation: 'create', model })
    return this
  }

  set(model: RelationTarget): this {
    if (this.many) {
      throw new Error(`Relation ${this.relationName} is a many relation and does not support set(). Use attach() instead.`)
    }

    this.clearPendingOperations()
    this.attach(model)
    return this
  }
}

export class BelongsToBuilder<T extends Model> extends RelationBuilderBase {
  constructor(targetFn: () => new () => T, relationName: string, options?: BelongsToOptions) {
    super(targetFn as unknown as () => typeof Model, relationName, {
      many: false,
      type: 'belongsTo',
      required: options?.required ?? false,
    })
  }
}

export class HasOneBuilder<T extends Model> extends RelationBuilderBase {
  constructor(targetFn: () => new () => T, relationName: string, options?: HasOneOptions) {
    super(targetFn as unknown as () => typeof Model, relationName, {
      many: false,
      type: 'hasOne',
      required: options?.required ?? false,
    })
  }
}

export class HasManyBuilder<T extends Model> extends RelationBuilderBase {
  constructor(targetFn: () => new () => T, relationName: string, options?: HasManyOptions) {
    super(targetFn as unknown as () => typeof Model, relationName, {
      many: true,
      type: 'hasMany',
      required: options?.required ?? false,
    })
  }
}

export class BelongsToManyBuilder<T extends Model> extends RelationBuilderBase {
  constructor(targetFn: () => new () => T, relationName: string, options?: BelongsToManyOptions) {
    super(targetFn as unknown as () => typeof Model, relationName, {
      many: true,
      type: 'belongsToMany',
      required: options?.required ?? false,
      pivot: options?.pivot,
    })
  }
}

export type BelongsTo<T extends Model> = BelongsToBuilder<T> & T
export function BelongsTo<T extends Model>(
  targetFn: () => new () => T,
  relationName: string,
  options?: BelongsToOptions,
): BelongsTo<T> {
  return new BelongsToBuilder(targetFn, relationName, options) as unknown as BelongsTo<T>
}

export type HasOne<T extends Model> = HasOneBuilder<T> & T
export function HasOne<T extends Model>(
  targetFn: () => new () => T,
  relationName: string,
  options?: HasOneOptions,
): HasOne<T> {
  return new HasOneBuilder(targetFn, relationName, options) as unknown as HasOne<T>
}

export type HasMany<T extends Model> = HasManyBuilder<T> & T[]
export function HasMany<T extends Model>(
  targetFn: () => new () => T,
  relationName: string,
  options?: HasManyOptions,
): HasMany<T> {
  return new HasManyBuilder(targetFn, relationName, options) as unknown as HasMany<T>
}

export type BelongsToMany<T extends Model> = BelongsToManyBuilder<T> & T[]
export function BelongsToMany<T extends Model>(
  targetFn: () => new () => T,
  relationName: string,
  options?: BelongsToManyOptions,
): BelongsToMany<T> {
  return new BelongsToManyBuilder(targetFn, relationName, options) as unknown as BelongsToMany<T>
}

export function isRelationBuilder(value: unknown): value is RelationBuilderBase {
  return value instanceof RelationBuilderBase
}
