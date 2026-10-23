import { IsBoolean, IsIn, IsInt, Max, Min } from 'class-validator'

export class ReviewProductDto {
  @IsInt()
  @Min(1)
  retailPriceCents!: number

  @IsInt()
  @Min(0)
  @Max(10000)
  platformServiceRateBps!: number

  @IsInt()
  @Min(0)
  @Max(10000)
  commissionRateCapBps!: number

  @IsBoolean()
  distributable!: boolean

  @IsIn(['active', 'inactive'])
  status!: 'active' | 'inactive'
}
