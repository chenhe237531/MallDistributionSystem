import { Type } from 'class-transformer'
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator'

export class SalesOrderItemInputDto {
  @IsString()
  @MinLength(1, { message: '商品条目缺少编号' })
  listingId!: string

  @IsInt({ message: '购买数量必须为整数' })
  @Min(1, { message: '购买数量至少为 1' })
  quantity!: number
}

export class CreateSalesOrderDto {
  @IsArray({ message: '商品条目格式不正确' })
  @ArrayMinSize(1, { message: '请至少选择一件商品' })
  @ValidateNested({ each: true })
  @Type(() => SalesOrderItemInputDto)
  items!: SalesOrderItemInputDto[]

  @IsString()
  @MinLength(1, { message: '请填写联系人姓名' })
  @MaxLength(30, { message: '联系人姓名不能超过 30 个字' })
  contactName!: string

  @Matches(/^1\d{10}$/, { message: '请输入 11 位联系人手机号' })
  contactPhone!: string

  @IsOptional()
  @IsString()
  @MinLength(2, { message: '收货地址过于简单，请补充门牌号等信息' })
  @MaxLength(200, { message: '收货地址不能超过 200 个字' })
  address?: string

  @IsOptional()
  @IsString()
  channelCode?: string
}

export class RegisterPaymentDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  paidAmountCents?: number
}

export class RefundItemDto {
  @IsString()
  orderItemId!: string

  @IsInt()
  @Min(1)
  quantity!: number
}

export class RefundSalesOrderDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RefundItemDto)
  items?: RefundItemDto[]

  @IsOptional()
  @IsString()
  reason?: string
}
