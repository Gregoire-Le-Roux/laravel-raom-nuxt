import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Resource } from '../../src/runtime/core/decorators/class/Resource'
import { Field } from '../../src/runtime/core/decorators/property/Field'
import { Key } from '../../src/runtime/core/decorators/property/Key'
import { BelongsTo, HasManyRelation } from '../../src/runtime/core/decorators/method/Relation'
import { Model } from '../../src/runtime/model/Model'

class User extends Model {
  id?: number
}

@Resource('categories', { limits: [10] })
class Category extends Model {
  @Key()
  @Field()
  id!: number

  @Field()
  name!: string
}

@Resource('products', { limits: [10] })
class Product extends Model {
  @Key()
  @Field()
  id!: number

  @Field()
  name!: string

  category = BelongsTo(() => Category, 'category')
}

describe('Model', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('query/hydrate/create throw when model is not decorated', () => {
    expect(() => User.query()).toThrow('Must be decorated with @Resource')
    expect(() => User.hydrate({})).toThrow('Must be decorated with @Resource')
    expect(() => User.create({})).toThrow('Must be decorated with @Resource')
  })

  it('Resource.new marks instances as new', () => {
    const product = Product.new({ name: 'Draft product' })

    expect(product._isNew).toBe(true)
    expect(product.name).toBe('Draft product')
    expect(product._fields.name).toBeUndefined()
    expect(product._changes.name).toBe('Draft product')
  })

  it('tracks field mutations in _fields and _changes via proxy', () => {
    const product = Product.hydrate({ id: 10, name: 'Hydrated product' })

    expect(product._fields.id).toBe(10)
    expect(product._fields.name).toBe('Hydrated product')
    expect(product._changes).toEqual({})

    product.name = 'Updated product'

    expect(product._fields.name).toBe('Hydrated product')
    expect(product.name).toBe('Updated product')
    expect(product._changes.name).toBe('Updated product')
  })

  it('applies pending changes to fields only when applyChanges is called', () => {
    const product = Product.hydrate({ id: 12, name: 'Initial name' })

    product.name = 'Pending name'
    expect(product._fields.name).toBe('Initial name')
    expect(product._changes.name).toBe('Pending name')

    product.applyChanges()
    expect(product._fields.name).toBe('Pending name')
    expect(product._changes).toEqual({})
  })

  it('hydrate resets _isDeleted', () => {
    const product = Product.hydrate({ id: 1, name: 'Hydrated product' })
    product._isDeleted = true

    const hydratedAgain = Product.hydrate({ id: 1, name: 'Hydrated product' })

    expect(hydratedAgain._isDeleted).toBe(false)
  })

  it('relation helpers remain defined without mutation behavior', () => {
    class Post extends Model {}

    type RelationStub = {
      attach(model: Post): unknown
      detach(key: number): unknown
    }

    class BlogUser extends Model {
      posts = HasManyRelation(() => Post, 'posts')
    }

    const user = new BlogUser()
    const relation = user.hasMany(Post as unknown as typeof Model, 'posts')
    const relationStub = relation as RelationStub

    expect(relation).toBe(user.posts)
    expect(typeof relationStub.attach).toBe('function')
    expect(relationStub.attach(new Post())).toBe(relation)
    expect(relationStub.detach(1)).toBe(relation)
  })

  it('does not store relation builders in _fields', () => {
    const product = new Product()

    expect(product._fields.category).toBeUndefined()
    expect(product.category).toBeDefined()
  })

  it('keeps relation assembly per response without leaking relation state across hydrations', () => {
    const first = Product.hydrate({
      id: 4,
      name: 'Camera',
      category: {
        id: 2,
        name: 'Photo',
      },
    })

    const firstRelation = first.belongsTo(Category, 'category') as { name?: string }
    expect(firstRelation).toBeDefined()
    expect(firstRelation.name).toBe('Photo')

    const second = Product.hydrate({
      id: 4,
      name: 'Camera V2',
    })

    const secondRelation = second.belongsTo(Category, 'category') as { name?: string } | undefined
    expect(second.name).toBe('Camera V2')
    expect(secondRelation?.name).toBeUndefined()
  })
})
