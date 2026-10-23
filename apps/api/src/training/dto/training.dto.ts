import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator'
import { Role } from '@mall/shared'

export class CreateCourseDto {
  @IsString()
  @MinLength(2)
  code!: string

  @IsString()
  @MinLength(2)
  name!: string

  @IsString()
  category!: string

  @IsArray()
  @ArrayMinSize(1)
  @IsIn(Object.values(Role), { each: true })
  audience!: Role[]

  @IsOptional()
  @IsBoolean()
  required?: boolean

  @IsOptional()
  @IsInt()
  @Min(1)
  validityMonths?: number
}

export class CreateChapterDto {
  @IsString()
  title!: string

  @IsString()
  content!: string

  @IsOptional()
  @IsInt()
  order?: number
}

export class CreateQuestionDto {
  @IsIn(['single', 'multiple', 'judge'])
  type!: 'single' | 'multiple' | 'judge'

  @IsString()
  prompt!: string

  @IsArray()
  options!: Array<{ key: string; text: string }>

  answer!: string | string[]

  @IsOptional()
  @IsInt()
  @Min(1)
  score?: number
}

export class ExamSubmissionDto {
  @IsObject()
  answers!: Record<string, string | string[]>

  @IsOptional()
  @IsInt()
  @Min(0)
  screenSwitches?: number

  @IsOptional()
  @IsBoolean()
  suspiciousInterval?: boolean
}
