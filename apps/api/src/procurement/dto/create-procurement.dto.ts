import { Type } from 'class-transformer'
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator'

export class ProcurementItemInputDto {
  @IsString()
  productId!: string

  @IsInt()
  @Min(1)
  quantity!: number
}

export class CreateProcurementDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ProcurementItemInputDto)
  items!: ProcurementItemInputDto[]

  @IsOptional()
  @IsString()
  remark?: string
}
