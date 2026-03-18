import { reactive } from 'vue'
import { MetadataStorage } from '../core/metadata'
import type { Model } from '../model/Model'
import type { FieldBinding, ModelForm } from './types'

/**
 * Creates a reactive form state bound to a model class.
 *
 * The form state is initialized from the model's default values (empty constructor).
 * `field()` returns v-model compatible bindings typed to the model's property types,
 * making it impossible to bind to a field that does not exist on the model.
 *
 * Validation rules and labels are intentionally left to the UI layer — pass them
 * directly on the input component alongside `v-bind="form.field('name')"`.
 *
 * @param ModelClass - A class decorated with @Resource
 * @returns A typed form API: field(), fill(), payload(), reset()
 *
 * @example
 * const form = useModelForm(Product)
 *
 * // Create — in template:
 * // <v-text-field v-bind="form.field('name')" label="Name" :rules="[required()]" />
 * // On submit: await Product.write().create(form.payload()).run()
 *
 * // Edit — hydrate from existing instance:
 * // form.fill(existingProduct)
 * // On submit: await Product.write().update(existingProduct.id, form.payload()).run()
 */
export function useModelForm<T extends Model>(ModelClass: new () => T): ModelForm<T> {
  const defaults = new ModelClass()
  const meta = MetadataStorage.getResource(ModelClass as unknown as typeof Model)

  /** Field names declared with @Field — used to scope payload() to declared fields only */
  const fieldNames = new Set([
    meta.key,
    ...meta.fields.map(f => f.name),
  ].filter((k): k is string => k !== undefined))

  /** Reactive copy of the model's own enumerable properties (class fields only, no prototype methods) */
  const state = reactive(Object.assign({}, defaults)) as T

  function field<K extends keyof T>(key: K): FieldBinding<T[K]> {
    return {
      modelValue: state[key],
      'onUpdate:modelValue': (value: T[K]) => {
        state[key] = value
      },
    }
  }

  function fill(instance: Partial<T>): void {
    Object.assign(state, instance)
  }

  function payload(): Partial<T> {
    return Object.fromEntries(
      Object.entries(state).filter(([key]) => fieldNames.has(key)),
    ) as Partial<T>
  }

  function reset(): void {
    Object.assign(state, new ModelClass())
  }

  return { field, fill, payload, reset }
}
