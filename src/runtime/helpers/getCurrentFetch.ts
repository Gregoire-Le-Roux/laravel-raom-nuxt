import { useNuxtApp } from 'nuxt/app'

export default () => {
  const { $laravelRaom } = useNuxtApp()
  return ($laravelRaom as { fetch: typeof $fetch })?.fetch as typeof $fetch ?? $fetch
}
