import { MetadataStorage } from '../core/metadata'
import { Model } from './Model'

export class DraftModel<T extends Model> extends Model {
  private readonly source: T

  constructor(source: T, draftData: Record<string, unknown>) {
    super()
    this.source = source
    Object.assign(this as unknown as Record<string, unknown>, draftData)
  }

  commit(): T {
    const modelClass = this.source.constructor as unknown as typeof Model
    const meta = MetadataStorage.getResource(modelClass)
    const sourceRecord = this.source as unknown as Record<string, unknown>
    const draftRecord = this as unknown as Record<string, unknown>

    for (const field of meta.fields) {
      sourceRecord[field.name] = draftRecord[field.name]
    }

    for (const relation of meta.relations) {
      sourceRecord[relation.property] = draftRecord[relation.property]
    }

    return this.source
  }

  discard(): T {
    return this.source
  }

  async save(): Promise<T> {
    this.commit()
    return this.source
  }
}
