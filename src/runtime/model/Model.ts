import { MetadataStorage } from '../core/metadata'
import type { QueryBuilder } from '../query/QueryBuilder'
import { isRelationBuilder } from '../core/decorators/method/Relation'

export abstract class Model {
  _isDeleted = false
  _isNew = false
  _fields: Record<string, unknown> = {}
  _changes: Record<string, unknown> = {}

  constructor() {
    return new Proxy(this, {
      get(target, property, receiver) {
        if (typeof property === 'string' && Object.prototype.hasOwnProperty.call(target._fields, property)) {
          return target._fields[property]
        }

        return Reflect.get(target, property, receiver)
      },
      set(target, property, value, receiver) {
        if (target.shouldStoreAsField(property, value)) {
          target.setChange(property as string, value)
          return true
        }

        return Reflect.set(target, property, value, receiver)
      },
    })
  }

  private getMetaSafe() {
    try {
      return MetadataStorage.getResource(this.constructor as typeof Model)
    }
    catch {
      return null
    }
  }

  private isRelationProperty(property: string) {
    const meta = this.getMetaSafe()
    if (!meta) {
      return false
    }

    return meta.relations.some(relation => relation.property === property)
  }

  private shouldStoreAsField(property: string | symbol, value: unknown) {
    if (typeof property !== 'string' || property.startsWith('_')) {
      return false
    }

    if (typeof value === 'function' || isRelationBuilder(value) || this.isRelationProperty(property)) {
      return false
    }

    const meta = this.getMetaSafe()
    if (meta) {
      return meta.fields.some(field => field.name === property)
    }

    return !(property in this)
  }

  /**
   * Write a value to persisted fields.
   * Optionally mirrors the same value into pending changes.
   */
  setField(property: string, value: unknown, trackChange = true) {
    this._fields[property] = value
    if (trackChange) {
      this._changes[property] = value
    }
  }

  /**
   * Register a pending change without mutating persisted fields.
   */
  setChange(property: string, value: unknown) {
    if (
      value === undefined
      && !Object.prototype.hasOwnProperty.call(this._fields, property)
      && !Object.prototype.hasOwnProperty.call(this._changes, property)
    ) {
      return
    }

    this._changes[property] = value
  }

  /**
   * Promote all pending changes to persisted fields.
   * Intended to be called after a successful backend mutation.
   */
  applyChanges() {
    Object.assign(this._fields, this._changes)
    this._changes = {}
  }

  /**
   * Drop all pending changes and keep persisted fields unchanged.
   */
  discardChanges() {
    this._changes = {}
  }

  /**
   * Bind this model instance to an external shared fields object.
   * Used by identity map hydration to share a single persisted state.
   */
  useSharedFields(fields: Record<string, unknown>) {
    this._fields = fields
  }

  /**
   * Registers relation-builder metadata from a bootstrap instance.
   */
  static registerRelationBuildersFromInstance(instance: Model): void {
    instance.registerRelationBuilders({ registerMeta: true })
  }

  private registerRelationBuilders(options?: { registerMeta?: boolean }) {
    for (const [propertyName, value] of Object.entries(this)) {
      if (!isRelationBuilder(value)) {
        continue
      }

      value.bindProperty(propertyName)

      if (options?.registerMeta) {
        value.registerMetadata(this.constructor as typeof Model, propertyName)
      }
    }
  }

  /**
   * Build a payload-ready attributes object.
   * For each declared field, prefers pending change over persisted value.
   */
  getAttributesPayload() {
    return MetadataStorage.getResource(this.constructor as typeof Model).fields.reduce((acc, field) => {
      if (Object.prototype.hasOwnProperty.call(this._changes, field.name)) {
        acc[field.name] = this._changes[field.name]
      }
      return acc
    }, {} as Record<string, unknown>)
  }

  /**
   * Return a query builder for this resource model.
   * Replaced at runtime by the Resource decorator.
   */
  static query<T extends Model>(this: new () => T): QueryBuilder<T> {
    throw new Error('Must be decorated with @Resource')
  }

  /**
   * Hydrate a model instance from raw data.
   * Replaced at runtime by the Resource decorator.
   */
  static hydrate<T extends Model>(this: new () => T, _: unknown): T {
    throw new Error('Must be decorated with @Resource')
  }

  /**
   * Create a new draft-like instance for this resource.
   * Replaced at runtime by the Resource decorator.
   */
  static new<T extends Model>(this: new () => T, _: unknown): T {
    throw new Error('Must be decorated with @Resource')
  }

  /**
   * Alias of new for resource creation.
   * Replaced at runtime by the Resource decorator.
   */
  static create<T extends Model>(this: new () => T, _: unknown): T {
    throw new Error('Must be decorated with @Resource')
  }

  /**
   * Return resource metadata associated with this model class.
   */
  getMeta() {
    const meta = MetadataStorage.getResource(this.constructor as typeof Model)
    if (!meta) throw new Error(`Resource ${this.constructor.name} not registered`)
    return meta
  }

  /**
   * Whether the model currently has a non-null key value.
   */
  hasKey() {
    const meta = this.getMeta()
    const keyField = meta.key
    if (!keyField) return false
    const keyValue = (this as unknown as Record<string, unknown>)[keyField]
    return keyValue !== undefined && keyValue !== null
  }

  /**
   * Return the model key value.
   * Throws when the key is not available.
   */
  getKey() {
    if (!this.hasKey()) {
      throw new Error(`Instance of ${this.constructor.name} doesn't have a key value set.`)
    }
    const meta = this.getMeta()
    const keyField = meta.key
    if (!keyField) {
      throw new Error(`Resource ${this.constructor.name} doesn't have a key field defined.`)
    }
    return (this as unknown as Record<string, unknown>)[keyField]
  }

  /**
   * Access a belongs-to relation by property name.
   */
  belongsTo(target: typeof Model, relationName: string) {
    void target
    return (this as Record<string, unknown>)[relationName]
  }

  /**
   * Access a has-many relation by property name.
   */
  hasMany(target: typeof Model, relationName: string) {
    void target
    return (this as Record<string, unknown>)[relationName]
  }

  /**
   * Access a has-one relation by property name.
   */
  hasOne(target: typeof Model, relationName: string) {
    void target
    return (this as Record<string, unknown>)[relationName]
  }

  /**
   * Access a belongs-to-many relation by property name.
   */
  belongsToMany(target: typeof Model, relationName: string) {
    void target
    return (this as Record<string, unknown>)[relationName]
  }

  deeplyGeneratePayload() {
    // const payload = {
    //   attributes: this.getAttributesPayload(),
    //   relations: this.getMeta().relations.reduce((acc, relation) => {

    //   }, {} as Record<string, unknown>),
    // }
  }
}
