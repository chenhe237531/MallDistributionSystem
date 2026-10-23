import { Type } from 'class-transformer'
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator'

export class SalesOrderItemInputDto {
  @IsString()
  listingId!: string

  @IsInt()
  @Min(1)
  quantity!: number
}

export class CreateSalesOrderDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SalesOrderItemInputDto)
  items!: SalesOrderItemInputDto[]

  @IsString()
  @MinLength(1)
  contactName!: string

  @Matches(/^1\d{10}$/, { message: '请输入 11 位手机号' })
  contactPhone!: string

  @IsOptional()
  @IsString()
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
