import type { DosingSchemeKey, PushSlotKey } from '@mall/shared'
import { PUSH_SLOT_ORDER } from '@mall/shared'
import { scheduledAtFor, startOfDay } from './journey-date'

/**
 * 健康助手推送模板库（PRD §4.3）。
 * 内容 1:1 映射《精准菌群移植服务流程（终端版）》注意事项，不新增医疗建议。
 * P0 以代码常量落地；admin 可视化编辑为 P1。
 */

export const TEMPLATE_VERSION = 1

type SlotTemplate = { title: string; body: string }
export type PushTaskSeed = {
  dayOffset: number
  slot: PushSlotKey
  scheduledAt: Date
  templateCode: string
  templateVersion: number
  title: string
  body: string
}

const PREPARE_MORNING: SlotTemplate[] = [
  {
    title: '用药禁忌提醒（移植前准备）',
    body: '移植前 7 天内不能使用抗生素类药物；类固醇类激素每日剂量不得大于 20mg。如正在用药，请先与医生或商家确认。',
  },
  {
    title: '今日用药自查',
    body: '继续避免使用抗生素；激素类药物每日不超过 20mg。如有新增用药，请先咨询医生是否影响移植。',
  },
  {
    title: '移植前准备·用药与状态',
    body: '请确认今日未使用抗生素。如出现发热（体温≥37℃）、严重腹泻等不适，请及时联系商家评估是否需要改期。',
  },
]

const PREPARE_NOON: SlotTemplate[] = [
  {
    title: '饮食调整开始',
    body: '今日起忌烟、酒、咖啡、浓茶、碳酸饮料、辛辣、油腻、熏烤食物，避免影响移植菌群的定植与存活。',
  },
  {
    title: '今日饮食提醒',
    body: '继续保持清淡饮食：忌烟酒、浓茶、咖啡、碳酸饮料、辛辣、油腻与熏烤食物。',
  },
  {
    title: '饮食自查',
    body: '今日是否已避开烟酒、浓茶、咖啡、碳酸饮料和辛辣油腻食物？坚持到移植结束有助于菌群定植。',
  },
]

const PREPARE_EVENING: SlotTemplate[] = [
  {
    title: '胶囊保存检查',
    body: '收到移植胶囊后请置于 4℃ 家用冰箱冷藏层保存，有效期为 60 天。请确认包装完好、未在常温久放。',
  },
  {
    title: '禁忌人群自查',
    body: '怀孕或哺乳期、严重免疫抑制、严重营养不良、严重低蛋白血症、体温≥37℃ 发热者不宜移植。命中任一请暂停旅程并联系商家。',
  },
  {
    title: '明日安排预告',
    body: '明日请继续清淡饮食、避免抗生素。如按首选方案，移植日晨起需空腹服用胶囊；请提前确认胶囊已冷藏保存。',
  },
]

const PREP_DAY_MORNING: SlotTemplate = {
  title: '今日清肠日（少渣饮食）',
  body: '今日为移植前 1 天，请全天少渣饮食：可用白米、白面、鱼、鸡蛋、低纤维蔬菜（花菜、冬瓜、土豆、去皮胡萝卜）；禁用粗粮、多纤维蔬菜（芹菜、韭菜、笋类）。',
}

const PREP_DAY_NOON: SlotTemplate = {
  title: '清肠药就绪检查',
  body: '请确认聚乙二醇电解质散已备好（2 袋加 2000mL 水或脉动冲开）。未备好可在健康助手中从平台购买，或自行购买后点击「我已自行购买」。',
}

const PREP_DAY_EVENING: SlotTemplate = {
  title: '清肠操作指引（今晚）',
  body: '晚餐清淡后口服聚乙二醇电解质散：2 袋加 2000mL 水/脉动冲开，少量多次服用；服后多走动、按摩腹部促进排泄，至大便呈无渣清水状即可；清肠后当晚不可再进食，今晚起空腹 8~10 小时。',
}

