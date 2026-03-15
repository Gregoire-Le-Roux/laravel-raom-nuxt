import { beforeEach, describe, expect, it } from 'vitest'
import { MetadataStorage, type FieldMeta, type RelationMeta, type ResourceMeta } from '../../src/runtime/core/metadata'
import { Model } from '../../src/runtime/model/Model'

class User extends Model {
  id!: number
  email!: string
}

class Post extends Model {
  id!: number
  title!: string
}

function makeResourceMeta(target: typeof Model, overrides: Partial<ResourceMeta> = {}): ResourceMeta {
  return {
    target,
    endpoint: 'users',
    limits: [10, 25, 50],
    fields: [],
    relations: [],
    ...overrides,
  }
}

describe('MetadataStorage', () => {
  beforeEach(() => {
    MetadataStorage.resources.clear()
  })

  describe('addResource / getResource', () => {
    it('stores and retrieves a resource meta', () => {
      const meta = makeResourceMeta(User)
      MetadataStorage.addResource(meta)

      const result = MetadataStorage.getResource(User)
      expect(result).toBe(meta)
    })

    it('overwrites when the same class is registered twice', () => {
      MetadataStorage.addResource(makeResourceMeta(User, { endpoint: 'users-v1' }))
      MetadataStorage.addResource(makeResourceMeta(User, { endpoint: 'users-v2' }))

      expect(MetadataStorage.getResource(User).endpoint).toBe('users-v2')
    })

    it('isolates resources by class', () => {
      MetadataStorage.addResource(makeResourceMeta(User, { endpoint: 'users' }))
      MetadataStorage.addResource(makeResourceMeta(Post, { endpoint: 'posts' }))

      expect(MetadataStorage.getResource(User).endpoint).toBe('users')
      expect(MetadataStorage.getResource(Post).endpoint).toBe('posts')
    })

    it('throws when querying a non-registered class', () => {
      expect(() => MetadataStorage.getResource(User)).toThrow('Resource User not registered')
    })
  })

  describe('fields', () => {
    it('can store fields on registered resource', () => {
      const meta = makeResourceMeta(User)
      MetadataStorage.addResource(meta)

      const field: FieldMeta = { name: 'email', sortable: true, filterable: true }
      meta.fields.push(field)

      const stored = MetadataStorage.getResource(User)
      expect(stored.fields).toHaveLength(1)
      expect(stored.fields[0]).toEqual(field)
    })

    it('stores the key field name separately', () => {
      const meta = makeResourceMeta(User, { key: 'id' })
      MetadataStorage.addResource(meta)

      expect(MetadataStorage.getResource(User).key).toBe('id')
    })

    it('key is undefined when not set', () => {
      MetadataStorage.addResource(makeResourceMeta(User))

      expect(MetadataStorage.getResource(User).key).toBeUndefined()
    })
  })

  describe('relations', () => {
    it('can store relations on registered resource', () => {
      const meta = makeResourceMeta(User)
      MetadataStorage.addResource(meta)

      const relation: RelationMeta = {
        property: 'posts',
        target: () => new Post(),
        unique: false,
        pivot: {},
      }
      meta.relations.push(relation)

      const stored = MetadataStorage.getResource(User)
      expect(stored.relations).toHaveLength(1)
      expect(stored.relations[0]!.property).toBe('posts')
    })

    it('relation target fn returns the right model instance', () => {
      const meta = makeResourceMeta(User)
      MetadataStorage.addResource(meta)

      const relation: RelationMeta = {
        property: 'posts',
        target: () => new Post(),
        unique: false,
        pivot: {},
      }
      meta.relations.push(relation)

      const result = MetadataStorage.getResource(User).relations[0]!.target()
      expect(result).toBeInstanceOf(Post)
    })
  })

  describe('limits', () => {
    it('stores custom limits', () => {
      MetadataStorage.addResource(makeResourceMeta(User, { limits: [1, 5, 100] }))
      expect(MetadataStorage.getResource(User).limits).toEqual([1, 5, 100])
    })
  })
})
