import { IsOptional, IsString, Length } from 'class-validator'

export class ForwardReportDto {
  @IsString()
  reportId!: string

  @IsString()
  @Length(11, 11)
  receiverPhone!: string

  @IsOptional()
  @IsString()
  receiverName?: string
}
