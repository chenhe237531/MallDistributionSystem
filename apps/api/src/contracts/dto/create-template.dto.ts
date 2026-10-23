import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator'
import { Role } from '@mall/shared'

export class CreateTemplateDto {
  @IsString()
  code!: string

  @IsString()
  name!: string

  @IsInt()
  @Min(1)
  version!: number

  @IsEnum(Role)
  partyType!: Role

  @IsString()
  body!: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  lockedClauses?: string[]
}
