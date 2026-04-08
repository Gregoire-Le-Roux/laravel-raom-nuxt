export default defineNuxtConfig({
  modules: ['../src/module'],
  devtools: { enabled: true },
  experimental: {
    decorators: true,
  },
  compatibilityDate: 'latest',
})
