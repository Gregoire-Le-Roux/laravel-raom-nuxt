import { Resource } from '../../../src/runtime/core/decorators/class/Resource'
import { Relation } from '../../../src/runtime/core/decorators/method/Relation'
import { Field } from '../../../src/runtime/core/decorators/property/Field'
import { Key } from '../../../src/runtime/core/decorators/property/Key'
import { Model } from '../../../src/runtime/model/Model'
import { Product } from './Product'

@Resource('categories', { limits: [1, 10, 25, 50] })
class Category extends Model {
  @Key()
  @Field()
  id!: string

  @Field()
  name!: string

  @Relation(() => Product, { many: true })
  products?: Product[]

  Products() {
    return this.hasMany(Product, 'products')
  }
}

export {
  Category,
}
