<template>
  <div class="page">
    <h2>Products</h2>

    <table class="table">
      <thead>
        <tr>
          <th>ID</th>
          <th>Name</th>
          <th>Category</th>
          <th>Price</th>
          <th>action</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="product in products"
          :key="String(product.id)"
        >
          <td>{{ product.id }}</td>
          <td>{{ product.name }}</td>
          <td>{{ product.category.name ?? '-' }}</td>
          <td>{{ product.price ?? '-' }} $</td>
          <td>
            <button @click="editProduct(product)">
              Edit
            </button>
            <button @click="deleteProduct(product)">
              Delete
            </button>
          </td>
        </tr>
      </tbody>
    </table>

    <div class="pagination">
      <button
        :disabled="pagination.currentPage <= 1 || pagination.isLoading"
        @click="goToPage(pagination.currentPage - 1)"
      >
        Prev
      </button>

      <span>
        Page {{ pagination.currentPage }} / {{ pagination.lastPage }}
        ({{ pagination.from }}-{{ pagination.to }} / {{ pagination.total }})
      </span>

      <button
        :disabled="pagination.currentPage >= pagination.lastPage || pagination.isLoading"
        @click="goToPage(pagination.currentPage + 1)"
      >
        Next
      </button>
    </div>
  </div>
  <form @submit.prevent="saveEditedProduct">
    <h2>Product to edit</h2>
    <div v-if="productToEdit">
      <div>
        <label for="name">Name</label>
        <input
          id="name"
          v-model="editForm.name"
        >
      </div>
      <div>
        <label for="price">Price</label>
        <input
          id="price"
          v-model.number="editForm.price"
          type="number"
        >
      </div>
      <div>
        <label for="category">Category</label>
        <select
          id="category"
          v-model="editForm.categoryId"
        >
          <option
            disabled
            value=""
          >
            Select category
          </option>
          <option
            v-for="category in categories"
            :key="String(category.id)"
            :value="String(category.id)"
          >
            {{ category.name }}
          </option>
        </select>
      </div>
      <div class="edit-actions">
        <button
          type="submit"
          :disabled="isSaving"
        >
          Save
        </button>
        <button
          type="button"
          :disabled="isSaving"
          @click="cancelEdit"
        >
          Cancel
        </button>
      </div>
    </div>
    <div v-else>
      Select a product to edit.
    </div>
  </form>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Category } from '../models/Category'
import { Product } from '../models/Product'

defineOptions({
  name: 'ProductsTablePage',
})

const productToEdit = ref<Product | null>(null)
const isSaving = ref(false)
const editForm = ref({
  name: '',
  price: 0,
  categoryId: '',
})

type PaginationMeta = {
  current_page?: number
  last_page?: number
  total?: number
  from?: number
  to?: number
  per_page?: number
}

const products = ref<Product[]>([])
const categories = ref<Category[]>([])
const pagination = ref({
  currentPage: 1,
  lastPage: 1,
  total: 0,
  from: 0,
  to: 0,
  perPage: 10,
  isLoading: false,
})

const applyResponse = (rows: unknown, meta: Record<string, unknown>) => {
  const rawRows = Array.from(rows as Iterable<Record<string, unknown> | Product>)
  products.value = rawRows.map((row) => {
    return row instanceof Product ? row : Product.hydrate(row)
  })

  const metaPagination = meta as PaginationMeta
  const nextCurrentPage = metaPagination.current_page ?? 1
  const nextLastPage = metaPagination.last_page ?? 1
  const nextTotal = metaPagination.total ?? products.value.length
  const nextFrom = metaPagination.from ?? (products.value.length > 0 ? 1 : 0)
  const nextTo = metaPagination.to ?? products.value.length
  const nextPerPage = metaPagination.per_page ?? pagination.value.perPage

  pagination.value = {
    ...pagination.value,
    currentPage: nextCurrentPage,
    lastPage: nextLastPage,
    total: nextTotal,
    from: nextFrom,
    to: nextTo,
    perPage: nextPerPage,
  }
}

const loadCategories = async () => {
  const [rows] = await Category.query()
    .orderBy('name', 'asc')
    .limit(50)
    .get()

  categories.value = Array.from(rows as Iterable<Record<string, unknown> | Category>).map((row) => {
    return row instanceof Category ? row : Category.hydrate(row)
  })
}

const loadPage = async (page: number) => {
  pagination.value.isLoading = true
  try {
    const [rows, meta] = await Product.query()
      .include('category')
      .orderBy('id', 'asc')
      .limit(pagination.value.perPage)
      .getPage(page)

    applyResponse(rows, meta)
  }
  finally {
    pagination.value.isLoading = false
  }
}

const goToPage = async (page: number) => {
  if (page < 1 || page > pagination.value.lastPage || page === pagination.value.currentPage) {
    return
  }
  await loadPage(page)
}

const editProduct = (productLike: Product | Record<string, unknown>) => {
  const product = productLike as Product
  productToEdit.value = product
  editForm.value = {
    name: product.name,
    price: Number(product.price ?? 0),
    categoryId: product.category?.id ? String(product.category.id) : '',
  }
}

const cancelEdit = () => {
  productToEdit.value = null
  editForm.value = {
    name: '',
    price: 0,
    categoryId: '',
  }
}

const saveEditedProduct = async () => {
  if (!productToEdit.value) {
    return
  }

  isSaving.value = true
  try {
    const product = productToEdit.value
    productToEdit.value.name = editForm.value.name
    productToEdit.value.price = editForm.value.price

    const selectedCategory = categories.value.find(category => String(category.id) === editForm.value.categoryId)
    const currentCategoryId = product.category?.id ? String(product.category.id) : ''

    if (selectedCategory && currentCategoryId !== String(selectedCategory.id)) {
      product.category.attach(selectedCategory)
    }

    await productToEdit.value.save()
    cancelEdit()
  }
  finally {
    isSaving.value = false
  }
}

const deleteProduct = async (product: Product | Record<string, unknown>) => {
  await (product as Product).delete()
  await loadPage(pagination.value.currentPage)
}

const [initialRows, initialMeta] = await Product.query()
  .include('category')
  .orderBy('id', 'asc')
  .limit(pagination.value.perPage)
  .getPage(1)

await loadCategories()

applyResponse(initialRows, initialMeta)
</script>

<style scoped>
.page {
  padding: 16px;
}

.table {
  width: 100%;
  border-collapse: collapse;
}

.table th,
.table td {
  border: 1px solid #ddd;
  padding: 8px;
  text-align: left;
}

.pagination {
  margin-top: 12px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.edit-actions {
  margin-top: 10px;
  display: flex;
  gap: 8px;
}
</style>
