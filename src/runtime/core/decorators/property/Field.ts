import { type FieldMeta, MetadataStorage } from '../../metadata'

export function Field(options: Partial<FieldMeta> = {}) {
  return function (_: any, context: ClassFieldDecoratorContext): void {
    context.addInitializer(function () {
      const meta = MetadataStorage.getResource(this.constructor)
      meta.fields.push({
        name: context.name as string,
        ...options,
      })
    })
  }
}
