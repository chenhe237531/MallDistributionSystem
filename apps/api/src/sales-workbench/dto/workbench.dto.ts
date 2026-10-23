import { IsString, Matches } from 'class-validator'

export class CreateClaimDto {
  @Matches(/^1\d{10}$/, { message: '请输入 11 位手机号' })
  customerPhone!: string
}

export class AssignSalesDto {
  @IsString()
  salesId!: string
}
