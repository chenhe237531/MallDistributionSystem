import { useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { Text, View } from '@tarojs/components'
import { RECHARGE_STATUS_LABELS, RECHARGE_STATUS_TONES, formatCents, parseYuanToCents, statusLabel } from '@mall/shared'
import { api, ensureLogin } from '../../lib/api'
import {
  Button as NutButton,
  Cell,
  CellGroup,
  Empty,
  Input as NutInput,
  Tag,
  Toast,
} from '@nutui/nutui-react-taro'
import { useTheme } from '../../lib/theme'

type Entry = {
  id: string
  type: string
  amountCents: number
  balanceAfterCents: number
  relatedId?: string | null
  operatorId?: string | null
  createdAt: string
}
type Recharge = { id: string; rechargeNo: string; amountCents: number; status: string }
type Prepaid = {
  account: { availableCents: number; frozenCents: number }
  entries: Entry[]
  recharges: Recharge[]
}

const toast = (title: string, icon?: 'success' | 'fail') =>
  Toast.show('b-toast', { title, icon })

const ENTRY_TYPE_LABELS: Record<string, string> = {
  recharge: '充值入账',
  freeze: '冻结',
  deduct: '扣款',
  unfreeze: '解冻',
  refund: '退款',
  adjust: '调整',
}

const pad2 = (value: number) => String(value).padStart(2, '0')

const toDateText = (date: Date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`

const formatDateTime = (iso: string) => {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return iso
  }
  return `${toDateText(date)} ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`
}

/** CSV 单元格转义：包含逗号、引号或换行时用引号包裹 */
const csvCell = (value: string) =>
  /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value

const buildCsv = (entries: Entry[]) => {
  const header = ['时间', '类型', '金额（元）', '关联单号', '变更前余额', '变更后余额', '操作人']
  const rows = entries.map((entry) => [
    formatDateTime(entry.createdAt),
    ENTRY_TYPE_LABELS[entry.type] ?? entry.type,
    formatCents(entry.amountCents),
    entry.relatedId ?? '',
    formatCents(entry.balanceAfterCents - entry.amountCents),
    formatCents(entry.balanceAfterCents),
    entry.operatorId ?? '系统',
  ])
  return `\uFEFF${[header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n')}`
}

export default function Prepaid() {
  const { themeClass } = useTheme()
  const [data, setData] = useState<Prepaid | null>(null)
  const [amount, setAmount] = useState('')
  const [voucher, setVoucher] = useState('')
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)

  const load = async () => {
    setData(await api<Prepaid>('/prepaid/me'))
  }

  useDidShow(() => {
    if (!ensureLogin()) {
      return
    }
    void load().catch((cause) => {
      void Taro.showToast({ title: cause instanceof Error ? cause.message : '加载失败', icon: 'none' })
    })
  })

  const submit = async () => {
    const cents = parseYuanToCents(amount)
    if (!cents || cents <= 0) {
      toast('请输入正确金额')
      return
    }
    setLoading(true)
    try {
      await api('/prepaid/recharges', {
        method: 'POST',
        data: {
          amountCents: cents,
          paidAmountCents: cents,
          voucherUrl: voucher || undefined,
        },
      })
      toast('充值申请已提交', 'success')
      setAmount('')
      setVoucher('')
      await load()
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : '提交失败')
    } finally {
      setLoading(false)
    }
  }

  const exportEntries = async () => {
    if (!data || data.entries.length === 0) {
      toast('暂无流水可导出')
      return
    }
    setExporting(true)
    try {
      const entries = await api<Entry[]>('/prepaid/entries')
      if (entries.length === 0) {
        toast('暂无流水可导出')
        return
      }
      if (Taro.getEnv() !== Taro.ENV_TYPE.WEB) {
        toast('请在 H5 端使用导出功能')
        return
      }
      const blob = new Blob([buildCsv(entries)], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `prepaid-entries-${toDateText(new Date())}.csv`
      link.click()
      URL.revokeObjectURL(url)
      toast('导出成功', 'success')
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : '导出失败')
    } finally {
      setExporting(false)
    }
  }

  const hasEntries = Boolean(data && data.entries.length > 0)

  return (
    <View className={`page ${themeClass}`}>
      <View className="hero">
        <Text className="hero-role">预付款账户</Text>
        <Text className="hero-title">
          {data ? formatCents(data.account.availableCents) : '—'} 元
        </Text>
        <Text className="hero-status">
          冻结 {data ? formatCents(data.account.frozenCents) : '—'} 元
        </Text>
      </View>

      <View className="section">
        <Text className="section-title">发起充值</Text>
        <View className="card">
          <View className="form-field">
            <Text className="form-label">充值金额（元）</Text>
            <NutInput
              type="digit"
              value={amount}
              placeholder="请输入充值金额"
              onChange={(value) => setAmount(value)}
            />
          </View>
          <View className="form-field">
            <Text className="form-label">打款凭证地址（选填）</Text>
            <NutInput
              value={voucher}
              placeholder="请输入打款凭证地址"
              onChange={(value) => setVoucher(value)}
            />
          </View>
          <NutButton className="form-submit" block type="primary" loading={loading} onClick={submit}>
            提交充值申请
          </NutButton>
          <Text className="muted form-hint">线下打款后由平台财务入账，系统不发起支付。</Text>
        </View>
      </View>

      <View className="section">
        <View className="prepaid-section-head">
          <Text className="section-title">流水</Text>
          <NutButton
            className="prepaid-export"
            size="small"
            type="primary"
            fill="outline"
            loading={exporting}
            disabled={!hasEntries}
            onClick={exportEntries}
          >
            导出流水
          </NutButton>
        </View>
        {hasEntries ? (
          <CellGroup>
            {data!.entries.map((entry) => (
              <Cell
                key={entry.id}
                title={ENTRY_TYPE_LABELS[entry.type] ?? entry.type}
                description={<Text className="muted">{formatDateTime(entry.createdAt)}</Text>}
                extra={
                  <Text className={entry.amountCents >= 0 ? 'biz-amount' : 'biz-amount-negative'}>
                    {formatCents(entry.amountCents)} 元
                  </Text>
                }
              />
            ))}
          </CellGroup>
        ) : (
          <Empty description="暂无流水" />
        )}
        {hasEntries ? (
          <Text className="muted form-hint">导出为 CSV 文件，最多包含最近 100 条流水。</Text>
        ) : null}
      </View>

      <View className="section">
        <Text className="section-title">充值单</Text>
        {data && data.recharges.length > 0 ? (
          <CellGroup>
            {data.recharges.map((recharge) => (
              <Cell
                key={recharge.id}
                title={recharge.rechargeNo}
                description={
                  <Text className="biz-amount">{formatCents(recharge.amountCents)} 元</Text>
                }
                extra={
                  <Tag type={RECHARGE_STATUS_TONES[recharge.status] ?? 'default'}>
                    {statusLabel(RECHARGE_STATUS_LABELS, recharge.status)}
                  </Tag>
                }
              />
            ))}
          </CellGroup>
        ) : (
          <Empty description="暂无充值单" />
        )}
      </View>

      <Toast id="b-toast" />
    </View>
  )
}
