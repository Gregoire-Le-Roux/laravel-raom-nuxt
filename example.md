# Exemple complet — du backend au formulaire

Ce guide te montre le flux complet : définir un modèle, interroger l'API, et gérer un formulaire de création et d'édition. Chaque fichier est complet et autonome — tu peux le copier tel quel.

---

## Ce que le backend expose

On part du principe que ton API Laravel est construite avec [lomkit/laravel-rest-api](https://github.com/lomkit/laravel-rest-api).

Elle expose trois endpoints par ressource :

```
POST   /api/products/search   → chercher des produits
POST   /api/products/mutate   → créer, modifier, supprimer
DELETE /api/products          → suppression directe par clé
```

Une réponse de `search` ressemble à ça :

```json
{
  "data": [
    { "id": 1, "name": "Clavier mécanique", "price": 129, "description": "Switches Cherry MX Red" },
    { "id": 2, "name": "Hub USB-C", "price": 49, "description": "7 ports" }
  ]
}
```

---

## Fichier 1 — Le modèle

C'est la **seule fois** où tu décris ta ressource. Tout le reste — requêtes, formulaires, typage TypeScript — se dérive automatiquement de là.

```typescript
// models/Product.ts

import { Field, Key, Model, Resource } from 'laravel-raom'

@Resource('products', { limits: [10, 25, 50] })
export class Product extends Model {
  // La clé primaire — utilisée pour les updates et les deletes
  @Key()
  @Field()
  id: number = 0

  // Les champs déclarés avec @Field sont les seuls
  // qui apparaîtront dans les payloads et les formulaires
  @Field()
  name: string = ''

  @Field()
  price: number = 0

  @Field()
  description: string = ''
}
```

---

## Fichier 2 — La page liste

On récupère les données depuis l'API avec `query()`. Chaque élément retourné est une vraie instance `Product`, avec ses méthodes disponibles directement.

```vue
<!-- pages/products/index.vue -->

<template>
  <div>
    <h1>Produits</h1>

    <NuxtLink to="/products/create">Nouveau produit</NuxtLink>

    <div v-if="products.length === 0">
      Aucun produit pour le moment.
    </div>

    <table v-else>
      <thead>
        <tr>
          <th>Nom</th>
          <th>Prix</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="product in products" :key="product.id">
          <td>{{ product.name }}</td>
          <td>{{ product.price }}€</td>
          <td>
            <NuxtLink :to="`/products/${product.id}/edit`">Modifier</NuxtLink>
            <button @click="handleDelete(product)">Supprimer</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { Product } from '~/models/Product'

// query() appelle POST /api/products/search avec le payload construit
// et retourne un ModelList<Product> — une liste de vraies instances typées
const products = await Product.query()
  .orderBy('name', 'asc')
  .get()

async function handleDelete(product: Product): Promise<void> {
  // delete() appelle DELETE /api/products { resources: [id] }
  // et retire automatiquement l'instance de l'identity map
  await product.delete()
}
</script>
```

---

## Fichier 3 — Le formulaire de création

`useModelForm` lit les `@Field` de ton modèle et te donne un état réactif, initialisé avec les valeurs par défaut. Tu bindes chaque champ avec `v-bind` — pas de `ref()` à déclarer toi-même.

Les règles de validation restent dans le template — le SDK ne les connaît pas, c'est voulu. Les responsabilités sont séparées.

```vue
<!-- pages/products/create.vue -->

<template>
  <div>
    <h1>Nouveau produit</h1>

    <form @submit.prevent="handleSubmit">

      <div>
        <label for="name">Nom</label>
        <!--
          form.field('name') retourne { modelValue, onUpdate:modelValue }
          v-bind le spread directement sur l'input — l'état se met à jour tout seul
          TypeScript refuse form.field('xxx') si 'xxx' n'existe pas sur Product
        -->
        <input
          id="name"
          v-bind="form.field('name')"
          type="text"
          placeholder="Nom du produit"
          required
        />
      </div>

      <div>
        <label for="price">Prix</label>
        <input
          id="price"
          v-bind="form.field('price')"
          type="number"
          min="0"
          step="0.01"
          required
        />
      </div>

      <div>
        <label for="description">Description</label>
        <textarea
          id="description"
          v-bind="form.field('description')"
          rows="4"
          placeholder="Description du produit"
        />
      </div>

      <div>
        <button type="submit" :disabled="isSubmitting">
          Créer le produit
        </button>
        <button type="button" @click="form.reset()">
          Réinitialiser
        </button>
      </div>

      <p v-if="error">{{ error }}</p>

    </form>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Product } from '~/models/Product'
import { useModelForm } from 'laravel-raom'

const router = useRouter()
const isSubmitting = ref(false)
const error = ref('')

// useModelForm initialise l'état avec les valeurs par défaut de Product
// name: '', price: 0, description: '' — tout est prêt
const form = useModelForm(Product)

async function handleSubmit(): Promise<void> {
  isSubmitting.value = true
  error.value = ''

  try {
    // form.payload() retourne uniquement les champs @Field
    // _isDeleted et les méthodes internes sont exclus automatiquement
    //
    // Ce qui part à l'API :
    // { mutate: [{ operation: 'create', attributes: { name: '...', price: 0, description: '...' } }] }
    await Product.write().create(form.payload()).run()

    router.push('/products')
  } catch {
    error.value = 'Une erreur est survenue, réessaie.'
  } finally {
    isSubmitting.value = false
  }
}
</script>
```

---

## Fichier 4 — Le formulaire d'édition

La différence avec la création : on charge les données existantes avec `form.fill()` au montage, et on appelle `.update()` au lieu de `.create()`.

```vue
<!-- pages/products/[id]/edit.vue -->

<template>
  <div>
    <h1>Modifier le produit</h1>

    <form @submit.prevent="handleSubmit">

      <div>
        <label for="name">Nom</label>
        <!--
          Même binding qu'en création — form.fill() a déjà chargé
          la valeur existante, l'input l'affiche directement
        -->
        <input
          id="name"
          v-bind="form.field('name')"
          type="text"
          required
        />
      </div>

      <div>
        <label for="price">Prix</label>
        <input
          id="price"
          v-bind="form.field('price')"
          type="number"
          min="0"
          step="0.01"
          required
        />
      </div>

      <div>
        <label for="description">Description</label>
        <textarea
          id="description"
          v-bind="form.field('description')"
          rows="4"
        />
      </div>

      <div>
        <button type="submit" :disabled="isSubmitting">
          Enregistrer
        </button>
        <NuxtLink to="/products">Annuler</NuxtLink>
      </div>

      <p v-if="error">{{ error }}</p>

    </form>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Product } from '~/models/Product'
import { useModelForm } from 'laravel-raom'

const route = useRoute()
const router = useRouter()
const isSubmitting = ref(false)
const error = ref('')

// On récupère le produit depuis l'API
const product = await Product.query().findByKey(route.params.id)

const form = useModelForm(Product)

// fill() charge toutes les valeurs de l'instance dans le formulaire en un appel
// Pas besoin de faire form.field('name').value = product.name pour chaque champ
form.fill(product)

async function handleSubmit(): Promise<void> {
  isSubmitting.value = true
  error.value = ''

  try {
    // update() prend la clé primaire et les attributs modifiés
    //
    // Ce qui part à l'API :
    // { mutate: [{ operation: 'update', key: 1, attributes: { name: '...', price: 0, description: '...' } }] }
    await Product.write().update(product.id, form.payload()).run()

    router.push('/products')
  } catch {
    error.value = 'Une erreur est survenue, réessaie.'
  } finally {
    isSubmitting.value = false
  }
}
</script>
```

---

## Résumé

Le modèle est le seul endroit où tu décris ta ressource — tout part de là. Le `QueryBuilder` s'en sert pour lire, le `WriteBuilder` pour écrire, et `useModelForm` pour binder le formulaire. Chacun fait une seule chose et ne connaît pas les autres. Tu n'as pas à répéter la structure de tes données à plusieurs endroits, et TypeScript te protège à chaque étape.
