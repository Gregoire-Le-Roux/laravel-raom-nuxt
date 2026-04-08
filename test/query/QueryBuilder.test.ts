import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Model } from '../../src/runtime/model/Model'
import { Resource, Field, Key, Relation } from '../../src/runtime/core/decorators'
import { QueryBuilder } from '../../src/runtime/query/QueryBuilder'
import { ModelList } from '../../src/runtime/model/ModelList'

// ── Fixture models ─────────────────────────────────────────────────────────────
// Decorated once at module load: MetadataStorage is populated for all tests.
// Do NOT call MetadataStorage.resources.clear() in beforeEach here — the QB
// constructor relies on the registered metadata being present throughout.

@Resource('posts', { limits: [1, 10, 25] })
class Post extends Model {
  @Key()
  @Field()
  id!: number

  @Field()
  title!: string
}

@Resource('users', { limits: [1, 10, 25, 50] })
class User extends Model {
  @Key()
  @Field()
  id!: number

  @Field()
  firstname!: string

  @Field()
  lastname!: string

  @Relation(() => Post, { many: true, pivot: {} })
  posts!: Post[]
}

/** Resource that does NOT allow limit 1 — used to test first() guard. */
@Resource('articles', { limits: [10, 25] })
class Article extends Model {
  @Key()
  @Field()
  id!: number
}

// ── Helpers ────────────────────────────────────────────────────────────────────

type G = { $fetch: ReturnType<typeof vi.fn> }
const gFetch = () => (globalThis as unknown as G).$fetch

/**
 * Calls qb.get() with a pre-mocked $fetch and returns the parsed JSON body
 * that was sent to the API, so individual fields can be asserted directly.
 */
async function capturePayload(qb: QueryBuilder<Model>): Promise<Record<string, unknown>> {
  gFetch().mockResolvedValueOnce({ data: [] })
  await qb.get()
  const call = gFetch().mock.calls[0] as [string, { body: string }]
  return JSON.parse(call[1].body) as Record<string, unknown>
}

// ── Suite ──────────────────────────────────────────────────────────────────────

