import { MetadataStorage } from '../../metadata'

export function Key() {
  return function (_: any, context: ClassFieldDecoratorContext): void {
    context.addInitializer(function () {
      const meta = MetadataStorage.getResource(this.constructor)
      meta.key = context.name as string
    })
  }
}
