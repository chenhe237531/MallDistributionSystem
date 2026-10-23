import { useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { Button, Text, View } from '@tarojs/components'
import { api, ensureLogin } from '../../lib/api'

type Template = { id: string; name: string; category: string; body: string }
type Material = { id: string; title: string; content: string }

export default function Materials() {
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
      void Taro.showToast({ title: '素材已生成', icon: 'success' })
      await load()
    } catch (cause) {
      void Taro.showToast({ title: cause instanceof Error ? cause.message : '生成失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className="page">
      <View className="section">
        <Text className="section-title">平台模板</Text>
        {templates.map((template) => (
          <View key={template.id} className="card">
            <View className="row">
              <Text>{template.name}</Text>
              <Text className="tag">{template.category}</Text>
            </View>
            <Text className="muted">{template.body.slice(0, 60)}…</Text>
            <Button className="btn" loading={loading} onClick={() => generate(template.id)}>
              生成带渠道码素材
            </Button>
          </View>
        ))}
      </View>

      <View className="section">
        <Text className="section-title">已生成素材</Text>
        {materials.length === 0 ? <Text className="muted">暂无素材</Text> : null}
        {materials.map((material) => (
          <View key={material.id} className="card">
            <Text>{material.title}</Text>
            <Text className="muted">{material.content.slice(0, 80)}…</Text>
          </View>
        ))}
      </View>
    </View>
  )
}
