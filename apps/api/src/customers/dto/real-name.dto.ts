import { IsISO8601, IsOptional, IsString, Matches, MinLength } from 'class-validator'

export class RealNameDto {
  @IsString()
  @MinLength(2, { message: '请输入真实姓名' })
  realName!: string

  @Matches(/^(\d{15}|\d{17}[\dXx])$/, { message: '请输入有效的身份证号' })
  idCardNo!: string

  @IsOptional()
  @IsString()
  gender?: string

  @IsOptional()
  @IsISO8601()
  birthDate?: string
}
