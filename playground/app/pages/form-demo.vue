<template>
  <div style="max-width: 600px; margin: 40px auto; font-family: sans-serif;">
    <h1>Product form demo</h1>

    <!-- ─────────────────────────────────────────────────────────────
      The form itself — notice there's no local ref(), no v-model mess,
      no manual state. Just v-bind on each field and you're done.
    ───────────────────────────────────────────────────────────────── -->
    <form @submit.prevent="handleSubmit">
      <fieldset :disabled="isSubmitting" style="border: none; padding: 0;">

        <div style="margin-bottom: 12px;">
          <label>Name</label><br />
          <!--
            v-bind spreads { modelValue, onUpdate:modelValue } onto the input.
            The form state updates automatically — no extra ref needed.
          -->
          <input
            v-bind="form.field('name')"
            data-test-id="product-form-name"
            type="text"
            placeholder="Product name"
            style="width: 100%; padding: 8px;"
          />
        </div>

        <div style="margin-bottom: 12px;">
          <label>Price</label><br />
          <input
            v-bind="form.field('price')"
            data-test-id="product-form-price"
            type="number"
            min="0"
            style="width: 100%; padding: 8px;"
          />
        </div>

        <div style="margin-bottom: 12px;">
          <label>Description</label><br />
          <textarea
            v-bind="form.field('description')"
            data-test-id="product-form-description"
            rows="3"
            style="width: 100%; padding: 8px;"
          />
        </div>

        <div style="display: flex; gap: 8px; margin-top: 16px;">
          <button
            data-test-id="product-form-submit"
            type="submit"
            :disabled="isSubmitting"
          >
            {{ isEditing ? 'Update' : 'Create' }}
          </button>

          <!--
            reset() wipes all fields back to the model's default values.
            In edit mode, it also clears the "editing" state.
          -->
          <button
            data-test-id="product-form-reset"
            type="button"
            @click="handleCancel"
          >
            Cancel
          </button>
        </div>

        <p
          v-if="feedback"
          data-test-id="product-form-feedback"
          :data-test-state="feedbackState"
          style="margin-top: 12px;"
        >
          {{ feedback }}
        </p>
      </fieldset>
    </form>

    <!-- ─────────────────────────────────────────────────────────────
      Product list — clicking "Edit" fills the form with existing data.
      This is where fill() shines: one call loads everything.
    ───────────────────────────────────────────────────────────────── -->
    <hr style="margin: 32px 0;" />
    <h2>Existing products</h2>

    <div
      v-for="product in products"
      :key="product.id"
      data-test-class="product-list-row"
      style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee;"
    >
      <span>{{ product.name }} — {{ product.price }}€</span>
      <div style="display: flex; gap: 8px;">
        <button
          :data-test-id="`product-edit-${product.id}`"
          @click="handleEdit(product)"
        >
          Edit
        </button>
        <button
          :data-test-id="`product-delete-${product.id}`"
          @click="handleDelete(product)"
        >
          Delete
        </button>
      </div>
    </div>

    <p
      v-if="products.length === 0"
      data-test-state="empty"
    >
      No products yet.
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Product } from '~/models/Product'
import { useModelForm } from '../../../src/runtime/form/useModelForm'

// ─── Form setup ───────────────────────────────────────────────────────────────
//
// useModelForm reads the @Field metadata on Product and builds a reactive
// state from the model's default values. Nothing else to configure.
//
const form = useModelForm(Product)

// We track which product we're editing (null = create mode)
const editingId = ref<string | null>(null)
const isEditing = computed(() => editingId.value !== null)

const isSubmitting = ref(false)
const feedback = ref('')
const feedbackState = ref<'success' | 'error'>('success')

// ─── Mock data (replace with Product.query().get() in a real app) ─────────────
const products = ref<Product[]>([
  Product.create({ id: '1', name: 'Mechanical Keyboard', price: 129, description: 'Cherry MX Red switches' }),
  Product.create({ id: '2', name: 'USB-C Hub', price: 49, description: '7 ports' }),
])

// ─── Create or update ─────────────────────────────────────────────────────────
async function handleSubmit(): Promise<void> {
  isSubmitting.value = true
  feedback.value = ''

  try {
    if (isEditing.value) {
      // Edit mode — send only the @Field values, _isDeleted and internals are excluded
      await Product.write().update(editingId.value!, form.payload()).run()
      feedback.value = 'Product updated.'
    } else {
      // Create mode — form.payload() returns only declared @Field fields
      await Product.write().create(form.payload()).run()
      feedback.value = 'Product created.'
    }

    feedbackState.value = 'success'
    handleCancel()
  } catch {
    feedback.value = 'Something went wrong.'
    feedbackState.value = 'error'
  } finally {
    isSubmitting.value = false
  }
}

// ─── Switch to edit mode ──────────────────────────────────────────────────────
//
// fill() hydrates the form with an existing instance in one call.
// No need to manually set each field — the form just mirrors the product.
//
function handleEdit(product: Product): void {
  editingId.value = product.id
  form.fill(product)
}

// ─── Cancel / reset ───────────────────────────────────────────────────────────
function handleCancel(): void {
  editingId.value = null
  form.reset()
  feedback.value = ''
}

// ─── Delete ───────────────────────────────────────────────────────────────────
async function handleDelete(product: Product): Promise<void> {
  await product.delete()
}
</script>
