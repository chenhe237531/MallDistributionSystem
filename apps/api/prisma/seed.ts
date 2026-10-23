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
