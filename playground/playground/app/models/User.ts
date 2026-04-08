import { Resource } from '../../../src/runtime/core/decorators/class/Resource'
import { Field } from '../../../src/runtime/core/decorators/property/Field'
import { Key } from '../../../src/runtime/core/decorators/property/Key'
import { BelongsTo } from '../../../src/runtime/core/decorators/method/Relation'
import { Category } from './Category'
import { Model } from '../../../src/runtime/model/Model'

@Resource('users', { limits: [1, 10, 25, 50] })
export class User extends Model {
  @Key()
  @Field()
  id!: string

  @Field()
  name!: string
}
