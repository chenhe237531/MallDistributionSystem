import { defineConfig } from '@tarojs/cli'

export default defineConfig({
  projectName: 'mall-mini-b',
  designWidth: 375,
  deviceRatio: {
    640: 2.34 / 2,
    750: 1,
    375: 1,
    828: 1.81 / 2,
  },
  sourceRoot: 'src',
  // 支持构建到独立目录（本地校验/CI 避免覆盖 dist）
  outputRoot: process.env.TARO_OUTPUT_ROOT || 'dist',
  plugins: [
    '@tarojs/plugin-framework-react',
    '@tarojs/plugin-platform-weapp',
    '@tarojs/plugin-platform-h5',
    '@tarojs/plugin-html',
  ],
  defineConstants: {},
  framework: 'react',
  compiler: {
    type: 'webpack5',
    prebundle: { enable: false },
  },
  cache: { enable: false },
  mini: {
    postcss: {
      pxtransform: { enable: true, config: {} },
      url: { enable: true, config: { limit: 1024 } },
      cssModules: { enable: false },
    },
  },
  h5: {
    publicPath: process.env.TARO_PUBLIC_PATH || '/',
    router: { mode: 'hash' },
    staticDirectory: 'static',
    devServer: {
      port: 10086,
      // H5 端 API 走相对路径 /api，开发态需代理到后端服务（否则登录等请求 404）
      proxy: {
        '/api': { target: 'http://localhost:3000', changeOrigin: true },
        '/uploads': { target: 'http://localhost:3000', changeOrigin: true },
      },
    },
    postcss: {
      autoprefixer: { enable: true, config: {} },
      cssModules: { enable: false },
    },
  },
})
