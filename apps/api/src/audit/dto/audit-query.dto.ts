import { Type } from 'class-transformer'
import { IsInt, IsOptional, IsString, Min } from 'class-validator'

export class AuditQueryDto {
  @IsOptional()
  @IsString()
  orderNo?: string

  @IsOptional()
  @IsString()
  boxCode?: string

  @IsOptional()
  @IsString()
  customer?: string

  @IsOptional()
  @IsString()
  channelCode?: string

  @IsOptional()
  @IsString()
  resourceType?: string

  @IsOptional()
  @IsString()
  action?: string

  @IsOptional()
  @IsString()
  from?: string

  @IsOptional()
  @IsString()
  to?: string

  @IsOptional()
  @IsString()
  purpose?: string

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number
}
