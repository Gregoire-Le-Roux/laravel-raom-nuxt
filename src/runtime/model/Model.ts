import { IdentityMap } from '../core/identityMap'
import { MetadataStorage } from '../core/metadata'
import type { WriteBuilder } from '../mutation/WriteBuilder'
import type { QueryBuilder } from '../query/QueryBuilder'

class HasManyRelation {
  parent: Model
  target: typeof Model

  constructor(parent: Model, target: typeof Model) {
    this.parent = parent
    this.target = target
  }

  attach(model: Model) {
    console.log('Attaching', model, 'to', this.parent)
  }
}

export abstract class Model {
  _isDeleted = false

  static query<T extends Model>(this: new () => T): QueryBuilder<T> {
    throw new Error('Must be decorated with @Resource')
  }

  static hydrate<T extends Model>(this: new () => T, _: unknown): T {
    throw new Error('Must be decorated with @Resource')
  }

  static create<T extends Model>(this: new () => T, _: unknown): T {
    throw new Error('Must be decorated with @Resource')
  }

  static write<T extends Model>(this: new () => T): WriteBuilder<T> {
    throw new Error('Must be decorated with @Resource')
  }

  async save(): Promise<any> {
    // const { save } = await import('./save')
    // return save(this)
  }

  async delete() {
    const key = MetadataStorage.getResource(this.constructor as any).key
    if (!key) throw new Error(`Resource ${this.constructor.name} doesn't have a key field defined.`)
    const keyValue = (this as any)[key]
    if (!keyValue) throw new Error(`Key field ${key} is not set on the instance of ${this.constructor.name}.`)

    this._isDeleted = true
    console.log(`Deleting ${this.constructor.name} with key ${keyValue}...`)
    try {
      await $fetch(`http://localhost/api/${MetadataStorage.getResource(this.constructor as any).endpoint}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resources: [keyValue],
        },
        ),
      })
      IdentityMap.delete(this.constructor as any, keyValue)
    }
    catch (error) {
      this._isDeleted = false
      throw error
    }

    return true
  }

  hasMany(target: typeof Model, relationName: string) {
    console.log('Creating hasMany relation between', this.constructor.name, 'and', target.name, 'with relation name', relationName)
    return new HasManyRelation(this, target)
  }
}
