import { IsBoolean, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator'
import { MAX_RETAIL_PRICE_CENTS } from './create-listing.dto'

export class UpdateListingDto {
  /** 自定义 C 端售价（分）；不得低于采购价。 */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_RETAIL_PRICE_CENTS)
  retailPriceCents?: number

  /** 恢复默认售价（采购价 × 2）并清除自定义标记。 */
  @IsOptional()
  @IsBoolean()
  resetToDefault?: boolean

  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: 'active' | 'inactive'
}
