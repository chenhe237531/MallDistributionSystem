import { IsBoolean, IsObject, IsOptional, IsString } from 'class-validator'

export class SubmitQuestionnaireDto {
  @IsObject()
  answers!: Record<string, unknown>
}

export class MailSampleDto {
  @IsOptional()
  @IsString()
  trackingNo?: string
}

export class ReceiveSampleDto {
  @IsBoolean()
  boxCodeMatched!: boolean

  @IsBoolean()
  samplingTimeValid!: boolean

  @IsBoolean()
  storageConditionOk!: boolean

  @IsBoolean()
  transitWithinLimit!: boolean

  @IsOptional()
  @IsString()
  note?: string
}

export class AbnormalityDto {
  @IsString()
  reason!: string
}

export class ResampleDto {
  @IsOptional()
  @IsString()
  reason?: string
}
