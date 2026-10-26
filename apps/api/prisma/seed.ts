import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main(): Promise<void> {
  await prisma.systemConfig.upsert({
    where: { key: 'platform.name' },
    update: { value: { name: '商城-分销系统' } },
    create: { key: 'platform.name', value: { name: '商城-分销系统' } },
  })

  await prisma.user.upsert({
    where: { phone: '13800000000' },
    update: {
      roles: ['platform'],
      primaryRole: 'platform',
      status: 'active',
    },
    create: {
      phone: '13800000000',
      passwordHash: await bcrypt.hash('Admin@123', 10),
      name: '平台管理员',
      roles: ['platform'],
      primaryRole: 'platform',
      status: 'active',
    },
  })

  const templates = [
    {
      code: 'merchant_onboarding',
      name: '入驻与供货合作协议',
      partyType: 'merchant' as const,
      body: '平台与商家就供货价、零售底价、售后责任、报告使用范围达成的合作协议。',
      lockedClauses: ['报告使用范围', '售后责任'],
    },
    {
      code: 'supplier_supply',
      name: '供货协议',
      partyType: 'supplier' as const,
      body: '平台与供应商就质量标准、批次与有效期、缺货与召回责任达成的供货协议。',
      lockedClauses: ['质量标准', '批次与有效期'],
    },
    {
      code: 'partner_distribution',
      name: '分销合作协议',
      partyType: 'partner' as const,
      body: '平台与合伙人就佣金比例与结算周期、开票义务、报告使用范围、禁止性条款达成的协议。',
      lockedClauses: ['佣金比例与结算周期', '开票义务'],
    },
    {
      code: 'nutritionist_service',
      name: '服务合作协议',
      partyType: 'nutritionist' as const,
      body: '平台与营养师就服务范围、解读边界、保密与授权达成的协议。',
      lockedClauses: ['解读边界', '保密与授权'],
    },
    {
      code: 'customer_detection',
      name: '检测服务协议 + 知情同意书',
      partyType: 'customer' as const,
      body: '检测范围、样本用途、报告可见范围、数据授权与撤回说明。',
      lockedClauses: ['报告可见范围', '数据授权与撤回'],
    },
  ]

  for (const template of templates) {
    await prisma.contractTemplate.upsert({
      where: { code_version: { code: template.code, version: 1 } },
      update: {
        name: template.name,
        partyType: template.partyType,
        body: template.body,
        lockedClauses: template.lockedClauses,
        active: true,
      },
      create: {
        code: template.code,
        name: template.name,
        version: 1,
        partyType: template.partyType,
        body: template.body,
        lockedClauses: template.lockedClauses,
      },
    })
  }

  const courses = [
    {
      code: 'newbie_course',
      name: '新人课：平台规则与基础流程',
      category: 'newbie',
      audience: ['sales', 'partner'] as const,
      required: true,
      validityMonths: 12,
      chapters: [
        { title: '平台规则', content: '了解平台定位、盒码归属与渠道码使用规则。' },
        { title: '下单与售后', content: '掌握下单、发货、退款与售后流程。' },
      ],
      questions: [
        {
          type: 'single',
          prompt: '客户归属由什么决定？',
          options: [
            { key: 'A', text: '谁先添加微信' },
            { key: 'B', text: '客户首次扫码激活的盒码' },
            { key: 'C', text: '谁先发送链接' },
          ],
          answer: 'B',
        },
      ],
    },
    {
      code: 'compliance_course',
      name: '合规课：对外表达边界',
      category: 'compliance',
      audience: ['sales', 'partner'] as const,
      required: true,
      validityMonths: 12,
      chapters: [
        { title: '禁止性表述', content: '不得输出疾病诊断、疗效承诺、处方药推荐。' },
        { title: '正确话术', content: '使用平台统一素材与合规话术解释报告。' },
      ],
      questions: [
        {
          type: 'single',
          prompt: '以下哪项是禁止的对外表述？',
          options: [
            { key: 'A', text: '建议结合医生意见复查' },
            { key: 'B', text: '保证治愈相关症状' },
            { key: 'C', text: '解释指标含义' },
            { key: 'D', text: '建议改善作息' },
          ],
          answer: 'B',
        },
        {
          type: 'multiple',
          prompt: '报告解读中不得出现哪些内容？',
          options: [
            { key: 'A', text: '疾病诊断' },
            { key: 'B', text: '疗效承诺' },
            { key: 'C', text: '处方药推荐' },
            { key: 'D', text: '指标释义' },
          ],
          answer: ['A', 'B', 'C'],
        },
      ],
    },
    {
      code: 'interpretation_basics',
      name: '解读基础课：指标与边界',
      category: 'interpretation',
      audience: ['sales', 'partner'] as const,
      required: false,
      validityMonths: 12,
      chapters: [
        { title: '指标怎么看', content: '理解参考区间与异常项。' },
        { title: '何时建议就医', content: '识别需要就医的情形，不做诊断。' },
      ],
      questions: [
        {
          type: 'judge',
          prompt: '报告解读可以替代临床诊断。',
          options: [
            { key: 'A', text: '正确' },
            { key: 'B', text: '错误' },
          ],
          answer: 'B',
        },
      ],
    },
    {
      code: 'nutritionist_course',
      name: '营养师专项课：解读与方案规范',
      category: 'nutritionist',
      audience: ['nutritionist'] as const,
      required: true,
      validityMonths: 12,
      chapters: [
        { title: '复核规范', content: '掌握 AI 解读复核与营养方案出具标准。' },
      ],
      questions: [
        {
          type: 'single',
          prompt: '营养方案应包含以下哪项？',
          options: [
            { key: 'A', text: '周期、餐次建议与随访节点' },
            { key: 'B', text: '处方药剂量' },
            { key: 'C', text: '疗效承诺' },
          ],
          answer: 'A',
        },
      ],
    },
    {
      code: 'product_knowledge',
      name: '产品知识课：检测与移植产品线',
      category: 'product',
      audience: ['sales', 'partner'] as const,
      required: false,
      validityMonths: 12,
      chapters: [
        {
          title: '产品线四件套',
          content:
            '菌群移植制品分胶囊、菌泥、菌液、菌群冻干粉四种剂型：活菌量均为 2.5×10^12 CFU/次，肠菌分离制备工艺一致；区别在于胶囊需增加活菌包埋工艺、冻干粉需增加冻干包埋工艺，以及移植方式/途径不同。配套产品有 FMT 专用辅剂（A 液益生菌+B 液益生元，移植期增强定植率）与微移植胶囊（疗程结束后 30 天内每日 1 粒巩固疗效）。',
        },
        {
          title: '规格与储运速查',
          content:
            '胶囊 0-4℃ 储存 2 个月，下单后 1-2 天发货；菌泥 -20℃ 储存 2 个月；辅剂 0-4℃ 储存 15 天且不可冷冻；健康食品线常温 2 年。收到订单后按检测报告配型选择供体中间品完成最后工艺，制备周期 1-2 天，2-3 天内发货。',
        },
        {
          title: '疗程标准',
          content:
            '1 个标准疗程=每天 1 次、连续 6 天。按疾病分级：明确感染源腹泻 1 标准+1 巩固；肠道良性疾病 2+2；伴器质性病变 3+3；长期性疾病 4+4。一般 1 个疗程显效、2 个疗程见效、3 个疗程强效。病程每增加 5 年、年龄≥65 岁需增加 1 个标准疗程。',
        },
      ],
      questions: [
        {
          type: 'single',
          prompt: '菌群移植制品四种剂型的相同点是？',
          options: [
            { key: 'A', text: '活菌量均为 2.5×10^12 CFU/次，分离制备工艺一致' },
            { key: 'B', text: '都通过口服胶囊使用' },
            { key: 'C', text: '储存条件全部为常温' },
          ],
          answer: 'A',
        },
        {
          type: 'single',
          prompt: '肠道良性疾病（如肠易激综合征、慢性便秘）的推荐疗程标准是？',
          options: [
            { key: 'A', text: '1 个标准疗程 + 1 个巩固疗程' },
            { key: 'B', text: '2 个标准疗程 + 2 个巩固疗程' },
            { key: 'C', text: '4 个标准疗程 + 4 个巩固疗程' },
          ],
          answer: 'B',
        },
        {
          type: 'judge',
          prompt: '微移植胶囊在疗程结束后 30 天内每日服用 1 粒，用于巩固移植疗效。',
          options: [
            { key: 'A', text: '正确' },
            { key: 'B', text: '错误' },
          ],
          answer: 'A',
        },
      ],
    },
    {
      code: 'sampling_ops',
      name: '采样与操作规范课',
      category: 'sampling',
      audience: ['sales', 'partner', 'merchant'] as const,
      required: false,
      validityMonths: 12,
      chapters: [
        {
          title: '取样规范：防污染六要点',
          content:
            '① 避免尿液、水、血液污染粪便，取样前排尽尿液；② 可在便池铺垫卫生纸后排便；③ 粪便取中间内部区域，避开接触空气、地面和便池内壁的部分；④ 用无菌勺挖取 1-3 颗黄豆大小（3-5g）；⑤ 放入采样管摇匀盖紧并标记信息；⑥ 女性不建议生理期取样。专用保存液可保护基因组 DNA，室温可保存 7 天。',
        },
        {
          title: '检测前用药限制',
          content:
            '检测前两周停用：抗生素、抗寄生虫药、抗真菌药、益生菌补充剂、质子泵抑制剂（PPIs）、铋剂（长期服用益生菌者不需要停）。检测前两日停用：阿司匹林等非甾体抗炎药、消化酶、泻药、活性炭、抗酸剂。取样前一周不要饮酒。',
        },
        {
          title: '采样指导视频要点',
          content:
            '商品详情与盒码激活页均配有采样指导视频，引导客户观看后再采样。视频讲解取样位置、取样量与封存步骤，配套商品「肠道菌群基因组检测」使用。',
        },
      ],
      questions: [
        {
          type: 'multiple',
          prompt: '肠道菌群检测前两周应停用哪些药物/补充剂？',
          options: [
            { key: 'A', text: '抗生素' },
            { key: 'B', text: '质子泵抑制剂（胃药）' },
            { key: 'C', text: '益生菌补充剂（非长期服用）' },
            { key: 'D', text: '钙片' },
          ],
          answer: ['A', 'B', 'C'],
        },
        {
          type: 'single',
          prompt: '粪便样本应取哪个部位？',
          options: [
            { key: 'A', text: '表面与便池接触的部分' },
            { key: 'B', text: '粪便中间内部、未接触空气与便池的部分' },
            { key: 'C', text: '任意部位混合即可' },
          ],
          answer: 'B',
        },
      ],
    },
    {
      code: 'case_teaching',
      name: '适应症案例教学',
      category: 'case',
      audience: ['sales'] as const,
      required: false,
      validityMonths: 12,
      chapters: [
        {
          title: '肠道疾病案例',
          content:
            '慢性便秘：32 岁患者 3 个疗程后 PAC-SYM 评分 35→11，一周 4 次以上自主排便。溃疡性结肠炎：39 岁患者 4 个疗程后 Mayo 评分 9→4、内镜评分 3→1。肠易激综合征（IBS-D）：单疗程后 IBS-SSS 各分项积分下降、粪便短链脂肪酸改善。',
        },
        {
          title: '代谢与精神案例',
          content:
            '肥胖：47 岁患者 2 个疗程减重 32.3 斤；司美格鲁肽联用 3 个疗程减重 59 斤、空腹血糖 12.3→7.8。2 型糖尿病：3 个疗程空腹血糖 11.32→7.81。自闭症患儿疗程后肠菌种类数 460→1162，社交与语言能力改善；焦虑症 HAMA 评分 24→7.5。',
        },
        {
          title: '案例讲述合规',
          content:
            '讲述案例时必须说明个体差异与「效果因人而异」，禁止承诺疗效、禁止使用「治愈/根治/保证有效」等表述。资料原话：每个人体质不同，精准配型可提高移植成功率，但不承诺 100%。代谢类疾病需配合饮食管理。',
        },
      ],
      questions: [
        {
          type: 'judge',
          prompt: '向客户介绍案例时，可以承诺「坚持做疗程就一定能治愈」。',
          options: [
            { key: 'A', text: '正确' },
            { key: 'B', text: '错误' },
          ],
          answer: 'B',
        },
        {
          type: 'single',
          prompt: '讲述真实案例的正确方式是？',
          options: [
            { key: 'A', text: '引用检测指标变化并说明个体差异、不做疗效承诺' },
            { key: 'B', text: '承诺同款效果' },
            { key: 'C', text: '对比其他机构贬低同行' },
          ],
          answer: 'A',
        },
      ],
    },
  ]

  for (const course of courses) {
    const saved = await prisma.course.upsert({
      where: { code: course.code },
      update: {
        name: course.name,
        category: course.category,
        audience: [...course.audience],
        required: course.required,
        validityMonths: course.validityMonths,
      },
      create: {
        code: course.code,
        name: course.name,
        category: course.category,
        audience: [...course.audience],
        required: course.required,
        validityMonths: course.validityMonths,
      },
    })
    const chapterCount = await prisma.courseChapter.count({ where: { courseId: saved.id } })
    if (chapterCount === 0) {
      await prisma.courseChapter.createMany({
        data: course.chapters.map((chapter, index) => ({
          courseId: saved.id,
          title: chapter.title,
          content: chapter.content,
          order: index,
        })),
      })
    }
    const questionCount = await prisma.examQuestion.count({ where: { courseId: saved.id } })
    if (questionCount === 0) {
      await prisma.examQuestion.createMany({
        data: course.questions.map((question) => ({
          courseId: saved.id,
          type: question.type,
          prompt: question.prompt,
          options: question.options,
          answer: question.answer,
        })),
      })
    }
  }

  const materialTemplates = [
    {
      code: 'poster_health',
      name: '健康检测服务海报',
      category: 'poster',
      contentType: 'image_text',
      body: '{{merchantName}} 健康检测服务\n门店：{{storeName}}\n地址：{{storeAddress}}\n渠道码：{{channelCode}}\n扫码了解检测项目与报告解读服务。',
      lockedClauses: [
        '本报告仅用于健康风险提示，不作为临床诊断依据',
        '检测范围以实际报告为准',
        '禁止承诺疗效或替代医疗建议',
      ],
    },
    {
      code: 'moments_copy',
      name: '朋友圈文案',
      category: 'moments_copy',
      contentType: 'text',
      body: '{{merchantName}} · {{storeName}} 为你准备了居家检测盒。\n扫码激活后可查看检测报告与 AI 解读，也可预约营养师复核。\n渠道码：{{channelCode}}',
      lockedClauses: [
        '本报告仅用于健康风险提示，不作为临床诊断依据',
        '禁止承诺疗效',
      ],
    },
    {
      code: 'compliance_talk',
      name: '合规解读话术',
      category: 'compliance_talk',
      contentType: 'text',
      body: '介绍报告时，请先说明检测范围与报告边界，再解释指标含义。遇到异常项时建议客户结合医生意见复查，不做诊断与用药建议。',
      lockedClauses: [
        '本报告仅用于健康风险提示，不作为临床诊断依据',
        '禁止推荐处方药与剂量',
      ],
    },
  ]

  for (const template of materialTemplates) {
    await prisma.materialTemplate.upsert({
      where: { code: template.code },
      update: {
        name: template.name,
        category: template.category,
        contentType: template.contentType,
        body: template.body,
        lockedClauses: template.lockedClauses,
        active: true,
      },
      create: {
        code: template.code,
        name: template.name,
        category: template.category,
        contentType: template.contentType,
        body: template.body,
        lockedClauses: template.lockedClauses,
      },
    })
  }

  const now = new Date()
  const inOneYear = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)

  const ensureOrganization = async (name: string, type: 'merchant' | 'supplier') => {
    const existing = await prisma.organization.findFirst({ where: { name, type } })
    if (existing) {
      return prisma.organization.update({ where: { id: existing.id }, data: { status: 'active' } })
    }
    return prisma.organization.create({ data: { name, type, status: 'active' } })
  }

  const merchantOrg = await ensureOrganization('演示商家', 'merchant')
  const supplierOrg = await ensureOrganization('演示供应商', 'supplier')

  const merchant = await prisma.user.upsert({
    where: { phone: '13900000001' },
    update: {
      name: '演示商家',
      roles: ['merchant'],
      primaryRole: 'merchant',
      status: 'active',
      organizationId: merchantOrg.id,
    },
    create: {
      phone: '13900000001',
      passwordHash: await bcrypt.hash('Merchant@123', 10),
      name: '演示商家',
      roles: ['merchant'],
      primaryRole: 'merchant',
      status: 'active',
      organizationId: merchantOrg.id,
    },
  })

  const supplier = await prisma.user.upsert({
    where: { phone: '13900000009' },
    update: {
      name: '演示供应商',
      roles: ['supplier'],
      primaryRole: 'supplier',
      status: 'active',
      organizationId: supplierOrg.id,
    },
    create: {
      phone: '13900000009',
      passwordHash: await bcrypt.hash('Supplier@123', 10),
      name: '演示供应商',
      roles: ['supplier'],
      primaryRole: 'supplier',
      status: 'active',
      organizationId: supplierOrg.id,
    },
  })

  const sales = await prisma.user.upsert({
    where: { phone: '13900000002' },
    update: {
      name: '演示销售',
      roles: ['sales'],
      primaryRole: 'sales',
      status: 'active',
      organizationId: merchantOrg.id,
    },
    create: {
      phone: '13900000002',
      passwordHash: await bcrypt.hash('Sales@123', 10),
      name: '演示销售',
      roles: ['sales'],
      primaryRole: 'sales',
      status: 'active',
      organizationId: merchantOrg.id,
    },
  })

  await prisma.user.upsert({
    where: { phone: '13900000003' },
    update: {
      name: '演示客户',
      roles: ['customer'],
      primaryRole: 'customer',
      status: 'active',
      realName: '演示客户',
      idCardNo: '110101199003071236',
      gender: 'male',
    },
    create: {
      phone: '13900000003',
      passwordHash: await bcrypt.hash('Customer@123', 10),
      name: '演示客户',
      roles: ['customer'],
      primaryRole: 'customer',
      status: 'active',
      realName: '演示客户',
      idCardNo: '110101199003071236',
      gender: 'male',
    },
  })

  await prisma.channelIdentity.upsert({
    where: { code: 'MDEMO001' },
    update: { userId: merchant.id, status: 'active' },
    create: { code: 'MDEMO001', type: 'merchant', userId: merchant.id },
  })

  const merchantTemplate = await prisma.contractTemplate.findUnique({
    where: { code_version: { code: 'merchant_onboarding', version: 1 } },
  })
  const supplierTemplate = await prisma.contractTemplate.findUnique({
    where: { code_version: { code: 'supplier_supply', version: 1 } },
  })

  const ensureActiveContract = async (
    contractNo: string,
    templateId: string,
    templateVersion: number,
    subjectUserId: string,
    subjectType: 'merchant' | 'supplier',
  ) => {
    const existing = await prisma.contract.findUnique({ where: { contractNo } })
    if (existing) {
      return prisma.contract.update({
        where: { contractNo },
        data: {
          status: 'active',
          signMode: 'esignbao',
          effectiveAt: existing.effectiveAt ?? now,
          expiresAt: inOneYear,
        },
      })
    }
    return prisma.contract.create({
      data: {
        contractNo,
        templateId,
        templateVersion,
        subjectUserId,
        subjectType,
        status: 'active',
        signMode: 'esignbao',
        effectiveAt: now,
        expiresAt: inOneYear,
        evidenceNo: `DEMO-${contractNo}`,
      },
    })
  }

  if (merchantTemplate) {
    await ensureActiveContract('DEMO-MERCHANT-001', merchantTemplate.id, merchantTemplate.version, merchant.id, 'merchant')
  }
  if (supplierTemplate) {
    await ensureActiveContract('DEMO-SUPPLIER-001', supplierTemplate.id, supplierTemplate.version, supplier.id, 'supplier')
  }

  const demoVideoUrl =
    'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4'

  const demoProducts = [
    {
      skuCode: 'DEMO-BASIC-001',
      name: '基础健康检测盒',
      supplyPriceCents: 9900,
      retailPriceCents: 19900,
      testItems: ['维生素D', '铁蛋白', '同型半胱氨酸'],
      sampleType: '指尖血',
      samplingMethod: '居家采血卡',
      storageCondition: '常温干燥保存',
      shelfLifeDays: 365,
      batchNo: 'DEMO-B001',
      quantity: 500,
    },
    {
      skuCode: 'DEMO-PLUS-001',
      name: '进阶营养检测盒',
      supplyPriceCents: 19900,
      retailPriceCents: 39900,
      testItems: ['维生素A', '维生素B12', '叶酸', '锌', '镁'],
      sampleType: '指尖血',
      samplingMethod: '居家采血卡',
      storageCondition: '常温干燥保存',
      shelfLifeDays: 365,
      batchNo: 'DEMO-P001',
      quantity: 300,
    },
  ]

  // 资料转化方案新增：检测服务与 FMT 产品线（含采样视频/介绍文案/搭配推荐）
  type ContentProduct = {
    skuCode: string
    name: string
    supplyPriceCents: number
    retailPriceCents: number
    testItems: string[]
    sampleType: string
    samplingMethod: string
    storageCondition: string
    shelfLifeDays: number
    guideVideoUrl?: string
    intro: string
    relatedSkuCodes: string[]
    courseCodes: string[]
  }

  const contentProducts: ContentProduct[] = [
    {
      skuCode: 'KIT-GUT-STD-001',
      name: '肠道菌群基因组检测·标准版',
      supplyPriceCents: 89900,
      retailPriceCents: 199900,
      testItems: ['肠道菌群微生态指数5项', '健康评估7项', '代谢评估10项', '疾病风险预测8项'],
      sampleType: '粪便',
      samplingMethod: '居家采样管+保存液（京东上门取件）',
      storageCondition: '阴凉避光保存',
      shelfLifeDays: 730,
      guideVideoUrl: demoVideoUrl,
      intro:
        '高通量宏基因组测序，可检出细菌、真菌、病毒等 3 万多种肠道微生物，报告约 70 页，收样后 7-10 个工作日出具，京东快递上门取件。含 AI 智能解读与专业报告解读服务。本报告仅用于健康风险提示，不作为临床诊断依据。',
      relatedSkuCodes: ['KIT-GUT-EXP-001'],
      courseCodes: ['sampling_ops'],
    },
    {
      skuCode: 'KIT-GUT-EXP-001',
      name: '肠道菌群基因组检测·极速版',
      supplyPriceCents: 129900,
      retailPriceCents: 299900,
      testItems: ['肠道菌群微生态指数6+项', '健康评估10项', '代谢评估16+项', '疾病风险预测39项'],
      sampleType: '粪便',
      samplingMethod: '居家采样管+保存液（京东上门取件）',
      storageCondition: '阴凉避光保存',
      shelfLifeDays: 730,
      guideVideoUrl: demoVideoUrl,
      intro:
        '极速版收样后 3-5 个工作日出报告，报告约 130 页，健康评估与代谢评估维度更全面，疾病风险预测多达 39 项。本报告仅用于健康风险提示，不作为临床诊断依据。',
      relatedSkuCodes: ['KIT-GUT-STD-001'],
      courseCodes: ['sampling_ops'],
    },
    {
      skuCode: 'FMT-CAP-001',
      name: 'FMT 健康人源肠道菌群胶囊',
      supplyPriceCents: 299900,
      retailPriceCents: 599900,
      testItems: ['单次移植活菌数≥2.5万亿CFU'],
      sampleType: '口服肠溶胶囊',
      samplingMethod: '遵医嘱温水吞服',
      storageCondition: '0-4℃ 冷藏，2 个月',
      shelfLifeDays: 60,
      intro:
        '同济医院共建菌库供体，GMP 生产质量管理规范及 P2 实验室环境制备，新型包埋肠溶胶囊技术直达肠道。单次移植活菌数≥2.5 万亿 CFU，远高于国内外共识要求。须在执业医师指导下使用，严禁自行服用。',
      relatedSkuCodes: ['FMT-ADJ-001'],
      courseCodes: ['product_knowledge', 'sampling_ops'],
    },
    {
      skuCode: 'FMT-ADJ-001',
      name: 'FMT 专用辅剂',
      supplyPriceCents: 39900,
      retailPriceCents: 89900,
      testItems: ['活菌量≥1.5万亿CFU/瓶'],
      sampleType: '口服液态（A液+B液）',
      samplingMethod: '早晨空腹，温开水稀释胃酸后混合服用',
      storageCondition: '0-4℃ 冷藏，15 天，不可冷冻',
      shelfLifeDays: 15,
      intro:
        '同济医院专家团队自主研发的院线级专供制剂，优选动物双歧杆菌 BB-12、鼠李糖乳杆菌 GG 等菌株，不添加任何防腐剂。可单独使用（6 天/疗程），也可配合菌群移植使用，增强移植菌群定植率。',
      relatedSkuCodes: ['FMT-CAP-001'],
      courseCodes: ['product_knowledge'],
    },
  ]

  for (const item of demoProducts) {
    const product = await prisma.product.upsert({
      where: { skuCode: item.skuCode },
      update: {
        name: item.name,
        supplierId: supplier.id,
        testItems: item.testItems,
        sampleType: item.sampleType,
        samplingMethod: item.samplingMethod,
        storageCondition: item.storageCondition,
        shelfLifeDays: item.shelfLifeDays,
        supplyPriceCents: item.supplyPriceCents,
        suggestedRetailPriceCents: item.retailPriceCents,
        retailPriceCents: item.retailPriceCents,
        platformServiceRateBps: 1000,
        commissionRateCapBps: 2000,
        distributable: true,
        status: 'active',
        guideVideoUrl: demoVideoUrl,
      },
      create: {
        skuCode: item.skuCode,
        name: item.name,
        supplierId: supplier.id,
        testItems: item.testItems,
        sampleType: item.sampleType,
        samplingMethod: item.samplingMethod,
        storageCondition: item.storageCondition,
        shelfLifeDays: item.shelfLifeDays,
        supplyPriceCents: item.supplyPriceCents,
        suggestedRetailPriceCents: item.retailPriceCents,
        retailPriceCents: item.retailPriceCents,
        platformServiceRateBps: 1000,
        commissionRateCapBps: 2000,
        distributable: true,
        status: 'active',
        guideVideoUrl: demoVideoUrl,
      },
    })

    await prisma.batch.upsert({
      where: { productId_batchNo: { productId: product.id, batchNo: item.batchNo } },
      update: { expiresAt: inOneYear, quantity: item.quantity },
      create: {
        productId: product.id,
        batchNo: item.batchNo,
        productionDate: now,
        expiresAt: inOneYear,
        quantity: item.quantity,
        remaining: item.quantity,
      },
    })

    await prisma.merchantProduct.upsert({
      where: { merchantId_productId: { merchantId: merchant.id, productId: product.id } },
      update: { retailPriceCents: item.retailPriceCents, status: 'active' },
      create: {
        merchantId: merchant.id,
        productId: product.id,
        retailPriceCents: item.retailPriceCents,
      },
    })
  }

  // 资料转化方案商品：创建后回填搭配推荐（ProductRelated）与课程绑定（ProductCourse）
  const productIdBySku = new Map<string, string>()
  const courseIdByCode = new Map<string, string>()
  for (const course of await prisma.course.findMany({ select: { id: true, code: true } })) {
    courseIdByCode.set(course.code, course.id)
  }

  for (const item of contentProducts) {
    const product = await prisma.product.upsert({
      where: { skuCode: item.skuCode },
      update: {
        name: item.name,
        supplierId: supplier.id,
        testItems: item.testItems,
        sampleType: item.sampleType,
        samplingMethod: item.samplingMethod,
        storageCondition: item.storageCondition,
        shelfLifeDays: item.shelfLifeDays,
        supplyPriceCents: item.supplyPriceCents,
        suggestedRetailPriceCents: item.retailPriceCents,
        retailPriceCents: item.retailPriceCents,
        platformServiceRateBps: 1000,
        commissionRateCapBps: 2000,
        distributable: true,
        status: 'active',
        guideVideoUrl: item.guideVideoUrl ?? null,
        intro: item.intro,
      },
      create: {
        skuCode: item.skuCode,
        name: item.name,
        supplierId: supplier.id,
        testItems: item.testItems,
        sampleType: item.sampleType,
        samplingMethod: item.samplingMethod,
        storageCondition: item.storageCondition,
        shelfLifeDays: item.shelfLifeDays,
        supplyPriceCents: item.supplyPriceCents,
        suggestedRetailPriceCents: item.retailPriceCents,
        retailPriceCents: item.retailPriceCents,
        platformServiceRateBps: 1000,
        commissionRateCapBps: 2000,
        distributable: true,
        status: 'active',
        guideVideoUrl: item.guideVideoUrl ?? null,
        intro: item.intro,
      },
    })
    productIdBySku.set(item.skuCode, product.id)

    await prisma.batch.upsert({
      where: { productId_batchNo: { productId: product.id, batchNo: `${item.skuCode}-B1` } },
      update: { expiresAt: inOneYear, quantity: 200 },
      create: {
        productId: product.id,
        batchNo: `${item.skuCode}-B1`,
        productionDate: now,
        expiresAt: inOneYear,
        quantity: 200,
        remaining: 200,
      },
    })

    await prisma.merchantProduct.upsert({
      where: { merchantId_productId: { merchantId: merchant.id, productId: product.id } },
      update: { retailPriceCents: item.retailPriceCents, status: 'active' },
      create: {
        merchantId: merchant.id,
        productId: product.id,
        retailPriceCents: item.retailPriceCents,
      },
    })
  }

  for (const item of contentProducts) {
    const productId = productIdBySku.get(item.skuCode)
    if (!productId) continue
    for (const [sort, relatedSku] of item.relatedSkuCodes.entries()) {
      const relatedProductId = productIdBySku.get(relatedSku)
      if (!relatedProductId || relatedProductId === productId) continue
      await prisma.productRelated.upsert({
        where: {
          productId_relatedProductId: { productId, relatedProductId },
        },
        update: { sort },
        create: { productId, relatedProductId, sort },
      })
    }
    for (const courseCode of item.courseCodes) {
      const courseId = courseIdByCode.get(courseCode)
      if (!courseId) continue
      await prisma.productCourse.upsert({
        where: { productId_courseId: { productId, courseId } },
        update: {},
        create: { productId, courseId },
      })
    }
  }

  let account = await prisma.prepaidAccount.findUnique({ where: { merchantId: merchant.id } })
  if (!account) {
    account = await prisma.prepaidAccount.create({
      data: {
        merchantId: merchant.id,
        availableCents: 500000,
        totalRechargeCents: 500000,
      },
    })
  }
  const ledgerCount = await prisma.prepaidLedger.count({ where: { accountId: account.id } })
  if (ledgerCount === 0) {
    await prisma.prepaidLedger.create({
      data: {
        accountId: account.id,
        type: 'recharge',
        amountCents: 500000,
        balanceAfterCents: account.availableCents,
        frozenAfterCents: account.frozenCents,
        note: '演示初始充值 5000 元',
      },
    })
  }

  const salesCourses = await prisma.course.findMany({ where: { audience: { has: 'sales' } } })
  for (const course of salesCourses) {
    await prisma.learningRecord.upsert({
      where: { userId_courseId: { userId: sales.id, courseId: course.id } },
      update: {},
      create: { userId: sales.id, courseId: course.id },
    })
  }

  console.log(
    'Seed completed: platform admin 13800000000 / Admin@123, merchant 13900000001 / Merchant@123, sales 13900000002 / Sales@123, supplier 13900000009 / Supplier@123, demo products, contracts and prepaid balance',
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
