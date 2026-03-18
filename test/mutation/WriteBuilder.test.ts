import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Model } from '../../src/runtime/model/Model'
import { Field, Key, Resource } from '../../src/runtime/core/decorators'
import { WriteBuilder } from '../../src/runtime/mutation/WriteBuilder'

// ── Fixture models ─────────────────────────────────────────────────────────────

@Resource('products', { limits: [10, 25, 50] })
class Product extends Model {
  @Key()
  @Field()
  id: number = 0

  @Field()
  name: string = ''

  @Field()
  price: number = 0
}

// ── Helpers ────────────────────────────────────────────────────────────────────

type G = { $fetch: ReturnType<typeof vi.fn> }
const gFetch = () => (globalThis as unknown as G).$fetch

/**
 * Calls wb.run() with a pre-mocked $fetch and returns the parsed JSON body
 * that was sent to the API.
 */
async function capturePayload(wb: WriteBuilder<Model>): Promise<Record<string, unknown>> {
  gFetch().mockResolvedValueOnce({ created: [], updated: [], deleted: [] })
  await wb.run()
  const call = gFetch().mock.calls[0] as [string, { body: string }]
  return JSON.parse(call[1].body) as Record<string, unknown>
}

// ── Suite ──────────────────────────────────────────────────────────────────────

describe('WriteBuilder', () => {
  beforeEach(() => {
    (globalThis as unknown as G).$fetch = vi.fn()
  })

  // ── Construction ─────────────────────────────────────────────────────────────

  describe('construction', () => {
    it('can be instantiated with a registered model', () => {
      expect(() => new WriteBuilder(Product)).not.toThrow()
    })

    it('throws when the model is not registered in MetadataStorage', () => {
      class Ghost extends Model {}
      expect(() => new WriteBuilder(Ghost)).toThrow('Resource Ghost not registered')
    })
  })

  // ── create() ─────────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('sends a create operation with the given attributes', async () => {
      const payload = await capturePayload(
        new WriteBuilder(Product).create({ name: 'Laptop', price: 999 }),
      )
      expect(payload.mutate).toEqual([
        { operation: 'create', attributes: { name: 'Laptop', price: 999 } },
      ])
    })

    it('includes relations when provided', async () => {
      const relations = { category: { operation: 'attach', key: 1 } }
      const payload = await capturePayload(
        new WriteBuilder(Product).create({ name: 'Laptop' }, relations),
      )
      expect((payload.mutate as Record<string, unknown>[])[0]).toMatchObject({
        operation: 'create',
        relations,
      })
    })

    it('is chainable', () => {
      const wb = new WriteBuilder(Product)
      expect(wb.create({ name: 'A' })).toBe(wb)
    })
  })

  // ── update() ─────────────────────────────────────────────────────────────────

  describe('update()', () => {
    it('sends an update operation with the key and attributes', async () => {
      const payload = await capturePayload(
        new WriteBuilder(Product).update(1, { price: 799 }),
      )
      expect(payload.mutate).toEqual([
        { operation: 'update', key: 1, attributes: { price: 799 } },
      ])
    })

    it('accepts a string key', async () => {
      const payload = await capturePayload(
        new WriteBuilder(Product).update('abc-123', { name: 'Updated' }),
      )
      expect((payload.mutate as Record<string, unknown>[])[0]).toMatchObject({
        operation: 'update',
        key: 'abc-123',
      })
    })

    it('is chainable', () => {
      const wb = new WriteBuilder(Product)
      expect(wb.update(1, {})).toBe(wb)
    })
  })

  // ── delete() ─────────────────────────────────────────────────────────────────

  describe('delete()', () => {
    it('sends a delete operation with the given key', async () => {
      const payload = await capturePayload(
        new WriteBuilder(Product).delete(42),
      )
      expect(payload.mutate).toEqual([
        { operation: 'delete', key: 42 },
      ])
    })

    it('is chainable', () => {
      const wb = new WriteBuilder(Product)
      expect(wb.delete(1)).toBe(wb)
    })
  })

  // ── run() ─────────────────────────────────────────────────────────────────────

  describe('run()', () => {
    it('calls $fetch with the correct URL and POST method', async () => {
      gFetch().mockResolvedValue({ created: [], updated: [], deleted: [] })
      await new WriteBuilder(Product).create({ name: 'Test' }).run()
      expect(gFetch()).toHaveBeenCalledWith(
        'http://localhost/api/products/mutate',
        expect.objectContaining({ method: 'POST' }),
      )
    })

    it('throws when no operations are queued', async () => {
      await expect(new WriteBuilder(Product).run()).rejects.toThrow(
        'WriteBuilder: no operations queued before run()',
      )
    })

    it('returns the API response', async () => {
      const mockResponse = { created: [{ id: 1 }], updated: [], deleted: [] }
      gFetch().mockResolvedValue(mockResponse)
      const result = await new WriteBuilder(Product).create({ name: 'Laptop' }).run()
      expect(result).toEqual(mockResponse)
    })
  })

  // ── Chaining ──────────────────────────────────────────────────────────────────

  describe('chaining', () => {
    it('batches multiple operations in a single payload', async () => {
      const payload = await capturePayload(
        new WriteBuilder(Product)
          .create({ name: 'A', price: 100 })
          .create({ name: 'B', price: 200 })
          .update(1, { price: 150 })
          .delete(99),
      )
      expect((payload.mutate as unknown[]).length).toBe(4)
    })
  })

  // ── Model.write() injection ───────────────────────────────────────────────────

  describe('Model.write()', () => {
    it('is injected by @Resource and returns a WriteBuilder instance', () => {
      const wb = Product.write()
      expect(wb).toBeInstanceOf(WriteBuilder)
    })
  })
})
