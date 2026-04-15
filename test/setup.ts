import { vi } from 'vitest'

vi.mock('nuxt/app', () => ({
    useNuxtApp: () => ({ $laravelRaom: undefined }),
}))
