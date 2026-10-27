import { IsString, MinLength } from 'class-validator'

export class BindInviteCodeDto {
  @IsString()
  @MinLength(4, { message: '请输入商家邀请码' })
  code!: string
}