const TRANSPLANT_MORNING: Record<DosingSchemeKey, SlotTemplate> = {
  morning_once: {
    title: '今日服药（晨起空腹 10 粒）',
    body: '请从铝塑板取出 10 粒胶囊，检查完好后室温静置复温约 10 分钟，用 ≤37℃ 温凉水送服，10~20 分钟内服完；服完 1 小时后再进食。',
  },
  twice_daily: {
    title: '今日服药（晨起空腹 5 粒）',
    body: '请取出 5 粒胶囊，室温复温约 10 分钟，用 ≤37℃ 温凉水送服，10~20 分钟内服完；服完 1 小时后再进食。另 5 粒于晚饭后 1 小时服用。',
  },
}

const TRANSPLANT_NOON: SlotTemplate = {
  title: '移植期饮食与行为',
  body: '今日以易消化饮食为主，忌辛辣刺激、油腻/油炸、腌制、熏烤、重盐食物；忌烟酒、茶、咖啡、碳酸饮料；禁止剧烈运动，避免使用抗生素。',
}

const TRANSPLANT_EVENING: Record<DosingSchemeKey, SlotTemplate> = {
  morning_once: {
    title: '胶囊服用注意',
    body: '每次仅解冻当次服用胶囊，避免重复解冻造成菌群活性损失；本胶囊为肠溶胶囊，不可打开胶囊壳。明日晨起继续空腹服药。',
  },
  twice_daily: {
    title: '晚间服药（晚饭后 1 小时 5 粒）',
    body: '请于晚饭后 1 小时服用 5 粒胶囊，室温复温后用 ≤37℃ 温凉水送服，服完不建议再进食；肠溶胶囊不可打开胶囊壳。',
  },
}

const RECOVERY_MORNING: SlotTemplate[] = [
  {
    title: '益生菌增服提醒',
    body: '移植后建议增服功能性益生菌/益生元，便于菌群定植；请按商家或医生建议的剂量服用。',
  },
  {
    title: '建立规律排便习惯',
    body: '建议晨起或餐后 1 小时固定如厕，逐步建立良好的排便习惯，避免久忍。',
  },
  {
    title: '晨间运动',
    body: '每天晨起可户外散步或室内慢走 20~30 分钟，循序渐进恢复活动量。',
  },
]

const RECOVERY_NOON_EARLY: SlotTemplate[] = [
  {
    title: '不良反应应对·腹泻',
    body: '如出现腹泻：适当补充水分避免脱水，少量多次进食，避免刺激性调味品或油煎、油炸食物；症状持续或加重请联系商家。',
  },
  {
    title: '不良反应应对·腹胀',
    body: '如出现腹胀：避免产气食物、难消化的膳食纤维和淀粉类，少吃含大量果糖的水果，适量食用高蛋白、高脂肪食物。',
  },
  {
    title: '不良反应应对·轻度发热',
    body: '体温＜38℃ 可物理降温、选择好消化食物、多喝温水；如持续发热或体温≥38℃ 请及时就医并联系商家。',
  },
  {
    title: '赫氏消亡反应说明',
    body: '移植初期可能出现类似流感的疼痛、头痛、疲劳、胀气或腹泻，属自限性反应，说明有害菌正在凋亡；症状明显时请休息并补水。',
  },
]

const RECOVERY_NOON_LATE: SlotTemplate[] = [
  {
    title: '恢复食物多样性',
    body: '移植满两周后，可在清淡基础上逐步恢复食物多样性（同移植前菌衡饮食），避免暴饮暴食。',
  },
  {
    title: '饮食维持',
    body: '继续保持多样化饮食，减少辛辣、油腻、腌制与熏烤食物，帮助菌群稳定定植。',
  },
]

