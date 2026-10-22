import { IsISO8601, IsOptional, IsString } from 'class-validator'

export class RegisterOfflineDto {
  @IsString()
  templateId!: string

  @IsString()
  subjectUserId!: string

  @IsOptional()
  @IsString()
  contractNo?: string

  @IsISO8601()
  validFrom!: string

  @IsOptional()
  @IsISO8601()
  validTo?: string

  @IsOptional()
  @IsString()
  scanFileUrl?: string
}
