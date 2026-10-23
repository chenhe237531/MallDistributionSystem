import {
  IsArray,
  IsBoolean,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator'

export class CreateMaterialTemplateDto {
  @IsString()
  @MinLength(2)
  code!: string

  @IsString()
  @MinLength(2)
  name!: string

  @IsString()
  category!: string

  @IsString()
  contentType!: string

  @IsString()
  body!: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  lockedClauses?: string[]

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  applicableProductIds?: string[]

  @IsOptional()
  @IsISO8601()
  validUntil?: string
}

export class SetTemplateStatusDto {
  @IsBoolean()
  active!: boolean
}

export class GenerateMaterialDto {
  @IsString()
  templateId!: string

  @IsOptional()
  @IsString()
  productId?: string

  @IsOptional()
  @IsString()
  storeName?: string

  @IsOptional()
  @IsString()
  storeAddress?: string

  @IsOptional()
  @IsString()
  note?: string
}
