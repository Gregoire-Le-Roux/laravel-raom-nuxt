import type { Model } from '../../../model/Model'
import { type FieldMeta, MetadataStorage } from '../../metadata'

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
