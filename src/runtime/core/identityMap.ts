import type { Ref } from '#imports'
import type { Model, SharedMeta } from '../model/Model'

type ModelConstructor<T extends Model = Model> = new () => T

type IdentityMapStore = Map<ModelConstructor, Map<unknown, Record<string, unknown>>>

export type IdentityMapEntry = {
  key: unknown
  value: Record<string, unknown>
}

export type IdentityMapGroup = {
  model: string
  count: number
  entries: IdentityMapEntry[]
}

type IdentityMapData = {
  fields: Record<string, unknown>
  sharedMeta: SharedMeta
}

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

function serialize(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value
  }

  if (Array.isArray(value)) {
    return value.map(item => serialize(item))
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    return Object.fromEntries(
      Object.entries(obj)
        .filter(([, v]) => typeof v !== 'function')
        .map(([k, v]) => [k, serialize(v)]),
    )
  }

  return value
}

export const IdentityMap = {
  get<T extends Model>(modelClass: ModelConstructor<T>, key: unknown): IdentityMapData | undefined {
    if (!clientStore || key === undefined || key === null) {
      return undefined
    }
    return getBucket(modelClass)?.get(key) as IdentityMapData | undefined
  },
  set<T extends Model>(modelClass: ModelConstructor<T>, key: unknown, shared: IdentityMapData): IdentityMapData {
    if (key === undefined || key === null) {
      return shared
    }
    getBucket(modelClass)?.set(key, shared)
    return shared
  },
  delete<T extends Model>(modelClass: ModelConstructor<T>, key: unknown): void {
    if (!clientStore || key === undefined || key === null) {
      return
    }

    getBucket(modelClass)?.delete(key)
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
  inspectByModel(): IdentityMapGroup[] {
    if (!clientStore) {
      return []
    }

    const groups: IdentityMapGroup[] = []

    for (const [modelClass, fieldEntries] of clientStore.entries()) {
      const entries: IdentityMapEntry[] = []

      for (const [key, fields] of fieldEntries.entries()) {
        entries.push({
          key,
          value: serialize(fields) as Record<string, unknown>,
        })
      }

      groups.push({
        model: modelClass.name,
        count: entries.length,
        entries,
      })
    }

    return groups.sort((a, b) => a.model.localeCompare(b.model))
  },
}
