import { IsISO8601, IsOptional, IsString } from 'class-validator'

export class CreateContractDto {
  @IsString()
  templateId!: string

  @IsString()
  subjectUserId!: string

  @IsOptional()
  @IsISO8601()
  expiresAt?: string
}
