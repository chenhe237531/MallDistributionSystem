import { useRef, useState } from 'react'
import { Button, Descriptions, Drawer, Empty, Image as AntImage, Space, Tag, Typography, message } from 'antd'
import type { ActionType, ProColumns } from '@ant-design/pro-components'
import {
  ModalForm,
  PageContainer,
  ProFormDigit,
  ProFormSelect,
  ProFormSwitch,
  ProFormText,
  ProFormTextArea,
  ProTable,
} from '@ant-design/pro-components'
import { PRODUCT_CATEGORIES, formatCents, productCategoryLabel } from '@mall/shared'
import { api } from '../lib/api'

const { Text, Paragraph } = Typography

type Batch = { id: string; batchNo: string; quantity: number; expiresAt?: string }

type ProductSummary = { id: string; name: string; skuCode: string }

type CourseSummary = { id: string; name: string; category: string }

type Product = {
  id: string
  skuCode: string
  name: string
  testItems: string[]
  sampleType: string
  samplingMethod: string
  storageCondition: string
  supplyPriceCents: number
  suggestedRetailPriceCents?: number
  retailPriceCents?: number
  platformServiceRateBps: number
  commissionRateCapBps: number
  distributable: boolean
  status: string
  guideVideoUrl?: string | null
  intro?: string | null
  images?: string[]
  category?: string | null
  relatedProducts?: ProductSummary[]
  boundCourses?: CourseSummary[]
  supplier?: { id: string; name: string; organization?: { name: string } | null } | null
  batches: Batch[]
  createdAt: string
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  draft: { label: '待审核', color: 'gold' },
  active: { label: '在售', color: 'green' },
  inactive: { label: '下架', color: 'default' },
}

const bpsToPercent = (bps: number) => `${(bps / 100).toFixed(2)}%`

type ReviewValues = {
  retailPriceYuan: number
  platformServiceRate: number
  commissionRateCap: number
  distributable: boolean
  status: 'active' | 'inactive'
}

type AllocateValues = { quantity: number }

type ContentValues = {
  guideVideoUrl?: string
  intro?: string
  imagesText?: string
  category?: string
  relatedProductIds?: string[]
  boundCourseIds?: string[]
}

