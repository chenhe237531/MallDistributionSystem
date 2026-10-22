import {
  IsArray,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator'
import type { InterpretationSections } from '@mall/shared'

export class EditInterpretationDto {
  @IsObject()
  sections!: InterpretationSections

  @IsOptional()
  @IsString()
  note?: string
}

export class AnnotateInterpretationDto {
  @IsString()
  note!: string
}

export class RejectInterpretationDto {
  @IsOptional()
  @IsString()
  reason?: string
}

export class CreateNutritionPlanDto {
  @IsString()
  reportId!: string

  @IsOptional()
  @IsString()
  interpretationId?: string

  @IsString()
  cycle!: string

  @IsObject()
  meals!: Record<string, unknown>

  @IsArray()
  followUpNodes!: Array<Record<string, unknown>>
}
