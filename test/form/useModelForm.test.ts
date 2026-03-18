import { describe, expect, it } from 'vitest'
import { Model } from '../../src/runtime/model/Model'
import { Field, Key, Resource } from '../../src/runtime/core/decorators'
import { useModelForm } from '../../src/runtime/form/useModelForm'

// ── Fixture model ──────────────────────────────────────────────────────────────

@Resource('products', { limits: [10, 25, 50] })
class Product extends Model {
  @Key()
  @Field()
  id: number = 0

  @Field()
  name: string = ''

  @Field()
  price: number = 0

  @Field()
  active: boolean = false
}

// ── Suite ──────────────────────────────────────────────────────────────────────

describe('useModelForm', () => {

  // ── Initialization ────────────────────────────────────────────────────────────

  describe('initialization', () => {
    it('initializes state from the model default values', () => {
      const form = useModelForm(Product)
      const data = form.payload()
      expect(data.name).toBe('')
      expect(data.price).toBe(0)
      expect(data.active).toBe(false)
    })

    it('each call creates an independent form instance', () => {
      const formA = useModelForm(Product)
      const formB = useModelForm(Product)
      formA.field('name')['onUpdate:modelValue']('changed')
      expect(formB.payload().name).toBe('')
    })
  })

  // ── field() ───────────────────────────────────────────────────────────────────

  describe('field()', () => {
    it('returns the current modelValue for the field', () => {
      const form = useModelForm(Product)
      expect(form.field('name').modelValue).toBe('')
      expect(form.field('price').modelValue).toBe(0)
    })

    it('updates state when onUpdate:modelValue is called', () => {
      const form = useModelForm(Product)
      form.field('name')['onUpdate:modelValue']('Laptop')
      expect(form.field('name').modelValue).toBe('Laptop')
    })

    it('reflects the updated value in payload()', () => {
      const form = useModelForm(Product)
      form.field('name')['onUpdate:modelValue']('Laptop')
      form.field('price')['onUpdate:modelValue'](999)
      expect(form.payload()).toMatchObject({ name: 'Laptop', price: 999 })
    })

    it('handles boolean fields', () => {
      const form = useModelForm(Product)
      form.field('active')['onUpdate:modelValue'](true)
      expect(form.field('active').modelValue).toBe(true)
    })
  })

  // ── fill() ────────────────────────────────────────────────────────────────────

  describe('fill()', () => {
    it('hydrates the form with a full model instance', () => {
      const form = useModelForm(Product)
      const existing = { id: 42, name: 'Keyboard', price: 149, active: true }
      form.fill(existing)
      expect(form.payload()).toMatchObject(existing)
    })

    it('accepts a partial instance — only overwrites provided fields', () => {
      const form = useModelForm(Product)
      form.field('name')['onUpdate:modelValue']('Initial')
      form.fill({ price: 250 })
      expect(form.payload().name).toBe('Initial')
      expect(form.payload().price).toBe(250)
    })

    it('makes filled values available through field()', () => {
      const form = useModelForm(Product)
      form.fill({ name: 'Monitor', price: 399 })
      expect(form.field('name').modelValue).toBe('Monitor')
      expect(form.field('price').modelValue).toBe(399)
    })
  })

  // ── payload() ─────────────────────────────────────────────────────────────────

  describe('payload()', () => {
    it('returns a plain object — not the reactive state itself', () => {
      const form = useModelForm(Product)
      const p1 = form.payload()
      const p2 = form.payload()
      expect(p1).not.toBe(p2)
    })

    it('does not include internal framework properties', () => {
      const form = useModelForm(Product)
      const data = form.payload()
      expect('save' in data).toBe(false)
      expect('delete' in data).toBe(false)
      expect('hasMany' in data).toBe(false)
      expect('_isDeleted' in data).toBe(false)
    })
  })

  // ── reset() ───────────────────────────────────────────────────────────────────

  describe('reset()', () => {
    it('resets all fields to model default values', () => {
      const form = useModelForm(Product)
      form.field('name')['onUpdate:modelValue']('Laptop')
      form.field('price')['onUpdate:modelValue'](999)
      form.reset()
      expect(form.payload().name).toBe('')
      expect(form.payload().price).toBe(0)
    })

    it('resets after fill()', () => {
      const form = useModelForm(Product)
      form.fill({ id: 5, name: 'Mouse', price: 49 })
      form.reset()
      expect(form.payload().name).toBe('')
      expect(form.payload().id).toBe(0)
    })
  })
})
