import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator'

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export class ScheduleJourneyDto {
  @Matches(DATE_PATTERN, { message: '移植日格式为 yyyy-MM-dd' })
  transplantDate!: string

  @IsOptional()
  @IsIn(['morning_once', 'twice_daily'], { message: '服药方案不合法' })
  dosingScheme?: 'morning_once' | 'twice_daily'
}

export class ResumeJourneyDto {
  @Matches(DATE_PATTERN, { message: '移植日格式为 yyyy-MM-dd' })
  transplantDate!: string

  @IsOptional()
  @IsIn(['morning_once', 'twice_daily'], { message: '服药方案不合法' })
  dosingScheme?: 'morning_once' | 'twice_daily'
}

export class PauseJourneyDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string
}

export class CancelJourneyDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string
}

export class SelfConfirmBowelPrepDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  drugName?: string

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  photoUrl?: string
}

export class QueryJourneysDto {
  @IsOptional()
  @IsString()
  status?: string

  @IsOptional()
  @IsString()
  bowelPrepStatus?: string

  /** 仅看清肠预警（未就绪且已进入 D-2 以内） */
  @IsOptional()
  @IsString()
  alert?: string
}
