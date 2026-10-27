import type { PushSlotKey } from '@mall/shared'
import { PUSH_SLOT_TIME } from '@mall/shared'

/**
 * 健康助手统一按 Asia/Shanghai 计算自然日与推送时刻（PRD §4.1）。
 * 不依赖服务器系统时区：内部把绝对时刻平移 +8h 后按 UTC 读取“墙上时间”。
 */

const TZ_OFFSET_MS = 8 * 60 * 60 * 1000

/** 绝对时刻 → UTC+8 墙上时间（仅供 getUTC* 读取） */
function toWallClock(date: Date): Date {
  return new Date(date.getTime() + TZ_OFFSET_MS)
}

/** 从墙上时间还原绝对时刻 */
function fromWallClock(date: Date): Date {
  return new Date(date.getTime() - TZ_OFFSET_MS)
}

/** Asia/Shanghai 自然日 00:00 对应的绝对时刻 */
export function startOfDay(date: Date): Date {
  const wall = toWallClock(date)
  return fromWallClock(
    new Date(Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate())),
  )
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000)
}

/** 解析 yyyy-MM-dd 为 Asia/Shanghai 当日 00:00 */
export function parseDateOnly(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) {
    return new Date(Number.NaN)
  }
  return new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) - TZ_OFFSET_MS,
  )
}

/** 今日与移植日的自然日差：移植日当天为 0，移植前为负 */
export function dayOffsetOf(transplantDate: Date, now = new Date()): number {
  const diff = startOfDay(now).getTime() - startOfDay(transplantDate).getTime()
  return Math.round(diff / 86_400_000)
}

/** Asia/Shanghai 的 yyyy-MM-dd */
export function dateKey(date: Date): string {
  const wall = toWallClock(date)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${wall.getUTCFullYear()}-${pad(wall.getUTCMonth() + 1)}-${pad(wall.getUTCDate())}`
}

/** Asia/Shanghai 当日分钟数（0~1439） */
export function wallClockMinutes(date: Date): number {
  const wall = toWallClock(date)
  return wall.getUTCHours() * 60 + wall.getUTCMinutes()
}

/** 移植日 + 偏差天数 + 时段 → 绝对触发时刻 */
export function scheduledAtFor(
  transplantDate: Date,
  dayOffset: number,
  slot: PushSlotKey,
): Date {
  const [hour, minute] = PUSH_SLOT_TIME[slot].split(':').map(Number)
  return new Date(
    startOfDay(transplantDate).getTime() +
      dayOffset * 86_400_000 +
      (hour * 60 + minute) * 60_000,
  )
}

/** 免打扰窗口：21:30 ~ 次日 07:30（PRD §4.4） */
export function isQuietHours(now = new Date()): boolean {
  const minutes = wallClockMinutes(now)
  return minutes >= 21 * 60 + 30 || minutes < 7 * 60 + 30
}
