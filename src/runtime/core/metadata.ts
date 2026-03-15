import type { Model } from '../model/Model'

/* ======================================================
  METADATA STORAGE TYPES
====================================================== */
export type ValidatorFn = (value: any) => boolean | string

export type CastFn = (value: string | number | boolean | null) => any

export type FieldMeta = {
  name: string
  filterable?: boolean
  sortable?: boolean
  searchable?: boolean
  computed?: boolean
  castFn?: CastFn
  validators?: ValidatorFn[]
}
export type RelationMeta = {
  property: string
  target: () => typeof Model
  many?: boolean
  unique?: boolean
  pivot?: Record<string, FieldMeta>
}
export type ResourceMeta = {
  target: typeof Model
  endpoint: string
  limits: number[]
  key?: string
  fields: FieldMeta[]
  relations: RelationMeta[]
}

export const MetadataStorage = {
  resources: new Map<typeof Model, ResourceMeta>(),
  addResource(meta: ResourceMeta) {
    this.resources.set(meta.target, meta)
  },
  getResource(target: typeof Model): ResourceMeta {
    const res = this.resources.get(target)
    if (!res) throw new Error(`Resource ${target.name} not registered`)
    return res
  },
}
