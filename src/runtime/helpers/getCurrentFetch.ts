import { useNuxtApp } from 'nuxt/app'

export default () => {
  const { $laravelRaom } = useNuxtApp()
  console.log('getCurrentFetch: $laravelRaom.fetch =', $laravelRaom?.fetch)
  return ($laravelRaom as { fetch: typeof $fetch })?.fetch as typeof $fetch ?? $fetch
}
