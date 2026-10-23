import { IsString, Matches, MinLength } from 'class-validator'

export class LoginDto {
  @Matches(/^1\d{10}$/, { message: '请输入 11 位手机号' })
  phone!: string

  @IsString()
  @MinLength(6, { message: '密码至少 6 位' })
  password!: string
}
