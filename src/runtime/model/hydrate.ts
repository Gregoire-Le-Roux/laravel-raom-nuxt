import { IdentityMap } from '../core/identityMap'
import { MetadataStorage } from '../core/metadata'
import type { Model } from './Model'

export function hydrate<T extends Model>(resourceClass: new () => T, data: any): T {
  const meta = MetadataStorage.getResource(resourceClass)
  const keyField = meta.key
  const keyValue = keyField ? data[keyField] : undefined
  const instance = IdentityMap.get(resourceClass, keyValue) ?? new resourceClass()

  instance._isDeleted = false

  for (const key in data) {
    const field = meta.fields.find(f => f.name === key)
    let value = data[key]

    if (field) {
      if (field.castFn) {
        value = field.castFn(value)
      }
      if (field.validators) {
        for (const validator of field.validators) {
          const result = validator(value)
          if (result !== true) {
            throw new Error(`Validation failed for ${key}: ${result}`)
          }
        }
      }
    }
    (instance as any)[key] = value
  }

  for (const relation of meta.relations) {
    const relData = data[relation.property]
    if (!relData) continue

    if (relation.many) {
      (instance as any)[relation.property]
        = relData.map((item: any) => hydrate(relation.target(), item))
    }
    else {
      (instance as any)[relation.property]
        = hydrate(relation.target(), relData)
    }
  }

  if (keyValue !== undefined && keyValue !== null) {
    IdentityMap.set(resourceClass, keyValue, instance)
  }

  return instance
}
