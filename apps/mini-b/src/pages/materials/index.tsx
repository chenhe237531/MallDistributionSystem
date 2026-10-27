import { useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { Text, View } from '@tarojs/components'
import { api, ensureLogin } from '../../lib/api'
import {
  Button as NutButton,
  Cell,
  CellGroup,
  Empty,
  Tag,
  Toast,
} from '@nutui/nutui-react-taro'
import { useTheme } from '../../lib/theme'

type Template = { id: string; name: string; category: string; body: string }
type Material = { id: string; title: string; content: string }

const toast = (title: string, icon?: 'success' | 'fail') =>
  Toast.show('b-toast', { title, icon })

export default function Materials() {
  const { themeClass } = useTheme()
  const [templates, setTemplates] = useState<Template[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const [loading, setLoading] = useState(false)

  const load = async () => {
    const [templateList, materialList] = await Promise.all([
      api<Template[]>('/materials/templates'),
      api<Material[]>('/materials/me'),
    ])
    setTemplates(templateList)
    setMaterials(materialList)
  }

  useDidShow(() => {
    if (!ensureLogin()) {
      return
    }
    void load().catch((cause) => {
      void Taro.showToast({ title: cause instanceof Error ? cause.message : '加载失败', icon: 'none' })
    })
  })

  const generate = async (templateId: string) => {
    setLoading(true)
    try {
      await api('/materials/generate', { method: 'POST', data: { templateId } })
      toast('素材已生成', 'success')
      await load()
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : '生成失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className={`page ${themeClass}`}>
      <View className="section">
        <Text className="section-title">平台模板</Text>
        {templates.length === 0 ? <Empty description="暂无模板" /> : null}
        {templates.map((template) => (
          <View key={template.id} className="card">
            <View className="row">
              <Text className="mat-name">{template.name}</Text>
              <Tag type="success">{template.category}</Tag>
            </View>
            <Text className="muted">{template.body.slice(0, 60)}…</Text>
            <NutButton
              className="mat-generate"
              block
              type="primary"
              size="small"
              loading={loading}
              onClick={() => generate(template.id)}
            >
              生成带渠道码素材
            </NutButton>
          </View>
        ))}
      </View>

      <View className="section">
        <Text className="section-title">已生成素材</Text>
        {materials.length === 0 ? (
          <Empty description="暂无素材" />
        ) : (
          <CellGroup>
            {materials.map((material) => (
              <Cell
                key={material.id}
                title={material.title}
                description={<Text className="muted">{material.content.slice(0, 80)}…</Text>}
              />
            ))}
          </CellGroup>
        )}
      </View>

      <Toast id="b-toast" />
    </View>
  )
}
