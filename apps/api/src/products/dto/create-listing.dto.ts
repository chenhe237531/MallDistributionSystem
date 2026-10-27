import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator'

/** 售价防呆上限：100 万元（与佣金比率 bps 上限校验同风格，拦截异常录入）。 */
export const MAX_RETAIL_PRICE_CENTS = 100_000_000

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
  @Max(MAX_RETAIL_PRICE_CENTS)
  retailPriceCents?: number
}
