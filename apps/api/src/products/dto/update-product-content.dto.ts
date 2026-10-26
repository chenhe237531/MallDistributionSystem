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

  /** 商品图片相对 URL（有序，第一张为主图）；全量替换语义 */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(9)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  @Type(() => String)
  images?: string[]

  /** 结构化分类 key，取值见 @mall/shared PRODUCT_CATEGORIES */
  @IsOptional()
  @IsString()
  @MaxLength(32)
  category?: string

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
