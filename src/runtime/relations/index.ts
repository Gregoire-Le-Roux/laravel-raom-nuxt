import type { Model } from '../model/Model'
import { RelationBuilderBase } from './base'
import { BelongsToBuilder, HasOneBuilder, type BelongsToOptions, type HasOneOptions } from './single'
import { BelongsToManyBuilder, HasManyBuilder, type BelongsToManyOptions, type HasManyOptions } from './many'

export type BelongsTo<T extends Model> = BelongsToBuilder<T> & T
export function BelongsTo<T extends Model>(
    targetFn: () => new () => T,
    relationName: string,
    options?: BelongsToOptions,
): BelongsTo<T> {
    return new BelongsToBuilder(targetFn, relationName, options) as unknown as BelongsTo<T>
}

export type BelongsToMany<T extends Model> = BelongsToManyBuilder<T> & T[]
export function BelongsToMany<T extends Model>(
    targetFn: () => new () => T,
    relationName: string,
    options?: BelongsToManyOptions,
): BelongsToMany<T> {
    return new BelongsToManyBuilder(targetFn, relationName, options) as unknown as BelongsToMany<T>
}

export type HasOne<T extends Model> = HasOneBuilder<T> & T
export function HasOne<T extends Model>(
    targetFn: () => new () => T,
    relationName: string,
    options?: HasOneOptions,
): HasOne<T> {
    return new HasOneBuilder(targetFn, relationName, options) as unknown as HasOne<T>
}

export type HasMany<T extends Model> = HasManyBuilder<T> & T[]
export function HasMany<T extends Model>(
    targetFn: () => new () => T,
    relationName: string,
    options?: HasManyOptions,
): HasMany<T> {
    return new HasManyBuilder(targetFn, relationName, options) as unknown as HasMany<T>
}


export function isRelationBuilder(value: unknown): value is RelationBuilderBase {
    return value instanceof RelationBuilderBase
}
