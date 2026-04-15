import { defineNuxtPlugin } from '#app'
import { PayloadCache } from './cache/payloadCache'

export default defineNuxtPlugin((_nuxtApp) => {
  console.log('Plugin injected by laravel-rest-api-nuxt')
  if (import.meta.server) {
    // Start each SSR request with a clean cache.
    PayloadCache.clear()

    _nuxtApp.hook('app:rendered', () => {
      if (!_nuxtApp.payload.data) {
        _nuxtApp.payload.data = {}
      }

      _nuxtApp.payload.data['laravel-rest-api:cache'] = PayloadCache.serialize()

      // Invalidate server cache right after payload handoff.
      PayloadCache.clear()
    })
  }
  else {
    const cached = _nuxtApp.payload.data?.['laravel-rest-api:cache']
    if (cached && Array.isArray(cached)) {
      PayloadCache.restore(cached)
    }
  }

})
