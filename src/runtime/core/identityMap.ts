import type { Model } from '../model/Model'

type ModelConstructor<T extends Model = Model> = new () => T

type IdentityMapStore = Map<ModelConstructor, Map<unknown, Model>>

const clientStore: IdentityMapStore | null = import.meta.client ? new Map() : null

function getBucket<T extends Model>(modelClass: ModelConstructor<T>) {
  if (!clientStore) {
    return null
  }

  let bucket = clientStore.get(modelClass)
  if (!bucket) {
    bucket = new Map()
    clientStore.set(modelClass, bucket)
  }

  return bucket
}

export const IdentityMap = {
  get<T extends Model>(modelClass: ModelConstructor<T>, key: unknown): T | undefined {
    if (!clientStore || key === undefined || key === null) {
      return undefined
    }

    return clientStore.get(modelClass)?.get(key) as T | undefined
  },
  set<T extends Model>(modelClass: ModelConstructor<T>, key: unknown, instance: T): T {
    if (key === undefined || key === null) {
      return instance
    }

    getBucket(modelClass)?.set(key, instance)
    return instance
  },
  delete<T extends Model>(modelClass: ModelConstructor<T>, key: unknown): void {
    if (!clientStore || key === undefined || key === null) {
      return
    }

    clientStore.get(modelClass)?.delete(key)
  },
  clear<T extends Model>(modelClass?: ModelConstructor<T>): void {
    if (!clientStore) {
      return
    }

    if (!modelClass) {
      clientStore.clear()
      return
    }

    clientStore.delete(modelClass)
  },
}
