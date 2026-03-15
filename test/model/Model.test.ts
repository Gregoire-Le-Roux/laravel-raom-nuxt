import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Model } from '../../src/runtime/model/Model'
import { MetadataStorage } from '../../src/runtime/core/metadata'
import { IdentityMap } from '../../src/runtime/core/identityMap'

class User extends Model {
  id?: number
}

describe('Model', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    (globalThis as any).$fetch = vi.fn()
  })

  it('query/hydrate/create throw when model is not decorated', () => {
    expect(() => User.query()).toThrow('Must be decorated with @Resource')
    expect(() => User.hydrate({})).toThrow('Must be decorated with @Resource')
    expect(() => User.create({})).toThrow('Must be decorated with @Resource')
  })

  it('delete throws when key metadata is missing', async () => {
    vi.spyOn(MetadataStorage, 'getResource').mockReturnValue({
      target: User as any,
      endpoint: 'users',
      limits: [10],
      fields: [],
      relations: [],
    })

    const user = new User()
    await expect(user.delete()).rejects.toThrow('doesn\'t have a key field defined')
  })

  it('delete throws when key value is missing on instance', async () => {
    vi.spyOn(MetadataStorage, 'getResource').mockReturnValue({
      target: User as any,
      endpoint: 'users',
      limits: [10],
      key: 'id',
      fields: [],
      relations: [],
    })

    const user = new User()
    await expect(user.delete()).rejects.toThrow('Key field id is not set')
  })

  it('delete calls API and removes from identity map on success', async () => {
    const getResource = vi.spyOn(MetadataStorage, 'getResource').mockReturnValue({
      target: User as any,
      endpoint: 'users',
      limits: [10],
      key: 'id',
      fields: [],
      relations: [],
    })

    const idDeleteSpy = vi.spyOn(IdentityMap, 'delete').mockImplementation(() => { })
    const fetchMock = (globalThis as any).$fetch as ReturnType<typeof vi.fn>
    fetchMock.mockResolvedValue({})

    const user = new User()
    user.id = 42

    await expect(user.delete()).resolves.toBe(true)
    expect(user._isDeleted).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost/api/users',
      expect.objectContaining({
        method: 'DELETE',
      }),
    )
    expect(idDeleteSpy).toHaveBeenCalledWith(User as any, 42)
    expect(getResource).toHaveBeenCalled()
  })

  it('delete resets _isDeleted to false when request fails', async () => {
    vi.spyOn(MetadataStorage, 'getResource').mockReturnValue({
      target: User as any,
      endpoint: 'users',
      limits: [10],
      key: 'id',
      fields: [],
      relations: [],
    })

    const fetchMock = (globalThis as any).$fetch as ReturnType<typeof vi.fn>
    fetchMock.mockRejectedValue(new Error('network error'))

    const user = new User()
    user.id = 42

    await expect(user.delete()).rejects.toThrow('network error')
    expect(user._isDeleted).toBe(false)
  })

  it('hasMany returns relation object with attach method', () => {
    class Post extends Model { }
    const user = new User()
    const relation = user.hasMany(Post as any, 'posts')
    expect(relation).toBeDefined()
    expect(typeof (relation as any).attach).toBe('function')
    expect(() => (relation as any).attach(new Post())).not.toThrow()
  })
})
