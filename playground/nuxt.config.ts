export default defineNuxtConfig({
  modules: ['my-module'],
  devtools: { enabled: true },
  experimental: {
    decorators: true,
  },
  compatibilityDate: 'latest',
  myModule: {},
})
