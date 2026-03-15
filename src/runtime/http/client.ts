import { MetadataStorage, type ResourceMeta } from './constants'
import { QueryBuilder } from './QueryBuilder'
import { hydrate } from './hydrate'

export function Resource(endpoint: string, options?: { limits?: number[] }) {
  return function (constructor: any, context: ClassDecoratorContext) {
    const meta: ResourceMeta = {
      target: constructor,
      endpoint,
      limits: options?.limits || [10, 25, 50],
      fields: [],
      relations: [],
    }
    MetadataStorage.addResource(meta)

    try {
      new constructor()
    }
    catch (e) {
      throw new Error(`Failed to instantiate resource ${constructor.name}. Make sure it has a parameterless constructor and that all its dependencies can be instantiated without parameters.`)
    }

    constructor.query = () => {
      return new QueryBuilder(constructor)
    }
    constructor.hydrate = (data: any) => {
      return hydrate(constructor, data)
    }
    constructor.create = (data: any) => {
      const instance = new constructor()
      Object.assign(instance, data)
      return instance
    }
    constructor.getMeta = () => {
      return MetadataStorage.getResource(constructor)
    }
  }
}
