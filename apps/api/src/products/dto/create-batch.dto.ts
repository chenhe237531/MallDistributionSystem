import { IsISO8601, IsInt, IsString, MinLength, Min } from 'class-validator'

export class CreateBatchDto {
  @IsString()
  @MinLength(1)
  batchNo!: string

  @IsISO8601()
  productionDate!: string

  @IsISO8601()
  expiresAt!: string

  @IsInt()
  @Min(1)
  quantity!: number
}
