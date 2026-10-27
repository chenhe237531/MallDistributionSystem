import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator'

/** 手机号校验口径与下单联系人一致（sales-order.dto.ts） */
export const PHONE_PATTERN = /^1\d{10}$/

export class CreateShippingAddressDto {
  @IsString()
  @MinLength(1, { message: '请填写收货人姓名' })
  @MaxLength(30, { message: '收货人姓名不能超过 30 个字' })
  receiverName!: string

  @Matches(PHONE_PATTERN, { message: '请输入 11 位收货人手机号' })
  receiverPhone!: string

  @IsOptional()
  @IsString()
  @MaxLength(60, { message: '所在地区不能超过 60 个字' })
  region?: string

  @IsString()
  @MinLength(2, { message: '请填写详细地址' })
  @MaxLength(120, { message: '详细地址不能超过 120 个字' })
  detail!: string

  @IsOptional()
  @IsBoolean({ message: '默认地址格式不正确' })
  isDefault?: boolean
}

export class UpdateShippingAddressDto extends CreateShippingAddressDto {}
