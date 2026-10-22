import { IsISO8601, IsOptional, IsString } from 'class-validator'

export class AddQualificationDto {
  @IsString()
  type!: string

  @IsOptional()
  @IsString()
  fileUrl?: string

  @IsOptional()
  @IsISO8601()
  expiresAt?: string
}
