import { IdentityMap } from '../core/identityMap'
import { MetadataStorage } from '../core/metadata'
import type { Model } from './Model'

export function hydrate<T extends Model>(resourceClass: new () => T, data: any): T {
  const meta = MetadataStorage.getResource(resourceClass)
  const keyField = meta.key
  const keyValue = keyField ? data[keyField] : undefined
  const sharedFields = IdentityMap.get(resourceClass, keyValue)
  const instance = new resourceClass()

  if (sharedFields) {
    instance.useSharedFields(sharedFields)
  }

  instance._isDeleted = false

  const relationProperties = new Set(meta.relations.map(r => r.property))

  for (const key in data) {
    if (relationProperties.has(key)) continue

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
    instance.setField(key, value, false)
  }

  for (const relation of meta.relations) {
    const relData = data[relation.property]
    if (!relData) continue

    const relationBuilderCandidate = (instance as any)[relation.property]

    if (relation.many) {
      const hydratedRelation = relData.map((item: any) => hydrate(relation.target(), item))
      if (relationBuilderCandidate && typeof relationBuilderCandidate.setLoaded === 'function') {
        relationBuilderCandidate.setLoaded(hydratedRelation)
      }
      ;(instance as any)[relation.property] = hydratedRelation
    }
    else {
      const hydratedRelation = hydrate(relation.target(), relData)
      if (relationBuilderCandidate && typeof relationBuilderCandidate.setLoaded === 'function') {
        relationBuilderCandidate.setLoaded(hydratedRelation)
      }
      ;(instance as any)[relation.property] = hydratedRelation
    }
  }

  if (keyValue !== undefined && keyValue !== null) {
    IdentityMap.set(resourceClass, keyValue, instance._fields)
  }

  return instance
}
