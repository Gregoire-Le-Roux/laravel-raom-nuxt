/**
 * Payload cache for SSR dedupe and SSR → client transfer.
 * Populated during SSR, serialized into the Nuxt payload, and restored on
 * the client so the first hydration doesn't re-fetch. Entries are
 * invalidated per-resource on mutate/delete.
 */

export interface CacheEntry {
  url: string
  method: string
  body?: unknown
  data: unknown
  timestamp: number
}

let payloadCache: CacheEntry[] = []
let cacheEnabled = true

export const PayloadCache = {
  /**
   * Generate a deterministic key from URL + method + body
   */
  generateKey(url: string, method: string, body?: unknown): string {
    const combined = JSON.stringify({ url, method, body: body || null })
    return Buffer.from(combined).toString('base64')
  },

  /**
   * Register a request/response pair
   */
  register(url: string, method: string, data: unknown, body?: unknown): void {
    if (!cacheEnabled) return

    payloadCache.push({
      url,
      method,
      body,
      data,
      timestamp: Date.now(),
    })
  },

  /**
   * Look up cached data by URL + method + body
   */
  lookup(url: string, method: string, body?: unknown): unknown | null {
    if (!cacheEnabled) return null

    // Find the first matching entry
    for (const entry of payloadCache) {
      if (
        entry.url === url
        && entry.method === method
        && JSON.stringify(entry.body) === JSON.stringify(body ?? null)
      ) {
        return entry.data
      }
    }

    return null
  },

  /**
   * Get all cached entries
   */
  getAll(): CacheEntry[] {
    return [...payloadCache]
  },

  /**
   * Clear the cache
   */
  clear(): void {
    payloadCache = []
  },

  /**
   * Enable/disable caching
   */
  setEnabled(enabled: boolean): void {
    cacheEnabled = enabled
  },

  /**
   * Drop every entry whose URL targets the given resource endpoint
   * (search, details, mutate, delete, actions…). Called after any write
   * so the next read on the same resource hits the network.
   */
  invalidate(endpoint: string): void {
    payloadCache = payloadCache.filter(
      entry => entry.url !== endpoint && !entry.url.startsWith(`${endpoint}/`),
    )
  },

  /**
   * Serialize cache for payload transfer (SSR → client)
   */
  serialize(): Array<{ url: string, method: string, body?: unknown, data: unknown }> {
    return payloadCache.map(entry => ({
      url: entry.url,
      method: entry.method,
      body: entry.body,
      data: entry.data,
    }))
  },

  /**
   * Restore cache from payload (client-side hydration)
   */
  restore(entries: Array<{ url: string, method: string, body?: unknown, data: unknown }>): void {
    payloadCache = entries.map(e => ({
      ...e,
      timestamp: Date.now(),
    }))
  },
}
