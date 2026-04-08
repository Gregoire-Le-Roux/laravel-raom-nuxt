import { hydrate } from '../../../model/hydrate'
import { QueryBuilder } from '../../../query/QueryBuilder'
import { MetadataStorage, type ResourceMeta } from '../../metadata'

export function Resource(endpoint: string, options?: { limits?: number[] }) {
  return function (constructor: any, _: ClassDecoratorContext) {
    const meta: ResourceMeta = {
      target: constructor,
      endpoint,
      limits: options?.limits || [10, 25, 50],
      fields: [],
      relations: [],
    }
    MetadataStorage.addResource(meta)

    let bootstrapInstance
    try {
      bootstrapInstance = new constructor()
    }
    catch {
      throw new Error(`Failed to instantiate resource ${constructor.name}. Make sure it has a parameterless constructor and that all its dependencies can be instantiated without parameters.`)
    }

    if (typeof constructor.registerRelationBuildersFromInstance === 'function') {
      constructor.registerRelationBuildersFromInstance(bootstrapInstance)
    }

    constructor.query = () => {
      return new QueryBuilder(constructor)
    }
    constructor.hydrate = (data: any) => {
      return hydrate(constructor, data)
    }
    constructor.new = (data: any) => {
      const instance = new constructor()
      Object.assign(instance, data)
      instance._isNew = true
      return instance
    }
    constructor.create = constructor.new
    constructor.getMeta = () => {
      return MetadataStorage.getResource(constructor)
    }
  }
}
