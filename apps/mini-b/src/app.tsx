import type { PropsWithChildren } from 'react'
import '@nutui/nutui-react-taro/dist/style.css'
import './app.scss'
import { initTheme } from './lib/theme'

/** H5 在首帧渲染前写入主题 class，避免黑金主题闪白 */
initTheme()

function App({ children }: PropsWithChildren) {
  return children
}

export default App
