import { MetadataStorage } from '../core/metadata'
import type { Model } from '../model/Model'

/**
 * Extracts only the data attributes of a model, excluding internal framework
 * properties and methods. Used to type write operation payloads.
 */
export type ModelAttributes<T extends Model> = {
  [K in keyof T as K extends '_isDeleted'
    ? never
    : T[K] extends (...args: unknown[]) => unknown
      ? never
      : K]?: T[K]
}

type CreateOperation<T extends Model> = {
  operation: 'create'
  attributes: ModelAttributes<T>
  relations?: Record<string, unknown>
}

type UpdateOperation<T extends Model> = {
  operation: 'update'
  key: string | number
  attributes: ModelAttributes<T>
  relations?: Record<string, unknown>
}

type DeleteOperation = {
  operation: 'delete'
  key: string | number
}

type WriteOperation<T extends Model> = CreateOperation<T> | UpdateOperation<T> | DeleteOperation

interface WritePayload<T extends Model> {
  mutate: WriteOperation<T>[]
}

/** Response shape from POST /api/{endpoint}/mutate */
export interface WriteResult {
  created: Array<Record<string, unknown>>
  updated: Array<Record<string, unknown>>
  deleted: Array<string | number>
}

/**
 * Fluent builder for write operations (create, update, delete).
 * Mirrors the QueryBuilder API for read/write symmetry.
 *
 * @example
 * await Product.write().create({ name: 'Laptop', price: 999 }).run()
 * await Product.write().update(1, { price: 899 }).run()
 * await Product.write().delete(1).run()
 */
export class WriteBuilder<T extends Model> {
  private readonly endpoint: string
  private readonly operations: WriteOperation<T>[] = []

  constructor(resourceClass: new () => T) {
    this.endpoint = MetadataStorage.getResource(resourceClass).endpoint
  }

  /**
   * Queues a create operation with the given attributes.
   */
  create(attributes: ModelAttributes<T>, relations?: Record<string, unknown>): this {
    const operation: CreateOperation<T> = { operation: 'create', attributes }
    if (relations) operation.relations = relations
    this.operations.push(operation)
    return this
  }

  /**
   * Queues an update operation for the resource identified by key.
   */
  update(key: string | number, attributes: ModelAttributes<T>, relations?: Record<string, unknown>): this {
    const operation: UpdateOperation<T> = { operation: 'update', key, attributes }
    if (relations) operation.relations = relations
    this.operations.push(operation)
    return this
  }

  /**
   * Queues a delete operation for the resource identified by key.
   */
  delete(key: string | number): this {
    this.operations.push({ operation: 'delete', key })
    return this
  }

  private buildPayload(): WritePayload<T> {
    if (this.operations.length === 0) {
      throw new Error('WriteBuilder: no operations queued before run()')
    }
    return { mutate: this.operations }
  }

  /**
   * Sends all queued operations to POST /api/{endpoint}/mutate.
   */
  async run(): Promise<WriteResult> {
    const payload = this.buildPayload()
    return $fetch<WriteResult>(`http://localhost/api/${this.endpoint}/mutate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  }
}
