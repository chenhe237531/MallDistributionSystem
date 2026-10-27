/**
 * 移植后健康助手：阶段、时段与服药方案的唯一定义（三端共用）。
 * 依据 doc/health-assistant-prd.html §4：以移植日 D0 为锚，早 07:30 / 中 12:00 / 晚 19:30。
 */

export type JourneyStatusKey =
  | 'pending_schedule'
  | 'active'
  | 'paused'
  | 'completed'
  | 'cancelled'

export type DosingSchemeKey = 'morning_once' | 'twice_daily'

export type PushSlotKey = 'morning' | 'noon' | 'evening'

export type JourneyPhaseKey = 'pending' | 'prepare' | 'transplant' | 'recovery' | 'completed'

export type BowelPrepStatusKey = 'none' | 'platform_ordered' | 'self_confirmed' | 'ready'

/** 三时段固定触发时刻（Asia/Shanghai） */
export const PUSH_SLOT_TIME: Record<PushSlotKey, string> = {
  morning: '07:30',
  noon: '12:00',
  evening: '19:30',
}

export const PUSH_SLOT_LABELS: Record<PushSlotKey, string> = {
  morning: '早间',
  noon: '午间',
  evening: '晚间',
}

export const PUSH_SLOT_ORDER: PushSlotKey[] = ['morning', 'noon', 'evening']

export const DOSING_SCHEME_LABELS: Record<DosingSchemeKey, string> = {
  morning_once: '晨起空腹 10 粒',
  twice_daily: '早晚各 5 粒',
}

export const DOSING_SCHEME_HINTS: Record<DosingSchemeKey, string> = {
  morning_once: '首选方案：每日 1 次，晨起空腹服 10 粒，服完 1 小时后再进食',
  twice_daily: '次选方案：每日 2 次，晨起空腹 5 粒 + 晚饭后 1 小时 5 粒',
}

/** 旅程覆盖天数：准备期 7 天（-7 ~ -1）+ 移植期 6 天（0 ~ 5）+ 恢复期 30 天（6 ~ 35） */
export const JOURNEY_START_OFFSET = -7
export const JOURNEY_END_OFFSET = 35
export const PREPARE_END_OFFSET = -1
export const TRANSPLANT_END_OFFSET = 5

/** 由移植日偏差推导阶段；offset 为空表示尚未排期 */
export function journeyPhase(dayOffset: number | null | undefined): JourneyPhaseKey {
  if (dayOffset == null) {
    return 'pending'
  }
  if (dayOffset < JOURNEY_START_OFFSET) {
    return 'prepare'
  }
  if (dayOffset <= PREPARE_END_OFFSET) {
    return 'prepare'
  }
  if (dayOffset <= TRANSPLANT_END_OFFSET) {
    return 'transplant'
  }
  if (dayOffset <= JOURNEY_END_OFFSET) {
    return 'recovery'
  }
  return 'completed'
}

export const JOURNEY_PHASE_LABELS: Record<JourneyPhaseKey, string> = {
  pending: '待排期',
  prepare: '移植前准备',
  transplant: '移植期',
  recovery: '恢复期',
  completed: '已完成',
}

/** 相对天数展示：D-3 / D0 / D+2 */
export function dayOffsetLabel(dayOffset: number): string {
  if (dayOffset === 0) {
    return 'D0'
  }
  return dayOffset > 0 ? `D+${dayOffset}` : `D${dayOffset}`
}

/* ============================================================
 * 时间展示统一按 Asia/Shanghai（不依赖设备/服务器时区）
 * ============================================================ */

const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000

function shanghaiWallClock(value: string | Date): Date | null {
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) {
    return null
  }
  return new Date(date.getTime() + SHANGHAI_OFFSET_MS)
}

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

/** yyyy/MM/dd（上海时区） */
export function formatShanghaiDate(value?: string | Date | null, fallback = '—'): string {
  if (!value) {
    return fallback
  }
  const wall = shanghaiWallClock(value)
  if (!wall) {
    return fallback
  }
  return `${wall.getUTCFullYear()}/${pad2(wall.getUTCMonth() + 1)}/${pad2(wall.getUTCDate())}`
}

/** HH:mm（上海时区，24 小时制） */
export function formatShanghaiTime(value?: string | Date | null, fallback = '—'): string {
  if (!value) {
    return fallback
  }
  const wall = shanghaiWallClock(value)
  if (!wall) {
    return fallback
  }
  return `${pad2(wall.getUTCHours())}:${pad2(wall.getUTCMinutes())}`
}

/** yyyy/MM/dd HH:mm（上海时区） */
export function formatShanghaiDateTime(value?: string | Date | null, fallback = '—'): string {
  if (!value) {
    return fallback
  }
  const wall = shanghaiWallClock(value)
  if (!wall) {
    return fallback
  }
  return `${formatShanghaiDate(value)} ${formatShanghaiTime(value)}`
}

/** 上海时区今日 + N 天的 yyyy-MM-dd（供日期选择器默认值与最小值） */
export function shanghaiDateInput(addDays = 0): string {
  const wall = new Date(Date.now() + SHANGHAI_OFFSET_MS + addDays * 86_400_000)
  return `${wall.getUTCFullYear()}-${pad2(wall.getUTCMonth() + 1)}-${pad2(wall.getUTCDate())}`
}
