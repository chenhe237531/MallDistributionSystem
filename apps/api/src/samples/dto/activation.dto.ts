import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator'

/** 与受检人关系枚举（§5.2） */
export const RELATIONSHIPS = ['self', 'spouse', 'parent', 'child', 'other'] as const

export class ActivateBoxCodeDto {
  @IsString()
  boxCode!: string

  /** 问卷改为独立提交（PATCH /samples/:id/questionnaire），激活时可选 */
  @IsOptional()
  @IsObject()
  questionnaire?: Record<string, unknown>

  @IsBoolean()
  consentGiven!: boolean

  @IsBoolean()
  reportAuthorization!: boolean

  @IsIn(['home', 'self_mail'])
  samplingMethod!: 'home' | 'self_mail'

  /** 采样时间（ISO 字符串，服务层校验不得晚于当前时间） */
  @IsDateString()
  sampledAt!: string

  @Matches(/^1\d{10}$/, { message: '手机号格式不正确' })
  contactPhone!: string

  @IsIn(RELATIONSHIPS, { message: '与受检人关系不合法' })
  relationship!: (typeof RELATIONSHIPS)[number]

  @IsInt()
  @Min(1)
  @Max(120)
  examineeAge!: number

  @IsOptional()
  @IsString()
  @MaxLength(200)
  remark?: string

  @IsOptional()
  @IsString()
  orderId?: string

  @IsOptional()
  @IsString()
  ip?: string

  @IsOptional()
  @IsString()
  device?: string
}

export class ReportAuthorizationDto {
  @IsBoolean()
  authorized!: boolean
}
