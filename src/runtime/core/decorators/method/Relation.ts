import type { Model } from '../../../model/Model'
import { type FieldMeta, MetadataStorage } from '../../metadata'

type RelationTarget = Model | { id?: unknown } | number | string
type RelationTargetInput = RelationTarget | RelationTarget[]

interface BelongsToOptions {
  required?: boolean
}

interface RelationOptions {
  many?: boolean
  unique?: boolean
  pivot?: Record<string, FieldMeta>
}

export function Relation(targetFn: () => typeof Model, options?: RelationOptions) {
  return function (_: undefined, context: ClassFieldDecoratorContext): void {
    context.addInitializer(function () {
      const many = options?.many ?? !(options?.unique ?? false)
      const modelClass = (this as { constructor: typeof Model }).constructor
      const meta = MetadataStorage.getResource(modelClass)
      meta.relations.push({
        property: context.name as string,
        target: targetFn,
        many,
        unique: options?.unique ?? !many,
        pivot: options?.pivot ?? {},
      })
    })
  }
}

interface BelongsToManyOptions {
  required?: boolean
  pivot?: Record<string, FieldMeta>
}

export function BelongsToMany(targetFn: () => typeof Model, options?: BelongsToManyOptions) {
  return function (_: undefined, context: ClassFieldDecoratorContext): void {
    context.addInitializer(function () {
      const modelClass = (this as { constructor: typeof Model }).constructor
      const meta = MetadataStorage.getResource(modelClass)
      meta.relations.push({
        property: context.name as string,
        target: targetFn,
        type: 'belongsToMany',
        many: true,
        required: options?.required || true,
        pivot: options?.pivot ?? {},
      })
    })
  }
}

interface HasOneOptions {
  required?: boolean
}

export function HasOne(targetFn: () => typeof Model, options?: HasOneOptions) {
  return function (_: undefined, context: ClassFieldDecoratorContext): void {
    context.addInitializer(function () {
      const modelClass = (this as { constructor: typeof Model }).constructor
      const meta = MetadataStorage.getResource(modelClass)
      meta.relations.push({
        property: context.name as string,
        target: targetFn,
        type: 'hasOne',
        many: false,
        required: options?.required || false,
        pivot: {},
      })
    })
  }
}

interface HasManyOptions {
  required?: boolean
}

export function HasMany(targetFn: () => typeof Model, options?: HasManyOptions) {
  return function (_: undefined, context: ClassFieldDecoratorContext): void {
    context.addInitializer(function () {
      const modelClass = (this as { constructor: typeof Model }).constructor
      const meta = MetadataStorage.getResource(modelClass)
      meta.relations.push({
        property: context.name as string,
        target: targetFn,
        type: 'hasMany',
        many: true,
        required: options?.required || false,
        pivot: {},
      })
    })
  }
}

type RelationBuilderType = 'belongsTo' | 'belongsToMany' | 'hasOne' | 'hasMany'

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
          ;(target as Record<string, unknown>)[property] = value
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
    this.loaded = value
    return this
  }

  clear(): this {
    this.loaded = this.many ? [] : undefined
    return this
  }

  attach(
    model: RelationTargetInput,
    callbackOrOptions?: ((q: Model) => void) | Record<string, unknown>,
    maybeOptions?: Record<string, unknown>,
  ): this {
    void model
    void callbackOrOptions
    void maybeOptions
    return this
  }

  detach(model: RelationTargetInput): this {
    void model
    return this
  }

  sync(
    model: RelationTargetInput,
    callbackOrOptions?: ((q: Model) => void) | Record<string, unknown>,
    maybeOptions?: Record<string, unknown>,
  ): this {
    void model
    void callbackOrOptions
    void maybeOptions
    return this
  }

  toggle(
    model: RelationTargetInput,
    callbackOrOptions?: ((q: Model) => void) | Record<string, unknown>,
    maybeOptions?: Record<string, unknown>,
  ): this {
    void model
    void callbackOrOptions
    void maybeOptions
    return this
  }

  create(attributes: Record<string, unknown> = {}, callback?: (q: Model) => void): this {
    void attributes
    void callback
    return this
  }

  set(model: RelationTarget): this {
    if (this.many) {
      throw new Error(`Relation ${this.relationName} is a many relation and does not support set(). Use attach() instead.`)
    }

    void model
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

export type HasOneRelation<T extends Model> = HasOneBuilder<T> & T
export function HasOneRelation<T extends Model>(
  targetFn: () => new () => T,
  relationName: string,
  options?: HasOneOptions,
): HasOneRelation<T> {
  return new HasOneBuilder(targetFn, relationName, options) as unknown as HasOneRelation<T>
}

export type HasManyRelation<T extends Model> = HasManyBuilder<T> & T[]
export function HasManyRelation<T extends Model>(
  targetFn: () => new () => T,
  relationName: string,
  options?: HasManyOptions,
): HasManyRelation<T> {
  return new HasManyBuilder(targetFn, relationName, options) as unknown as HasManyRelation<T>
}

export type BelongsToManyRelation<T extends Model> = BelongsToManyBuilder<T> & T[]
export function BelongsToManyRelation<T extends Model>(
  targetFn: () => new () => T,
  relationName: string,
  options?: BelongsToManyOptions,
): BelongsToManyRelation<T> {
  return new BelongsToManyBuilder(targetFn, relationName, options) as unknown as BelongsToManyRelation<T>
}

export function isRelationBuilder(value: unknown): value is RelationBuilderBase {
  return value instanceof RelationBuilderBase
}
