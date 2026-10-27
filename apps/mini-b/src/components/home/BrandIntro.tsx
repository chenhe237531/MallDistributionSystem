import Taro from '@tarojs/taro'
import { Image, Text, View } from '@tarojs/components'
import {
  BIZ_WECHAT_ID,
  BRAND_CERTS,
  BRAND_STATS,
  BRAND_STORY,
  COMPLIANCE_NOTE,
  PRODUCT_LINES,
} from '../../config/home'
import logoPng from '../../assets/logo.png'
import certImg from '../../assets/cert-medical-device.jpeg'

/** 真实资质证书（源自企业资料，PPT 内导出） */
const CERTS = [
  { src: certImg, label: '医疗器械注册证（鄂械注准20242144835）' },
]

const previewCert = (current: string) => {
  void Taro.previewImage({ urls: CERTS.map((cert) => cert.src), current })
}

/**
 * 走进百英诺 · 首页品牌介绍区（§4.2）：
 * 品牌故事卡 + 实力数字条 + 产品线 2×2 + 资质认证条 + 合规声明（§12 红线）。
 */

type Props = {
  onOpenCategory: (category: string) => void
  onOpenGuide: () => void
}

export function BrandIntro({ onOpenCategory, onOpenGuide }: Props) {
  return (
    <View id="brand-intro" className="section">
      <Text className="section-title">走进百英诺</Text>
      <View className="card">
        <Image src={logoPng} className="brand-logo-img" mode="aspectFit" />
        <Text className="brand-story-text">{BRAND_STORY}</Text>

        <View className="brand-stats">
          {BRAND_STATS.map((stat) => (
            <View key={stat.label} className="brand-stat">
              <Text className="brand-stat-value">{stat.value}</Text>
              <Text className="brand-stat-label">{stat.label}</Text>
              {stat.note ? <Text className="brand-stat-label">{stat.note}</Text> : null}
            </View>
          ))}
        </View>

        <View className="brand-lines">
          {PRODUCT_LINES.map((line) => (
            <View
              key={line.title}
              className="brand-line-card"
              onClick={() => onOpenCategory(line.category)}
            >
              <Text className="brand-line-title">{line.title}</Text>
              <Text className="brand-line-desc">{line.desc}</Text>
            </View>
          ))}
        </View>

        <View className="brand-certs">
          {CERTS.map((cert) => (
            <View key={cert.label} className="brand-cert-card" onClick={() => previewCert(cert.src)}>
              <Image src={cert.src} className="brand-cert-img" mode="aspectFill" />
              <Text className="brand-cert-label">{cert.label}</Text>
            </View>
          ))}
        </View>
        <View className="brand-certs">
          {BRAND_CERTS.map((cert) => (
            <View key={cert} className="brand-cert-chip">
              {cert}
            </View>
          ))}
        </View>

        <Text className="brand-compliance">{COMPLIANCE_NOTE}</Text>
        <View className="brand-guide-link" onClick={onOpenGuide}>
          <Text>查看服务与履约流程</Text>
          <Text className="brand-guide-arrow">›</Text>
        </View>
      </View>
    </View>
  )
}

/** 商务联系卡（§4.3，参照参考小程序「官方客服微信」卡） */
export function ContactCard({ onCopy }: { onCopy: (wechatId: string) => void }) {
  return (
    <View className="contact-card">
      <View className="contact-icon">
        <Text style={{ fontSize: 20 }}>微</Text>
      </View>
      <View className="contact-main">
        <Text className="contact-title">专属渠道经理</Text>
        <Text className="contact-desc">免费 1 对 1 帮你选品与对接</Text>
      </View>
      <View className="contact-btn" onClick={() => onCopy(BIZ_WECHAT_ID)}>
        复制微信号
      </View>
    </View>
  )
}
