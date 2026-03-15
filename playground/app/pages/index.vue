<template>
  <div
    v-for="category in categories"
    :key="category.id"
  >
    <h2> {{ category.name }}</h2>
    <div
      v-for="product in category.products"
      :key="product.id"
    >
      {{ product.name }} - {{ product.price }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { Category } from '~/models/Category'
import { Product } from '../models/Product'

const categories = await Category.query().include('products', q => q.where('price', '>', 20)).get()
</script>
