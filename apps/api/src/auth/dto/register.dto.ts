import { IsOptional, IsString, Matches, MinLength } from 'class-validator'

export class RegisterDto {
  @Matches(/^1\d{10}$/, { message: '请输入 11 位手机号' })
  phone!: string

  @IsString()
  @MinLength(6, { message: '密码至少 6 位' })
  password!: string

  @IsString()
  @MinLength(1, { message: '请输入姓名' })
  name!: string

  @IsOptional()
  @IsString()
  deviceId?: string

  /** 商家邀请码（可选）：注册后直接建立与商家端销售的绑定意向 */
  @IsOptional()
  @IsString()
  inviteCode?: string
}
