import { IsInt, IsString, Min } from 'class-validator'

export class CreateListingDto {
  @IsString()
  productId!: string

  @IsInt()
  @Min(1)
  retailPriceCents!: number
}
