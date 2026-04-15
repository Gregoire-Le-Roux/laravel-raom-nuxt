import { defineNuxtPlugin } from '#app'
import { PayloadCache } from './cache/payloadCache'

export default defineNuxtPlugin((_nuxtApp) => {
  if (import.meta.server) {
    PayloadCache.clear()

    _nuxtApp.hook('app:rendered', () => {
      if (!_nuxtApp.payload.data) {
        _nuxtApp.payload.data = {}
      }

      _nuxtApp.payload.data['laravel-rest-api:cache'] = PayloadCache.serialize()

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
