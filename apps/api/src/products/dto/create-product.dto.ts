import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator'

export class CreateProductDto {
  @IsString()
  @MinLength(2)
  skuCode!: string

  @IsString()
  @MinLength(2)
  name!: string

  @IsArray()
  @IsString({ each: true })
  testItems!: string[]

  @IsString()
  sampleType!: string

  @IsString()
  samplingMethod!: string

  @IsString()
  storageCondition!: string

  @IsOptional()
  @IsInt()
  @Min(1)
  shelfLifeDays?: number

  @IsOptional()
  @IsArray()
  questionnaireFields?: Array<{
    key: string
    label?: string
    /** 缺省 text（向后兼容旧配置） */
    type?: 'text' | 'number' | 'radio' | 'checkbox' | 'textarea'
    required?: boolean
    options?: string[]
    exclusiveOptions?: string[]
    remarkOn?: string[]
    unit?: string
    placeholder?: string
  }>

  @IsInt()
  @Min(1)
  supplyPriceCents!: number

  @IsOptional()
  @IsInt()
  @Min(1)
  suggestedRetailPriceCents?: number

  @IsOptional()
  @IsBoolean()
  distributable?: boolean
}
