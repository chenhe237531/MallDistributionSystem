import {
  ArrayUnique,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator'
import { Role } from '@mall/shared'

export class CreateAccountDto {
  @Matches(/^1\d{10}$/, { message: '请输入 11 位手机号' })
  phone!: string

  @IsString()
  @MinLength(6, { message: '密码至少 6 位' })
  password!: string

  @IsString()
  @MinLength(1, { message: '请输入姓名' })
  name!: string

  @IsEnum(Role)
  primaryRole!: Role

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEnum(Role, { each: true })
  roles?: Role[]

  @IsOptional()
  @IsString()
  organizationName?: string
}
