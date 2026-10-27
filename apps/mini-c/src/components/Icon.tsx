import { View } from '@tarojs/components'

/**
 * 线性图标（改版 §6.1：弃用 emoji，零依赖 SVG mask 方案）。
 * 仅 alpha 通道参与 mask，着色由父级 color / currentColor 控制。
 */

/** 24×24 线性图标 path 集（stroke 风格，fill none） */
const ICON_PATHS = {
  home: '<path d="M4 11 12 4l8 7v9a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z"/>',
  shop: '<path d="M6 8h12l1 12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  cart: '<circle cx="9" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/><path d="M3 4h2l2.4 11h11.2l2.4-8H6.2"/>',
  bell: '<path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10 19a2 2 0 0 0 4 0"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 20c0-3.3 3.6-5 8-5s8 1.7 8 5"/>',
  wallet: '<path d="M3 7a2 2 0 0 1 2-2h12a1 1 0 0 1 1 1v2"/><path d="M3 7v10a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1H5a2 2 0 0 1-2-2z"/><path d="M16 13h3"/>',
  users: '<circle cx="9" cy="7.5" r="3.5"/><path d="M2.5 19c0-3 2.9-4.5 6.5-4.5s6.5 1.5 6.5 4.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7"/><path d="M17.5 14.7c2.4.5 4 1.9 4 4.3"/>',
  report: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/><path d="M10 12h5M10 16h5"/>',
  chart: '<path d="M5 20v-6M10 20V8M15 20v-9M20 20V5"/><path d="M3 20h18"/>',
  palette:
    '<path d="M12 3a9 9 0 1 0 0 18h1.5a2 2 0 0 0 0-4H12a2 2 0 0 1 0-4h6a3 3 0 0 0 3-3c0-4-4-7-9-7z"/><circle cx="7.5" cy="10.5" r="1"/><circle cx="12" cy="7.5" r="1"/><circle cx="16.5" cy="10.5" r="1"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h14v18H6a2 2 0 0 1-2-2z"/><path d="M20 17H6.5a2.5 2.5 0 0 0 0 5H20"/>',
  upload: '<path d="M12 15V4"/><path d="M8 8l4-4 4 4"/><path d="M5 15v4a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-4"/>',
  edit: '<path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17z"/><path d="M14 7l3 3"/>',
  card: '<rect x="3" y="6" width="18" height="12" rx="1"/><path d="M3 10h18M7 15h4"/>',
  box: '<path d="M12 3l8 4v10l-8 4-8-4V7z"/><path d="M4 7l8 4 8-4M12 11v10"/>',
  packageCheck:
    '<path d="M12 3l8 4v10l-8 4-8-4V7z"/><path d="M4 7l8 4 8-4"/><path d="M9.5 12.5l2 2 3.5-3.5"/>',
  checkCircle: '<circle cx="12" cy="12" r="9"/><path d="M8.5 12.5l2.5 2.5 5-5"/>',
  headset:
    '<path d="M4 13a8 8 0 0 1 16 0"/><path d="M4 13h3v6H6a2 2 0 0 1-2-2z"/><path d="M20 13h-3v6h1a2 2 0 0 0 2-2z"/>',
  userPlus:
    '<circle cx="10" cy="7" r="4"/><path d="M3 20c0-3 3.1-5 7-5 1 0 2 .1 2.9.4"/><path d="M19 15v6M16 18h6"/>',
  star: '<path d="M12 3l2.7 5.7 6.3.8-4.6 4.3 1.2 6.2-5.6-3.1-5.6 3.1 1.2-6.2L3 9.5l6.3-.8z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M16.5 16.5 21 21"/>',
  horn: '<path d="M4 10v4h3l7 4V6l-7 4z"/><path d="M18 9a4.5 4.5 0 0 1 0 6"/>',
  message: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 8h.01"/><path d="M12 11v6"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  scan: '<path d="M4 8V5a1 1 0 0 1 1-1h3"/><path d="M16 4h3a1 1 0 0 1 1 1v3"/><path d="M20 16v3a1 1 0 0 1-1 1h-3"/><path d="M8 20H5a1 1 0 0 1-1-1v-3"/><path d="M3 12h18"/>',
} as const

export type IconName = keyof typeof ICON_PATHS

type IconProps = {
  name: IconName
  size?: number
  className?: string
}

export function Icon({ name, size = 22, className = '' }: IconProps) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICON_PATHS[name]}</svg>`
  const maskImage = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
  return (
    <View
      className={`b-icon ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        WebkitMaskImage: maskImage,
        maskImage,
      }}
    />
  )
}
