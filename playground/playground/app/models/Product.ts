import { Resource } from '../../../src/runtime/core/decorators/class/Resource'
import { Field } from '../../../src/runtime/core/decorators/property/Field'
import { Key } from '../../../src/runtime/core/decorators/property/Key'
import { BelongsTo } from '../../../src/runtime/core/decorators/method/Relation'
import { Category } from './Category'
import { Model } from '../../../src/runtime/model/Model'
import { User } from './User'

@Resource('products', { limits: [1, 10, 25, 50] })
export class Product extends Model {
  @Key()
  @Field()
  id!: string

  @Field()
  name!: string

  @Field()
  description!: string

  @Field()
  price!: number

  @Field()
  stock!: number

  @Field()
  created_at!: string

  @Field()
  updated_at!: string

  category = BelongsTo(() => Category, 'category')

  product_author = BelongsTo(() => User, 'product_author')
}
