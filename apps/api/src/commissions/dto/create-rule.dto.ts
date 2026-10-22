import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator'

export class CreateCommissionRuleDto {
  @IsString()
  productId!: string

  @IsInt()
  @Min(1)
  @Max(2)
  level!: number

  @IsIn(['percentage', 'fixed'])
  rateType!: 'percentage' | 'fixed'

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  rateBps?: number

  @IsOptional()
  @IsInt()
  @Min(1)
  fixedAmountCents?: number

  @IsISO8601()
  effectiveFrom!: string

  @IsOptional()
  @IsISO8601()
  effectiveTo?: string
}
