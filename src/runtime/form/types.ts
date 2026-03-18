/**
 * Props passed to a v-model compatible input component.
 * Compatible with Vuetify's v-text-field, v-select, v-checkbox, etc.
 */
export interface FieldBinding<T> {
  modelValue: T
  'onUpdate:modelValue': (value: T) => void
}

/**
 * Public API returned by useModelForm.
 */
export interface ModelForm<T> {
  /**
   * Returns v-model compatible bindings for the given field.
   * Spread directly onto any Vuetify input: `v-bind="form.field('name')"`.
   *
   * @param key - A field name that exists on the model
   */
  field<K extends keyof T>(key: K): FieldBinding<T[K]>

  /**
   * Hydrates the form state from an existing model instance.
   * Use this for edit forms where you want to prefill with existing data.
   *
   * @param instance - An existing model instance or partial data
   */
  fill(instance: Partial<T>): void

  /**
   * Returns the current form state as a plain object, ready to pass
   * to WriteBuilder.create() or WriteBuilder.update().
   */
  payload(): Partial<T>

  /**
   * Resets all fields to the model's default values (empty constructor).
   */
  reset(): void
}