describe('QueryBuilder', () => {
  beforeEach(() => {
    (globalThis as unknown as G).$fetch = vi.fn()
  })

  // ── Construction ─────────────────────────────────────────────────────────────

  describe('construction', () => {
    it('can be instantiated with a registered model', () => {
      expect(() => new QueryBuilder(User)).not.toThrow()
    })

    it('throws when the model is not registered in MetadataStorage', () => {
      class Ghost extends Model {}
      expect(() => new QueryBuilder(Ghost)).toThrow('Resource Ghost not registered')
    })
  })

  // ── Empty payload ─────────────────────────────────────────────────────────────

  it('sends { search: {} } when no builder methods are called', async () => {
    const payload = await capturePayload(new QueryBuilder(User))
    expect(payload).toEqual({ search: {} })
  })

  // ── text() ────────────────────────────────────────────────────────────────────

  describe('text()', () => {
    it('adds a text search entry to the payload', async () => {
      const payload = await capturePayload(new QueryBuilder(User).text('eliott'))
      expect((payload.search as Record<string, unknown>).text).toEqual({ value: 'eliott' })
    })
  })

  // ── where() ───────────────────────────────────────────────────────────────────

  describe('where()', () => {
    it('adds an AND filter with an explicit operator (3-arg form)', async () => {
      const payload = await capturePayload(
        new QueryBuilder(User).where('firstname', 'like', '%Eli%'),
      )
      expect((payload.search as Record<string, unknown>).filters).toEqual([
        { field: 'firstname', operator: 'like', value: '%Eli%', type: 'and' },
      ])
    })

    it('defaults operator to "=" when called with 2 args', async () => {
      const payload = await capturePayload(
        new QueryBuilder(User).where('firstname', 'John'),
      )
      expect((payload.search as Record<string, unknown>).filters).toEqual([
        { field: 'firstname', operator: '=', value: 'John', type: 'and' },
      ])
    })

    it('throws when filtering on an unknown field', () => {
      expect(() => new QueryBuilder(User).where('ghost', 'x')).toThrow(
        'Field ghost doesn\'t exist',
      )
    })
  })

  // ── orWhere() ─────────────────────────────────────────────────────────────────

  describe('orWhere()', () => {
    it('adds an OR filter', async () => {
      const payload = await capturePayload(
        new QueryBuilder(User).orWhere('lastname', '!=', 'Doe'),
      )
      expect((payload.search as Record<string, unknown>).filters).toEqual([
        { field: 'lastname', operator: '!=', value: 'Doe', type: 'or' },
      ])
    })

    it('throws when filtering on an unknown field', () => {
      expect(() => new QueryBuilder(User).orWhere('ghost', 'x')).toThrow(
        'Field ghost doesn\'t exist',
      )
    })
  })

  // ── whereNested() ─────────────────────────────────────────────────────────────

  describe('whereNested()', () => {
    it('wraps inner filters in a nested group', async () => {
      const payload = await capturePayload(
        new QueryBuilder(User).whereNested(q =>
          q.where('firstname', 'John').orWhere('lastname', 'Doe'),
        ),
      )
      expect((payload.search as Record<string, unknown>).filters).toEqual([
        {
          nested: [
            { field: 'firstname', operator: '=', value: 'John', type: 'and' },
            { field: 'lastname', operator: '=', value: 'Doe', type: 'or' },
          ],
          type: 'and',
        },
      ])
    })
  })

  // ── orderBy() ─────────────────────────────────────────────────────────────────

  describe('orderBy()', () => {
    it('adds a sort entry (asc by default)', async () => {
      const payload = await capturePayload(
        new QueryBuilder(User).orderBy('firstname'),
      )
      expect((payload.search as Record<string, unknown>).sorts).toEqual([
        { field: 'firstname', direction: 'asc' },
      ])
    })

    it('adds a desc sort', async () => {
      const payload = await capturePayload(
        new QueryBuilder(User).orderBy('id', 'desc'),
      )
      expect((payload.search as Record<string, unknown>).sorts).toEqual([
        { field: 'id', direction: 'desc' },
      ])
    })

    it('throws when sorting on an unknown field', () => {
      expect(() => new QueryBuilder(User).orderBy('ghost')).toThrow(
        'Field ghost doesn\'t exist',
      )
    })

    it('does not mutate sorts when validation throws', () => {
      const qb = new QueryBuilder(User)
      expect(() => qb.orderBy('ghost')).toThrow()
      // sorts must remain empty — no partial mutation
      expect((qb as unknown as { sorts: unknown[] }).sorts).toHaveLength(0)
    })
  })

  // ── select() ──────────────────────────────────────────────────────────────────

  describe('select()', () => {
    it('adds a selects entry for each field', async () => {
      const payload = await capturePayload(
        new QueryBuilder(User).select('firstname', 'lastname'),
      )
      expect((payload.search as Record<string, unknown>).selects).toEqual([
        { field: 'firstname' },
        { field: 'lastname' },
      ])
    })

    it('throws when selecting an unknown field', () => {
      expect(() => new QueryBuilder(User).select('ghost')).toThrow(
        'Field ghost doesn\'t exist',
      )
    })
  })

  // ── include() ─────────────────────────────────────────────────────────────────

  describe('include()', () => {
    it('adds a relation include to the payload', async () => {
      const payload = await capturePayload(
        new QueryBuilder(User).include('posts'),
      )
      expect((payload.search as Record<string, unknown>).includes).toEqual([
        { relation: 'posts' },
      ])
    })

    it('adds nested filters when a callback is provided', async () => {
      const payload = await capturePayload(
        new QueryBuilder(User).include('posts', q => q.where('title', 'like', '%hello%')),
      )
      expect((payload.search as Record<string, unknown>).includes).toEqual([
        {
          relation: 'posts',
          filters: [{ field: 'title', operator: 'like', value: '%hello%', type: 'and' }],
        },
      ])
    })

    it('throws when including an unknown relation', () => {
      expect(() => new QueryBuilder(User).include('comments')).toThrow(
        'Relation comments doesn\'t exist',
      )
    })
  })

  // ── scope() ───────────────────────────────────────────────────────────────────

  describe('scope()', () => {
    it('adds a scope with no parameters', async () => {
      const payload = await capturePayload(
        new QueryBuilder(User).scope('active'),
      )
      expect((payload.search as Record<string, unknown>).scopes).toEqual([
        { name: 'active', parameters: [] },
      ])
    })

    it('adds a scope with parameters', async () => {
      const payload = await capturePayload(
        new QueryBuilder(User).scope('older_than', 18),
      )
      expect((payload.search as Record<string, unknown>).scopes).toEqual([
        { name: 'older_than', parameters: [18] },
      ])
    })
  })

  // ── aggregate shortcuts ────────────────────────────────────────────────────────

  describe('aggregate shortcuts', () => {
    it('withCount adds a count aggregate', async () => {
      const payload = await capturePayload(new QueryBuilder(User).withCount('posts'))
      expect((payload.search as Record<string, unknown>).aggregates).toEqual([
        { relation: 'posts', type: 'count' },
      ])
    })

    it('withSum adds a sum aggregate with field and alias', async () => {
      const payload = await capturePayload(
        new QueryBuilder(User).withSum('posts', 'id', 'posts_id_sum'),
      )
      expect((payload.search as Record<string, unknown>).aggregates).toEqual([
        { relation: 'posts', type: 'sum', field: 'id', alias: 'posts_id_sum' },
      ])
    })

    it('withAvg / withMin / withMax add their respective aggregate types', async () => {
      const qb = new QueryBuilder(User)
        .withAvg('posts', 'id')
        .withMin('posts', 'id')
        .withMax('posts', 'id')
      const payload = await capturePayload(qb)
      expect((payload.search as Record<string, unknown>).aggregates).toEqual([
        { relation: 'posts', type: 'avg', field: 'id' },
        { relation: 'posts', type: 'min', field: 'id' },
        { relation: 'posts', type: 'max', field: 'id' },
      ])
    })
  })

  // ── instruction() ─────────────────────────────────────────────────────────────

  describe('instruction()', () => {
    it('adds an instruction with fields to the payload', async () => {
      const payload = await capturePayload(
        new QueryBuilder(User).instruction('export', [{ name: 'format', value: 'csv' }]),
      )
      expect((payload.search as Record<string, unknown>).instructions).toEqual([
        { name: 'export', fields: [{ name: 'format', value: 'csv' }] },
      ])
    })
  })

  // ── gate() ────────────────────────────────────────────────────────────────────

  describe('gate()', () => {
    it('adds gate names to the payload', async () => {
      const payload = await capturePayload(
        new QueryBuilder(User).gate('view-users', 'admin'),
      )
      expect((payload.search as Record<string, unknown>).gates).toEqual(['view-users', 'admin'])
    })
  })

  // ── limit() ───────────────────────────────────────────────────────────────────

  describe('limit()', () => {
    it('does not throw for an allowed limit', () => {
      expect(() => new QueryBuilder(User).limit(10)).not.toThrow()
    })

    it('throws when the limit is not in the allowed list', () => {
      expect(() => new QueryBuilder(User).limit(3)).toThrow('Limit 3 is not allowed')
    })
  })

  // ── get() ─────────────────────────────────────────────────────────────────────

  describe('get()', () => {
    it('calls $fetch with the correct URL and method', async () => {
      gFetch().mockResolvedValue({ data: [] })
      await new QueryBuilder(User).get()
      expect(gFetch()).toHaveBeenCalledWith(
        'http://localhost/api/users/search',
        expect.objectContaining({ method: 'POST' }),
      )
    })

    it('returns a ModelList of hydrated User instances', async () => {
      gFetch().mockResolvedValue({
        data: [
          { id: 1, firstname: 'Alice' },
          { id: 2, firstname: 'Bob' },
        ],
      })
      const [result] = await new QueryBuilder(User).get()
      expect(result).toBeInstanceOf(ModelList)
      expect((result as ModelList<User>).length).toBe(2)
      expect((result as ModelList<User>).at(0)).toBeInstanceOf(User)
      expect(((result as ModelList<User>).at(0) as User).firstname).toBe('Alice')
    })

    it('returns an empty ModelList when data is empty', async () => {
      gFetch().mockResolvedValue({ data: [] })
      const [result] = await new QueryBuilder(User).get()
      expect(result).toBeInstanceOf(ModelList)
      expect((result as ModelList<User>).length).toBe(0)
    })
  })

  // ── first() ───────────────────────────────────────────────────────────────────

  describe('first()', () => {
    it('returns the first hydrated instance', async () => {
      gFetch().mockResolvedValue({ data: [{ id: 10, firstname: 'Eve' }] })
      const user = await new QueryBuilder(User).first()
      expect(user).toBeInstanceOf(User)
      expect((user as User).firstname).toBe('Eve')
    })

    it('returns null when there are no results', async () => {
      gFetch().mockResolvedValue({ data: [] })
      const user = await new QueryBuilder(User).first()
      expect(user).toBeNull()
    })

    it('throws when limit 1 is not in the allowed limits', async () => {
      await expect(new QueryBuilder(Article).first()).rejects.toThrow('Limit 1 is not allowed')
    })
  })

  // ── findByKey() ───────────────────────────────────────────────────────────────

  describe('findByKey()', () => {
    it('returns the resource matching the key', async () => {
      gFetch().mockResolvedValue({ data: [{ id: 42, firstname: 'Max' }] })
      const user = await new QueryBuilder(User).findByKey(42)
      expect(user).toBeInstanceOf(User)
      expect((user as User).id).toBe(42)
    })

    it('throws when no resource matches the key', async () => {
      gFetch().mockResolvedValue({ data: [] })
      await expect(new QueryBuilder(User).findByKey(999)).rejects.toThrow(
        'Resource users with key 999 not found',
      )
    })
  })

  // ── getPage() ─────────────────────────────────────────────────────────────────

  describe('getPage()', () => {
    it('calls get() and returns the resulting ModelList', async () => {
      gFetch().mockResolvedValue({ data: [{ id: 5 }] })
      const [result] = await new QueryBuilder(User).getPage(2)
      expect(result).toBeInstanceOf(ModelList)
      expect((result as ModelList<User>).length).toBe(1)
    })
  })

  // ── Chaining ──────────────────────────────────────────────────────────────────

  describe('chaining', () => {
    it('combines multiple builder methods in a single payload', async () => {
      const qb = new QueryBuilder(User)
        .where('firstname', 'like', '%Eli%')
        .orderBy('id', 'desc')
        .include('posts')
        .scope('active')
        .gate('view-users')

      const payload = await capturePayload(qb)
      const search = payload.search as Record<string, unknown>

      expect(search.filters).toBeDefined()
      expect(search.sorts).toBeDefined()
      expect(search.includes).toBeDefined()
      expect(search.scopes).toBeDefined()
      expect(search.gates).toBeDefined()
    })
  })
})
