import { IsOptional, IsString } from 'class-validator'

export class DisableChannelDto {
  @IsOptional()
  @IsString()
  reason?: string
}
