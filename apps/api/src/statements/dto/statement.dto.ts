import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator'

export class GenerateStatementDto {
  @Matches(/^\d{4}-\d{2}$/, { message: '周期格式为 YYYY-MM' })
  period!: string

  @IsIn(['supplier', 'merchant', 'partner'])
  subjectType!: 'supplier' | 'merchant' | 'partner'

  @IsString()
  subjectId!: string
}

export class RegisterVoucherDto {
  @IsString()
  voucherNo!: string

  @IsString()
  title!: string

  @IsOptional()
  @IsString()
  taxNo?: string

  @IsInt()
  @Min(1)
  amountCents!: number

  @IsISO8601()
  issuedAt!: string

  @IsOptional()
  @IsString()
  imageUrl?: string
}

export class StatementAdjustmentDto {
  @IsInt()
  amountCents!: number

  @IsString()
  reason!: string
}

export class StatementDifferenceDto {
  @IsInt()
  amountCents!: number

  @IsString()
  reason!: string
}

export class ResolveDifferenceDto {
  @IsString()
  resolution!: string
}