const RECOVERY_EVENING: SlotTemplate[] = [
  {
    title: '运动提醒',
    body: '恢复运动：每周 3 次、每次 30 分钟以上中等强度运动，循序渐进，避免剧烈运动。',
  },
  {
    title: '腹式呼吸放松',
    body: '睡前做 10 分钟腹式呼吸：吸气时鼓腹并放松肛门、会阴，呼气时收腹并紧缩肛门、会阴，气呼尽略加停顿再呼吸，反复 6~8 次。',
  },
  {
    title: '泡脚与足底按摩',
    body: '睡前用 39~42℃ 热水泡脚 30 分钟，配合拇指按摩足底中下部结肠反射区，刺激肠蠕动。',
  },
]

const RECHECK: SlotTemplate = {
  title: '移植后复检提醒',
  body: '移植结束已满 30 天，请进行宏基因组复检以评估菌群变化并指导后续方案；可在「我的报告」中查看，或联系商家预约。',
}

function pick<T>(pool: T[], index: number): T {
  return pool[Math.abs(index) % pool.length]
}

function code(dayOffset: number, slot: PushSlotKey): string {
  const prefix = dayOffset < 0 ? 'PRE' : dayOffset <= 5 ? 'TRANS' : 'REC'
  return `${prefix}_D${dayOffset}_${slot.toUpperCase()}`
}

function buildOne(
  transplantDate: Date,
  dayOffset: number,
  slot: PushSlotKey,
  template: SlotTemplate,
): PushTaskSeed {
  return {
    dayOffset,
    slot,
    scheduledAt: scheduledAtFor(transplantDate, dayOffset, slot),
    templateCode: code(dayOffset, slot),
    templateVersion: TEMPLATE_VERSION,
    title: template.title,
    body: template.body,
  }
}

/** 生成一次旅程的全量推送任务（43 天 × 3 时段 = 129 条） */
export function buildJourneyPushTasks(input: {
  transplantDate: Date
  dosingScheme: DosingSchemeKey
}): PushTaskSeed[] {
  const base = startOfDay(input.transplantDate)
  const tasks: PushTaskSeed[] = []

  // 准备期 D-7 ~ D-2
  for (let offset = -7; offset <= -2; offset += 1) {
    const index = offset + 7
    tasks.push(buildOne(base, offset, 'morning', pick(PREPARE_MORNING, index)))
    tasks.push(buildOne(base, offset, 'noon', pick(PREPARE_NOON, index)))
    tasks.push(buildOne(base, offset, 'evening', pick(PREPARE_EVENING, index)))
  }

  // 清肠日 D-1
  tasks.push(buildOne(base, -1, 'morning', PREP_DAY_MORNING))
  tasks.push(buildOne(base, -1, 'noon', PREP_DAY_NOON))
  tasks.push(buildOne(base, -1, 'evening', PREP_DAY_EVENING))

  // 移植期 D0 ~ D5
  for (let offset = 0; offset <= 5; offset += 1) {
    tasks.push(buildOne(base, offset, 'morning', TRANSPLANT_MORNING[input.dosingScheme]))
    tasks.push(buildOne(base, offset, 'noon', TRANSPLANT_NOON))
    tasks.push(buildOne(base, offset, 'evening', TRANSPLANT_EVENING[input.dosingScheme]))
  }

  // 恢复期 D6 ~ D35
  for (let offset = 6; offset <= 35; offset += 1) {
    const index = offset - 6
    if (offset === 35) {
      tasks.push(buildOne(base, offset, 'morning', RECHECK))
    } else {
      tasks.push(buildOne(base, offset, 'morning', pick(RECOVERY_MORNING, index)))
    }
    tasks.push(
      buildOne(
        base,
        offset,
        'noon',
        offset <= 19
          ? pick(RECOVERY_NOON_EARLY, index)
          : pick(RECOVERY_NOON_LATE, index),
      ),
    )
    tasks.push(buildOne(base, offset, 'evening', pick(RECOVERY_EVENING, index)))
  }

  // 时段顺序固定，便于时间线展示
  return tasks.sort(
    (a, b) =>
      a.dayOffset - b.dayOffset ||
      PUSH_SLOT_ORDER.indexOf(a.slot) - PUSH_SLOT_ORDER.indexOf(b.slot),
  )
}
