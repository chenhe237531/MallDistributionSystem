import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator'

export class CreateRechargeDto {
  @IsInt()
  @Min(1)
  amountCents!: number

  @IsOptional()
  @IsInt()
  @Min(1)
  paidAmountCents?: number

  @IsOptional()
  @IsString()
  voucherUrl?: string

  @IsOptional()
  @IsString()
  payerName?: string
}

export class CreditRechargeDto {
  @IsOptional()
  @IsBoolean()
  reviewApproved?: boolean
}

export class RejectRechargeDto {
  @IsOptional()
  @IsString()
  reason?: string
}

export class AdjustPrepaidDto {
  @IsString()
  merchantId!: string

  @IsInt()
  amountCents!: number

  @IsString()
  note!: string
}

export class LockPrepaidDto {
  @IsString()
  merchantId!: string

  @IsOptional()
  @IsString()
  reason?: string
}
