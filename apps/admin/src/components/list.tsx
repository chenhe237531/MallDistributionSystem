import { Alert } from 'antd'

/**
 * FR-A3：高频列表页统一配置。
 * API 未分页前采用前端分页；列显隐按页面 key 记忆（localStorage）；
 * 数据量超过阈值时开启虚拟滚动并提示筛选。
 */

export const LIST_PAGE_SIZE = 20
export const LIST_PAGE_SIZE_OPTIONS = ['20', '50', '100', '200']
/** 超过该条数开启虚拟滚动（渲染层面），并提示筛选 */
export const LIST_VIRTUAL_THRESHOLD = 2000

/** ProTable 通用 props：列记忆 + 前端分页 + 小屏横向滚动（H5 兼容） */
export function listTableProps(key: string) {
  return {
    columnsState: {
      persistenceKey: `admin-table-${key}`,
      persistenceType: 'localStorage' as const,
    },
    scroll: { x: 'max-content' as const },
    pagination: {
      pageSize: LIST_PAGE_SIZE,
      pageSizeOptions: LIST_PAGE_SIZE_OPTIONS,
      showSizeChanger: true,
      showTotal: (total: number) => `共 ${total} 条`,
    },
  }
}

/** 大数据量时的表格 props（虚拟滚动） */
export function virtualTableProps() {
  return {
    virtual: true,
    scroll: { x: 'max-content' as const, y: 480 },
    pagination: {
      pageSize: LIST_PAGE_SIZE,
      pageSizeOptions: LIST_PAGE_SIZE_OPTIONS,
      showSizeChanger: true,
      showTotal: (total: number) => `共 ${total} 条`,
    },
  }
}

/** 大数据量提示条 */
export function VolumeAlert({ total, threshold = LIST_VIRTUAL_THRESHOLD }: { total: number; threshold?: number }) {
  if (total <= threshold) {
    return null
  }
  return (
    <Alert
      type="warning"
      showIcon
      style={{ marginBottom: 12 }}
      message={`当前共 ${total} 条数据，已启用虚拟滚动以保持流畅；建议按状态等条件筛选缩小范围。`}
    />
  )
}

/** 判断给定数据量是否需要虚拟滚动 */
export function shouldVirtual(total: number, threshold = LIST_VIRTUAL_THRESHOLD): boolean {
  return total > threshold
}
