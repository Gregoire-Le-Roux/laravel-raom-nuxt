import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { QueryBuilder } from '../../src/runtime/query/QueryBuilder'
import { Model } from '../../src/runtime/model/Model'
import * as hydrateModule from '../../src/runtime/model/hydrate'
import { Resource, Field, Key, Relation } from '../../src/runtime/core/decorators'
import { MetadataStorage, type FieldMeta, type ResourceMeta } from '../../src/runtime/core/metadata'

type DecoratedCtor<T extends Model> = {
  new (): T
  query(): QueryBuilder<T>
  hydrate(data: unknown): T
  create(data: Partial<T>): T
  getMeta(): ResourceMeta
}

type InitializerThis = { constructor: typeof Model }
type InitializerFn = (this: InitializerThis) => void

function buildResourceMeta(target: typeof Model): ResourceMeta {
  return {
    target,
    endpoint: 'tests',
    limits: [10],
    fields: [],
    relations: [],
  }
}

function runSingleInitializer(initializers: InitializerFn[], constructor: typeof Model) {
  expect(initializers).toHaveLength(1)
  initializers[0]!.call({ constructor })
}

describe('core decorators', () => {
  beforeEach(() => {
    MetadataStorage.resources.clear()
    vi.restoreAllMocks()
  })

  describe('Resource', () => {
    it('registers metadata with default limits and injects static helpers', () => {
      class User extends Model {
        id!: number
      }

      Resource('users')(User, {} as ClassDecoratorContext)

      const meta = MetadataStorage.getResource(User)
      expect(meta.endpoint).toBe('users')
      expect(meta.limits).toEqual([10, 25, 50])
      expect(meta.fields).toEqual([])
      expect(meta.relations).toEqual([])

      const DecoratedUser = User as unknown as DecoratedCtor<User>

      const qb = DecoratedUser.query()
      expect(qb.constructor.name).toBe('QueryBuilder')

      const created = DecoratedUser.create({ id: 7 })
      expect(created).toBeInstanceOf(User)
      expect(created.id).toBe(7)

      const hydratedUser = new User()
      hydratedUser.id = 8
      const hydrateSpy = vi.spyOn(hydrateModule, 'hydrate').mockReturnValue(hydratedUser)

      const hydrated = DecoratedUser.hydrate({ id: 8 })
      expect(hydrateSpy).toHaveBeenCalledWith(User, { id: 8 })
      expect(hydrated).toBe(hydratedUser)

      expect(DecoratedUser.getMeta()).toBe(meta)
    })

    it('uses custom limits when provided', () => {
      class Product extends Model {
        id!: number
      }

      Resource('products', { limits: [1, 10, 50] })(Product, {} as ClassDecoratorContext)

      const meta = MetadataStorage.getResource(Product)
      expect(meta.limits).toEqual([1, 10, 50])
    })

    it('throws a clear error when class instantiation fails', () => {
      class BrokenModel extends Model {
        constructor(required?: string) {
          super()
          if (!required) {
            throw new Error('missing required constructor dependency')
          }
        }
      }

      expect(() => {
        Resource('broken')(BrokenModel, {} as ClassDecoratorContext)
      }).toThrow('Failed to instantiate resource BrokenModel')
    })
  })

  describe('Field', () => {
    it('adds field metadata with options through initializer', () => {
      class TestModel extends Model {
        title!: string
      }

      const meta = buildResourceMeta(TestModel)
      const getResourceSpy = vi.spyOn(MetadataStorage, 'getResource').mockReturnValue(meta)
      const initializers: InitializerFn[] = []

      Field({ sortable: true, searchable: true })(undefined, {
        name: 'title',
        addInitializer(fn: InitializerFn) {
          initializers.push(fn)
        },
      } as unknown as ClassFieldDecoratorContext)

      runSingleInitializer(initializers, TestModel)

      expect(getResourceSpy).toHaveBeenCalledWith(TestModel)
      expect(meta.fields).toEqual([
        {
          name: 'title',
          sortable: true,
          searchable: true,
        },
      ])
    })
  })

  describe('Key', () => {
    it('sets key metadata through initializer', () => {
      class TestModel extends Model {
        id!: number
      }

      const meta = buildResourceMeta(TestModel)
      const getResourceSpy = vi.spyOn(MetadataStorage, 'getResource').mockReturnValue(meta)
      const initializers: InitializerFn[] = []

      Key()(undefined, {
        name: 'id',
        addInitializer(fn: InitializerFn) {
          initializers.push(fn)
        },
      } as unknown as ClassFieldDecoratorContext)

      runSingleInitializer(initializers, TestModel)

      expect(getResourceSpy).toHaveBeenCalledWith(TestModel)
      expect(meta.key).toBe('id')
    })
  })

  describe('Relation', () => {
    it('adds relation metadata with defaults through initializer', () => {
      class TestModel extends Model {
        posts!: Model[]
      }

      class Post extends Model {
        id!: number
      }

      const meta = buildResourceMeta(TestModel)
      vi.spyOn(MetadataStorage, 'getResource').mockReturnValue(meta)
      const initializers: InitializerFn[] = []

      const targetFn = () => Post

      Relation(targetFn)(undefined, {
        name: 'posts',
        addInitializer(fn: InitializerFn) {
          initializers.push(fn)
        },
      } as unknown as ClassFieldDecoratorContext)

      runSingleInitializer(initializers, TestModel)

      expect(meta.relations).toHaveLength(1)
      const relation = meta.relations[0]!
      expect(relation.property).toBe('posts')
      expect(relation.many).toBe(true)
      expect(relation.unique).toBe(false)
      expect(relation.pivot).toEqual({})
      expect(relation.target).toBe(targetFn)
    })

    it('applies unique and pivot options', () => {
      class TestModel extends Model {
        tags!: Model[]
      }

      class Tag extends Model {
        id!: number
      }

      const meta = buildResourceMeta(TestModel)
      vi.spyOn(MetadataStorage, 'getResource').mockReturnValue(meta)
      const initializers: InitializerFn[] = []

      const pivot: Record<string, FieldMeta> = {
        role: { name: 'role', sortable: true },
      }
      const targetFn = () => Tag

      Relation(targetFn, {
        many: false,
        unique: true,
        pivot,
      })(undefined, {
        name: 'tags',
        addInitializer(fn: InitializerFn) {
          initializers.push(fn)
        },
      } as unknown as ClassFieldDecoratorContext)

      runSingleInitializer(initializers, TestModel)

      expect(meta.relations).toHaveLength(1)
      const relation = meta.relations[0]!
      expect(relation.property).toBe('tags')
      expect(relation.many).toBe(false)
      expect(relation.unique).toBe(true)
      expect(relation.pivot).toEqual(pivot)
      expect(relation.target).toBe(targetFn)
    })
  })
})
