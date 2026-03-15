# Laravel REST API Nuxt SDK (ORM-like) 🚀

TypeScript SDK for Nuxt, inspired by ORM ergonomics, built to talk to APIs exposed by `lomkit/laravel-rest-api`.

Goal: provide a model + query + relations developer experience that feels natural in frontend apps while staying aligned with Laravel REST API conventions.

## Why an ORM-like Architecture for REST APIs?

Traditional ORMs let models communicate with a database through SQL abstractions.
This SDK applies the same idea to REST resources: models communicate with an HTTP API instead of a DB.

The transport changes (SQL -> HTTP), but the developer model stays familiar:
- domain models
- relations
- query builder
- identity map consistency

This gives a clean, testable, and framework-friendly architecture where business logic is expressed through models, while network details remain an infrastructure concern.

## Packaging Direction 📦

Today, this project is implemented as a Nuxt module.

Long-term, the target architecture is:

- a framework-agnostic core package (SDK)
- a Nuxt integration module on top of that core

This split is intended to make the SDK usable across JavaScript frameworks while keeping first-class Nuxt DX.

## Vision ✨

This project is designed to provide:

- 🧩 A decorator-based model system (`@Resource`, `@Field`, `@Key`, `@Relation`)
- 🗺️ An Identity Map so one resource key = one in-memory model instance
- 🔎 An expressive, typed Query Builder
- 🧪 A fake query mode (`User.fake().findByKey(1)`) for dev/tests without a backend
- 🔄 Implicit model + relation mutations (`user.firstname = 'test'; await user.save(); await user.Posts().attach(post)`)
- 🧬 Morph relation support (polymorphic relationships)

## Current Status ⚠️

Nothing should be considered officially available yet.

Even if parts of the foundation exist in code, the SDK is still pre-alpha and not validated by a complete automated test suite.

- ❌ No feature is marked production-ready yet
- 🧱 Core architecture exists
- 🧪 Test coverage and feature validation are still in progress

## Usage Example (Target API) 🛠️

Relation metadata is intentionally minimal on the SDK side: we only need to know whether a relation is `many` or `single`.

```ts
import { Model } from 'my-module/runtime/model/Model'
import { Resource, Field, Key, Relation } from 'my-module/runtime/core/decorators'

@Resource('users', { limits: [1, 10, 25, 50] })
class User extends Model {
  @Key()
  @Field()
  id!: number

  @Field()
  firstname!: string

  @Field()
  lastname!: string

  @Relation(() => Post, { many: true })
  Posts() {
    return this.hasMany(Post, 'posts')
  }
}

@Resource('posts')
class Post extends Model {
  @Key()
  @Field()
  id!: number

  @Field()
  title!: string
}
```

```ts
const user = await User.query()
  .where('firstname', 'like', 'Eli%')
  .include('Posts', q => q.orderBy('id', 'desc'))
  .findByKey(1)

user.firstname = 'Test'
await user.save()

const post = Post.create({ title: 'Hello' })
await user.Posts().attach(post)
```

## Why Identity Map Matters 🧠

Without Identity Map, multiple API calls can create multiple JavaScript instances for the same resource.

With Identity Map:

- ✅ One primary key maps to one instance in memory
- ✅ Mutations are visible everywhere in the app
- ✅ Hydration can reuse existing instances for consistency

## Fake Mode (Vision) 🎭

Fake mode should keep the exact same read/write API, but without network calls.

Target usage:

```ts
await User.query().findByKey(1)
await User.fake().findByKey(1)
```

Expected benefits:

- ⚡ Frontend development without a live backend
- ✅ Fast unit/integration tests
- 🎯 Deterministic scenarios using factories

## Product Roadmap 🗺️

### Phase 1 - Solid Core

1. Finalize and validate decorator metadata behavior
2. Finalize hydration + Identity Map sync (including included relations)
3. Standardize HTTP client layer (base URL, auth, interceptors, error normalization)

### Phase 2 - ORM Mutations

1. Implement `save()` with dirty tracking
2. Implement create/update/delete lifecycle consistency
3. Implement relation mutation operations (`attach`, `detach`, `sync`)

### Phase 3 - Relation System

1. Stabilize relation metadata around `many` vs `single`
2. Add morph relation support (`morphTo`, `morphMany`, `morphOne`) semantics
3. Ensure relation hydration + mutation parity across all relation kinds

### Phase 4 - Fake Engine

1. Implement `fake()` and `FakeQueryBuilder`
2. Add in-memory factories/seeders
3. Guarantee API parity between real and fake modes

### Phase 5 - DX & Quality

1. Strong autocomplete for fields and relations
2. Debug tooling (payload trace, hooks, optional devtools integration)
3. Comprehensive automated tests (unit + integration + payload snapshots)

### Phase 6 - Production Readiness

1. Query caching + smart invalidation
2. Optimistic UI + rollback strategies
3. Pagination completeness + revalidation strategies

## Additional Feature Ideas 💡

- Offline-first mutation queue + replay
- Lifecycle events (`beforeSave`, `afterHydrate`, `afterDelete`)
- Local policy/gate pre-check helpers for UX
- Typed Laravel error normalization
- Model code generation from API schema/resources
- Optional SSR-safe cache hydration strategy

## Installation 📦

```bash
npx nuxt module add my-module
```

## Local Development 👩‍💻

```bash
# Install dependencies
npm install

# Prepare module stubs
npm run dev:prepare

# Playground
npm run dev
npm run dev:build

# Quality checks
npm run lint
npm run test
npm run test:watch
```

## Contributing 🤝

Contributions are welcome, especially around:

- implicit model mutations
- fake engine + factories
- relation system and morph support
- query builder robustness
- integration tests with `lomkit/laravel-rest-api`