export default function ProductsPage() {
  const actionRef = useRef<ActionType>()
  const [reviewTarget, setReviewTarget] = useState<Product | null>(null)
  const [allocateTarget, setAllocateTarget] = useState<Product | null>(null)
  const [detail, setDetail] = useState<Product | null>(null)
  const [contentTarget, setContentTarget] = useState<Product | null>(null)

  const reload = () => actionRef.current?.reload()

  const openDetail = async (id: string) => {
    setDetail(await api<Product>(`/products/${id}`))
  }

  const columns: ProColumns<Product>[] = [
    { title: 'SKU', dataIndex: 'skuCode', width: 140, copyable: true },
    {
      title: '商品',
      dataIndex: 'name',
      render: (_, entity) => (
        <Space size={8}>
          <AntImage
            src={entity.images?.[0]}
            width={44}
            height={44}
            style={{ objectFit: 'cover', borderRadius: 8, background: '#f7f8fa' }}
            fallback="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0NCIgaGVpZ2h0PSI0NCI+PHJlY3Qgd2lkdGg9IjQ0IiBoZWlnaHQ9IjQ0IiBmaWxsPSIjZWZlY2ZmIi8+PC9zdmc+"
          />
          <Space direction="vertical" size={0}>
            <Text strong>{entity.name}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {productCategoryLabel(entity.category)} · {entity.sampleType}
              {entity.testItems?.length ? ` · ${entity.testItems.join(' / ')}` : ''}
            </Text>
          </Space>
        </Space>
      ),
    },
    {
      title: '供应商',
      width: 150,
      render: (_, entity) => entity.supplier?.organization?.name ?? entity.supplier?.name ?? '—',
    },
    {
      title: '供货价',
      dataIndex: 'supplyPriceCents',
      width: 100,
      renderText: (value: number) => formatCents(value),
    },
    {
      title: '零售价',
      dataIndex: 'retailPriceCents',
      width: 100,
      renderText: (value?: number) => (value ? formatCents(value) : '—'),
    },
    {
      title: '费率（服务/佣金上限）',
      width: 150,
      render: (_, entity) =>
        `${bpsToPercent(entity.platformServiceRateBps)} / ${bpsToPercent(entity.commissionRateCapBps)}`,
    },
    {
      title: '批次',
      width: 80,
      renderText: (_, entity) => entity.batches?.length ?? 0,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (_, entity) => {
        const meta = STATUS_META[entity.status] ?? { label: entity.status, color: 'default' }
        return <Tag color={meta.color}>{meta.label}</Tag>
      },
    },
    {
      title: '操作',
      valueType: 'option',
      width: 260,
      render: (_, entity) => [
        <a key="detail" onClick={() => void openDetail(entity.id)}>
          详情
        </a>,
        <a key="review" onClick={() => setReviewTarget(entity)}>
          定价审核
        </a>,
        <a key="allocate" onClick={() => setAllocateTarget(entity)}>
          补充库存
        </a>,
        <a key="content" onClick={() => setContentTarget(entity)}>
          内容运营
        </a>,
      ],
    },
  ]

  return (
    <PageContainer
      header={{ title: '商品与库存', subTitle: '商品审核、定价与批次库存' }}
      content="审核供应商提交的商品，设定零售价与费率上限，管理入库批次与平台可用库存。"
    >
      <ProTable<Product>
        scroll={{ x: 'max-content' }}
        rowKey="id"
        actionRef={actionRef}
        columns={columns}
        search={false}
        options={{ reload: true, density: true, setting: true }}
        pagination={{ pageSize: 10 }}
        request={async () => {
          const data = await api<Product[]>('/products')
          return { data, success: true }
        }}
      />

      <ModalForm<ReviewValues>
        title={`定价审核 · ${reviewTarget?.name ?? ''}`}
        width={520}
        open={Boolean(reviewTarget)}
        modalProps={{ onCancel: () => setReviewTarget(null) }}
        onOpenChange={(open) => {
          if (!open) setReviewTarget(null)
        }}
        initialValues={
          reviewTarget
            ? {
                retailPriceYuan:
                  (reviewTarget.retailPriceCents ??
                    reviewTarget.suggestedRetailPriceCents ??
                    reviewTarget.supplyPriceCents) / 100,
                platformServiceRate: reviewTarget.platformServiceRateBps / 100,
                commissionRateCap: reviewTarget.commissionRateCapBps / 100,
                distributable: reviewTarget.distributable,
                status: (reviewTarget.status === 'inactive' ? 'inactive' : 'active') as
                  | 'active'
                  | 'inactive',
              }
            : undefined
        }
        onFinish={async (values) => {
          if (!reviewTarget) return false
          await api(`/products/${reviewTarget.id}/review`, {
            method: 'POST',
            body: JSON.stringify({
              retailPriceCents: Math.round(values.retailPriceYuan * 100),
              platformServiceRateBps: Math.round(values.platformServiceRate * 100),
              commissionRateCapBps: Math.round(values.commissionRateCap * 100),
              distributable: values.distributable,
              status: values.status,
            }),
          })
          message.success('审核已提交')
          setReviewTarget(null)
          reload()
          return true
        }}
      >
        <ProFormDigit
          name="retailPriceYuan"
          label="零售价（元）"
          min={0.01}
          rules={[{ required: true, message: '请输入零售价' }]}
          extra={`供货价 ${reviewTarget ? formatCents(reviewTarget.supplyPriceCents) : '—'}，零售价不得低于供货价`}
        />
        <ProFormDigit
          name="platformServiceRate"
          label="平台服务费率（%）"
          min={0}
          max={100}
          rules={[{ required: true, message: '请输入平台服务费率' }]}
          extra="服务费率与佣金上限之和不能超过 100%"
        />
        <ProFormDigit
          name="commissionRateCap"
          label="佣金上限费率（%）"
          min={0}
          max={100}
          rules={[{ required: true, message: '请输入佣金上限' }]}
        />
        <ProFormSwitch name="distributable" label="允许分销" />
        <ProFormSelect
          name="status"
          label="上架状态"
          options={[
            { label: '在售', value: 'active' },
            { label: '下架', value: 'inactive' },
          ]}
          rules={[{ required: true }]}
        />
      </ModalForm>

      <ModalForm<AllocateValues>
        title={`补充库存 · ${allocateTarget?.skuCode ?? ''}`}
        width={420}
        open={Boolean(allocateTarget)}
        modalProps={{ onCancel: () => setAllocateTarget(null) }}
        onOpenChange={(open) => {
          if (!open) setAllocateTarget(null)
        }}
        onFinish={async (values) => {
          if (!allocateTarget) return false
          await api(`/products/${allocateTarget.id}/allocate`, {
            method: 'POST',
            body: JSON.stringify({ quantity: values.quantity }),
          })
          message.success('库存已补充')
          setAllocateTarget(null)
          reload()
          return true
        }}
      >
        <ProFormDigit
          name="quantity"
          label="补充数量（盒）"
          min={1}
          fieldProps={{ precision: 0 }}
          rules={[{ required: true, message: '请输入补充数量' }]}
        />
      </ModalForm>

      <ModalForm<ContentValues>
        title={`内容运营 · ${contentTarget?.name ?? ''}`}
        width={620}
        open={Boolean(contentTarget)}
        modalProps={{ onCancel: () => setContentTarget(null) }}
        onOpenChange={(open) => {
          if (!open) setContentTarget(null)
        }}
        initialValues={
          contentTarget
            ? {
                guideVideoUrl: contentTarget.guideVideoUrl ?? '',
                intro: contentTarget.intro ?? '',
                imagesText: (contentTarget.images ?? []).join('\n'),
                category: contentTarget.category ?? undefined,
                relatedProductIds: (contentTarget.relatedProducts ?? []).map((item) => item.id),
                boundCourseIds: (contentTarget.boundCourses ?? []).map((item) => item.id),
              }
            : undefined
        }
        onFinish={async (values) => {
          if (!contentTarget) return false
          const images = (values.imagesText ?? '')
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
          await api(`/products/${contentTarget.id}/content`, {
            method: 'PATCH',
            body: JSON.stringify({
              guideVideoUrl: values.guideVideoUrl || null,
              intro: values.intro || null,
              images,
              category: values.category ?? null,
              relatedProductIds: values.relatedProductIds ?? [],
              boundCourseIds: values.boundCourseIds ?? [],
            }),
          })
          message.success('内容配置已保存')
          setContentTarget(null)
          if (detail?.id === contentTarget.id) {
            void openDetail(detail.id)
          }
          reload()
          return true
        }}
      >
        <ProFormSelect
          name="category"
          label="商品分类"
          placeholder="选择采购页侧栏归类"
          options={PRODUCT_CATEGORIES.map((item) => ({ label: item.label, value: item.key }))}
          rules={[{ required: true, message: '请选择商品分类' }]}
          extra="落库 Product.category，采购页按此字段过滤，不再按商品名关键词猜测"
        />
        <ProFormTextArea
          name="imagesText"
          label="商品图片 URL"
          fieldProps={{ rows: 4, maxLength: 4000, showCount: true }}
          placeholder={'/uploads/products/FMT-CAP-001/01.jpg\n每行一个 URL，第一行为列表主图'}
          extra="支持相对地址（/uploads/...）或完整 https 地址；建议 1:1 主图 + 详情图，最多 9 张"
        />
        <ProFormText
          name="guideVideoUrl"
          label="采样指导视频 URL"
          placeholder="https://...（mp4 地址，C 端激活页与商城展示）"
          rules={[
            {
              pattern: /^(https?:\/\/)?\S+$/,
              message: '请输入合法 URL',
            },
          ]}
          extra="原始视频文件不入代码库，上传 OSS/CDN 后粘贴地址"
        />
        <ProFormTextArea
          name="intro"
          label="商品介绍文案"
          fieldProps={{ rows: 5, maxLength: 2000, showCount: true }}
          placeholder="展示在 C 端商城与盒码激活页；页面顶部与页脚预留企业标识位置"
        />
        <ProFormSelect
          name="relatedProductIds"
          label="搭配推荐商品"
          mode="multiple"
          placeholder="选择要搭配推荐的商品"
          request={async () => {
            const data = await api<Product[]>('/products')
            return data.map((item) => ({
              label: `${item.name}（${item.skuCode}）`,
              value: item.id,
            }))
          }}
          extra="展示在 C 端商城商品卡片，作为搭配购买入口"
        />
        <ProFormSelect
          name="boundCourseIds"
          label="绑定培训课程"
          mode="multiple"
          placeholder="选择销售该商品前需学习的课程"
          request={async () => {
            const data = await api<Array<{ id: string; name: string; category: string }>>(
              '/training/courses',
            )
            return data.map((item) => ({ label: item.name, value: item.id }))
          }}
          extra="商品与培训内容互相引用，销售/渠道角色可在培训中心学习"
        />
      </ModalForm>

      <Drawer
        width={560}
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail ? `${detail.name}（${detail.skuCode}）` : '商品详情'}
      >
        {detail ? (
          <Space direction="vertical" size={16} style={{ display: 'flex' }}>
            <Descriptions column={{ xs: 1, sm: 2 }} size="small" bordered>
              <Descriptions.Item label="状态">
                <Tag color={STATUS_META[detail.status]?.color ?? 'default'}>
                  {STATUS_META[detail.status]?.label ?? detail.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="供应商">
                {detail.supplier?.organization?.name ?? detail.supplier?.name ?? '—'}
              </Descriptions.Item>
              <Descriptions.Item label="分类">{productCategoryLabel(detail.category)}</Descriptions.Item>
              <Descriptions.Item label="采样方式">{detail.samplingMethod}</Descriptions.Item>
              <Descriptions.Item label="存储条件">{detail.storageCondition}</Descriptions.Item>
              <Descriptions.Item label="供货价">{formatCents(detail.supplyPriceCents)}</Descriptions.Item>
              <Descriptions.Item label="零售价">
                {detail.retailPriceCents ? formatCents(detail.retailPriceCents) : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="检测项目" span={2}>
                {detail.testItems?.join('、') || '—'}
              </Descriptions.Item>
            </Descriptions>
            <Space direction="vertical" size={4} style={{ display: 'flex' }}>
              <Text strong>商品图片</Text>
              {detail.images?.length ? (
                <Space wrap>
                  {detail.images.map((src) => (
                    <AntImage key={src} src={src} width={88} height={88} style={{ objectFit: 'cover', borderRadius: 8 }} />
                  ))}
                </Space>
              ) : (
                <Text type="secondary">未配置（商家端显示品牌占位图）</Text>
              )}
            </Space>
            <Space direction="vertical" size={4} style={{ display: 'flex' }}>
              <Text strong>内容运营</Text>
              <Paragraph style={{ marginBottom: 0 }}>
                采样视频：
                {detail.guideVideoUrl ? (
                  <Text copyable style={{ wordBreak: 'break-all' }}>
                    {detail.guideVideoUrl}
                  </Text>
                ) : (
                  '未配置'
                )}
              </Paragraph>
              <Paragraph
                style={{ marginBottom: 0 }}
                ellipsis={{ rows: 3, expandable: true, symbol: '展开' }}
              >
                介绍文案：{detail.intro || '未配置'}
              </Paragraph>
              <div>
                <Text type="secondary">搭配推荐：</Text>
                {detail.relatedProducts?.length ? (
                  detail.relatedProducts.map((item) => (
                    <Tag key={item.id} color="blue">
                      {item.name}
                    </Tag>
                  ))
                ) : (
                  <Text type="secondary">无</Text>
                )}
              </div>
              <div>
                <Text type="secondary">绑定课程：</Text>
                {detail.boundCourses?.length ? (
                  detail.boundCourses.map((item) => (
                    <Tag key={item.id} color="purple">
                      {item.name}
                    </Tag>
                  ))
                ) : (
                  <Text type="secondary">无</Text>
                )}
              </div>
              <Button block onClick={() => setContentTarget(detail)}>
                编辑内容运营
              </Button>
            </Space>
            <Text strong>入库批次</Text>
            {detail.batches?.length ? (
              <ProTable<Batch>
                scroll={{ x: 'max-content' }}
                rowKey="id"
                size="small"
                search={false}
                options={false}
                pagination={false}
                columns={[
                  { title: '批次号', dataIndex: 'batchNo' },
                  { title: '数量', dataIndex: 'quantity', renderText: (v: number) => `${v} 盒` },
                  {
                    title: '有效期至',
                    dataIndex: 'expiresAt',
                    renderText: (v?: string) => (v ? v.slice(0, 10) : '—'),
                  },
                ]}
                dataSource={detail.batches}
              />
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无批次" />
            )}
            <Button
              block
              onClick={() => setReviewTarget(detail)}
              disabled={detail.status === 'draft' ? false : true}
            >
              {detail.status === 'draft' ? '前往定价审核' : '该商品已审核（可再次调整）'}
            </Button>
          </Space>
        ) : null}
      </Drawer>
    </PageContainer>
  )
}
