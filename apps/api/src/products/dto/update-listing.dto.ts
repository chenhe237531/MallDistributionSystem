import { IsIn, IsInt, IsOptional, Min } from 'class-validator'

export class UpdateListingDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  retailPriceCents?: number

  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: 'active' | 'inactive'
}
