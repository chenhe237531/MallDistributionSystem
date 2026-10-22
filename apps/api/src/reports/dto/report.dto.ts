import { IsArray, IsObject, IsOptional, IsString } from 'class-validator'

export class CreateReportDto {
  @IsString()
  sampleId!: string

  @IsObject()
  fields!: Record<string, unknown>

  @IsOptional()
  @IsString()
  summary?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  missingItems?: string[]

  @IsOptional()
  @IsString()
  pdfUrl?: string
}

export class CorrectReportDto {
  @IsObject()
  fields!: Record<string, unknown>

  @IsOptional()
  @IsString()
  summary?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  missingItems?: string[]

  @IsOptional()
  @IsString()
  pdfUrl?: string
}
