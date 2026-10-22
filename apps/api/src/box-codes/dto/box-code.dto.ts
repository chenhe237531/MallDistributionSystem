import { IsOptional, IsString } from 'class-validator'

export class GenerateBoxCodesDto {
  @IsString()
  procurementOrderId!: string
}

export class VoidBoxCodeDto {
  @IsOptional()
  @IsString()
  reason?: string
}
