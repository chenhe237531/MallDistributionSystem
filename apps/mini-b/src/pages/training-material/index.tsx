import { useEffect, useState } from 'react'
import Taro, { useRouter } from '@tarojs/taro'
import { Image, Text, Video, View } from '@tarojs/components'
import { Empty } from '@nutui/nutui-react-taro'
import { api, ensureLogin, resolveAsset } from '../../lib/api'
import { PageToast, toast } from '../../components/feedback'
import { useTheme } from '../../lib/theme'

type Section = { index: number; title: string; page: number | null; paragraphs: string[] }

type Material = {
  id: string
  title: string
  sourceFile: string
  format: string
  kind: string
  summary: string
  tags: string[]
  pageCount: number
  charCount: number
  durationSeconds?: number
  url?: string
  imageBased: boolean
  pages: Array<{ page: number; image: string; sizeBytes: number }>
  sections: Section[]
}

const FORMAT_LABELS: Record<string, string> = {
  pptx: 'PPT 课件',
  pdf: 'PDF 文档',
  docx: 'Word 文档',
  mp4: '视频课件',
}

export default function TrainingMaterial() {
  const { themeClass } = useTheme()
  const router = useRouter()
  const materialId = router.params.id ?? ''
  const [material, setMaterial] = useState<Material | null>(null)
  const [openSections, setOpenSections] = useState<number[]>([])
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!ensureLogin() || !materialId) {
      setFailed(true)
      return
    }
    api<Material>(`/training/materials/${materialId}`)
      .then((data) => {
        setMaterial(data)
        // 首节默认展开，长文档其余保持收起，避免一次渲染上千段
        if (data.sections.length > 0) {
          setOpenSections([data.sections[0].index])
        }
      })
      .catch((cause) => {
        setFailed(true)
        toast(cause instanceof Error ? cause.message : '课件加载失败', 'fail')
      })
  }, [materialId])

  const toggle = (index: number) => {
    setOpenSections((current) =>
      current.includes(index) ? current.filter((item) => item !== index) : [...current, index],
    )
  }

  const allOpen = material ? openSections.length === material.sections.length : false
  const toggleAll = () => {
    if (!material) {
      return
    }
    setOpenSections(allOpen ? [] : material.sections.map((section) => section.index))
  }

  if (failed) {
    return (
      <View className={`page ${themeClass}`}>
        <Empty description="课件不存在或无权查看" />
        <PageToast />
      </View>
    )
  }

  if (!material) {
    return <View className={`page ${themeClass}`} />
  }

  return (
    <View className={`page ${themeClass}`}>
      <View className="tr-reader-head">
        <Text className="tr-reader-title">{material.title}</Text>
        <View className="tr-material-meta">
          <Text className="tr-material-meta-item">
            {FORMAT_LABELS[material.format] ?? material.format}
          </Text>
          {material.pageCount > 0 ? (
            <Text className="tr-material-meta-item">{material.pageCount} 页</Text>
          ) : null}
          {material.format === 'mp4' ? (
            <Text className="tr-material-meta-item">
              {Math.round((material.durationSeconds ?? 0) / 60)} 分钟
            </Text>
          ) : (
            <Text className="tr-material-meta-item">{material.sections.length} 节</Text>
          )}
        </View>
        <Text className="tr-reader-summary">{material.summary}</Text>
        <Text className="tr-reader-source">来源文件：{material.sourceFile}</Text>
      </View>

      {material.format === 'mp4' && material.url ? (
        <View className="tr-player">
          <Video
            className="tr-player-video"
            src={resolveAsset(material.url)}
            controls
            showFullscreenBtn
            showPlayBtn
            objectFit="contain"
          />
        </View>
      ) : null}

      {material.pages.length > 0 ? (
        <View className="section">
          <Text className="section-title">课件页面</Text>
          <Text className="tr-hint">该文档为图片版式，已按页渲染，可左右滑动查看</Text>
          {material.pages.map((page) => (
            <Image
              key={page.page}
              className="tr-page-image"
              src={resolveAsset(page.image)}
              mode="widthFix"
              lazyLoad
              onClick={() =>
                void Taro.previewImage({
                  current: resolveAsset(page.image),
                  urls: material.pages.map((item) => resolveAsset(item.image)),
                })
              }
            />
          ))}
        </View>
      ) : null}

      {material.sections.length > 0 ? (
        <View className="section">
          <View className="tr-outline-head">
            <Text className="section-title">内容大纲</Text>
            <Text className="tr-outline-toggle" onClick={toggleAll}>
              {allOpen ? '全部收起' : '全部展开'}
            </Text>
          </View>
          {material.sections.map((section) => {
            const open = openSections.includes(section.index)
            return (
              <View key={section.index} className="tr-section">
                <View className="tr-section-head" onClick={() => toggle(section.index)}>
                  <Text className="tr-section-index">{String(section.index).padStart(2, '0')}</Text>
                  <Text className="tr-section-title">{section.title}</Text>
                  <Text className="tr-section-page">
                    {section.page ? `P${section.page}` : `${section.paragraphs.length} 段`}
                  </Text>
                </View>
                {open ? (
                  <View className="tr-section-body">
                    {section.paragraphs.map((paragraph, index) => (
                      <Text key={`${section.index}-${index}`} className="tr-paragraph">
                        {paragraph}
                      </Text>
                    ))}
                  </View>
                ) : null}
              </View>
            )
          })}
        </View>
      ) : null}

      {material.sections.length === 0 && material.pages.length === 0 && material.format !== 'mp4' ? (
        <Empty description="该课件暂无可展示内容" />
      ) : null}

      <PageToast />
    </View>
  )
}
