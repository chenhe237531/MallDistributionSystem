import { Type } from 'class-transformer'
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator'

export class UpdateProductContentDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  guideVideoUrl?: string

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  intro?: string

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @Type(() => String)
  relatedProductIds?: string[]

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @Type(() => String)
  boundCourseIds?: string[]
}
