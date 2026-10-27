import { useEffect } from 'react'
import Taro from '@tarojs/taro'
import { Image, Text, View } from '@tarojs/components'
import { routeParams } from '../../lib/api'
import { BRAND, TECH_DISCLAIMER, TECH_SECTIONS } from '../../lib/content'
import logo from '../../assets/logo.png'

export default function TechIntro() {
  const anchor = routeParams().anchor

  useEffect(() => {
    if (!anchor) {
      return
    }
    const timer = setTimeout(() => {
      void Taro.pageScrollTo({ selector: `#${anchor}`, duration: 300 })
    }, 300)
    return () => clearTimeout(timer)
  }, [anchor])

  return (
    <View className="page">
      <View className="tech-hero">
        <Image className="tech-hero-logo" src={logo} mode="aspectFit" />
        <Text className="tech-hero-title">{BRAND.title} · 肠道微生态科普</Text>
        <Text className="tech-hero-sub">{BRAND.name}</Text>
      </View>

      {TECH_SECTIONS.map((section) => (
        <View key={section.id} id={section.id} className="tech-section">
          <Text className="tech-section-title">{section.title}</Text>
          {section.paragraphs?.map((paragraph) => (
            <Text key={paragraph} className="tech-paragraph">
              {paragraph}
            </Text>
          ))}
          {section.bullets?.map((bullet) => (
            <Text key={bullet} className="tech-bullet">
              {bullet}
            </Text>
          ))}
          {section.steps?.map((step, index) => (
            <View key={step} className="tech-step">
              <Text className="tech-step-no">{index + 1}</Text>
              <Text>{step}</Text>
            </View>
          ))}
          {section.imagePlaceholder ? (
            <View className="tech-image-placeholder">
              <Text>科普配图 · 企业素材待提供</Text>
            </View>
          ) : null}
        </View>
      ))}

      <View className="notice">
        <Text>{TECH_DISCLAIMER}</Text>
      </View>
    </View>
  )
}
