import { IsBoolean, IsIn, IsObject, IsOptional, IsString } from 'class-validator'

export class ActivateBoxCodeDto {
  @IsString()
  boxCode!: string

  @IsObject()
  questionnaire!: Record<string, unknown>

  @IsBoolean()
  consentGiven!: boolean

  @IsBoolean()
  reportAuthorization!: boolean

  @IsIn(['home', 'self_mail'])
  samplingMethod!: 'home' | 'self_mail'

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
