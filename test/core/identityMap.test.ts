import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IdentityMap } from '../../src/runtime/core/identityMap'
import { Model } from '../../src/runtime/model/Model'

class User extends Model {
  id!: number
}

class Post extends Model {
  id!: number
}

/**
 * IdentityMap only stores data when import.meta.client is true.
 * In the test environment (Node), import.meta.client is falsy so the internal
 * store is null and every operation is a no-op.
 *
 * We mock import.meta.client = true on the module level to activate the store.
 */
vi.mock('../../src/runtime/core/identityMap', async () => {
  const clientStore: Map<unknown, Map<unknown, unknown>> = new Map()

  const getBucket = (modelClass: unknown) => {
    let bucket = clientStore.get(modelClass)
    if (!bucket) {
      bucket = new Map()
      clientStore.set(modelClass, bucket)
    }
    return bucket
  }

  return {
    IdentityMap: {
      get: (modelClass: unknown, key: unknown) => {
        if (key === undefined || key === null) return undefined
        return clientStore.get(modelClass)?.get(key)
      },
      set: (modelClass: unknown, key: unknown, instance: unknown) => {
        if (key === undefined || key === null) return instance
        getBucket(modelClass).set(key, instance)
        return instance
      },
      delete: (modelClass: unknown, key: unknown) => {
        if (key === undefined || key === null) return
        clientStore.get(modelClass)?.delete(key)
      },
      clear: (modelClass?: unknown) => {
        if (!modelClass) {
          clientStore.clear()
          return
        }
        clientStore.delete(modelClass)
      },
    },
  }
})

describe('IdentityMap', () => {
  beforeEach(() => {
    IdentityMap.clear()
  })

  describe('set / get', () => {
    it('stores and retrieves an instance by class and key', () => {
      const user = new User()
      user.id = 1
      IdentityMap.set(User, 1, user)

      expect(IdentityMap.get(User, 1)).toBe(user)
    })

    it('returns undefined for an unknown key', () => {
      expect(IdentityMap.get(User, 99)).toBeUndefined()
    })

    it('returns undefined for key null', () => {
      const user = new User()
      IdentityMap.set(User, null, user)
      expect(IdentityMap.get(User, null)).toBeUndefined()
    })

    it('returns undefined for key undefined', () => {
      const user = new User()
      IdentityMap.set(User, undefined, user)
      expect(IdentityMap.get(User, undefined)).toBeUndefined()
    })

    it('isolates instances by class', () => {
      const user = new User()
      const post = new Post()
      IdentityMap.set(User, 1, user)
      IdentityMap.set(Post, 1, post)

      expect(IdentityMap.get(User, 1)).toBe(user)
      expect(IdentityMap.get(Post, 1)).toBe(post)
    })

    it('overwrites the existing instance for the same key', () => {
      const first = new User()
      const second = new User()
      first.id = 1
      second.id = 1

      IdentityMap.set(User, 1, first)
      IdentityMap.set(User, 1, second)

      expect(IdentityMap.get(User, 1)).toBe(second)
    })

    it('returns the instance directly from set', () => {
      const user = new User()
      user.id = 5

      const returned = IdentityMap.set(User, 5, user)
      expect(returned).toBe(user)
    })
  })

  describe('delete', () => {
    it('removes an entry by class and key', () => {
      const user = new User()
      user.id = 2
      IdentityMap.set(User, 2, user)
      IdentityMap.delete(User, 2)

      expect(IdentityMap.get(User, 2)).toBeUndefined()
    })

    it('does not throw when deleting a non-existent key', () => {
      expect(() => IdentityMap.delete(User, 999)).not.toThrow()
    })

    it('does not affect other keys in the same class', () => {
      const user1 = new User()
      const user2 = new User()
      user1.id = 1
      user2.id = 2
      IdentityMap.set(User, 1, user1)
      IdentityMap.set(User, 2, user2)

      IdentityMap.delete(User, 1)

      expect(IdentityMap.get(User, 1)).toBeUndefined()
      expect(IdentityMap.get(User, 2)).toBe(user2)
    })

    it('ignores delete for null key', () => {
      expect(() => IdentityMap.delete(User, null)).not.toThrow()
    })
  })

  describe('clear', () => {
    it('clears all entries when called without argument', () => {
      IdentityMap.set(User, 1, new User())
      IdentityMap.set(Post, 1, new Post())

      IdentityMap.clear()

      expect(IdentityMap.get(User, 1)).toBeUndefined()
      expect(IdentityMap.get(Post, 1)).toBeUndefined()
    })

    it('clears only the specified class', () => {
      const user = new User()
      const post = new Post()
      IdentityMap.set(User, 1, user)
      IdentityMap.set(Post, 1, post)

      IdentityMap.clear(User)

      expect(IdentityMap.get(User, 1)).toBeUndefined()
      expect(IdentityMap.get(Post, 1)).toBe(post)
    })
  })
})
