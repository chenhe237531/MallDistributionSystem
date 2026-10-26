import { IsInt, IsOptional, IsString, Min } from 'class-validator'

export class CreateListingDto {
  @IsString()
  productId!: string

  /**
   * C 端售价（分）。不传时按采购价 × 2 生成默认售价；
   * 传入即视为商家自定义价格，后续不随采购价自动换算。
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  retailPriceCents?: number
}
