import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import {
  GOODS_THUMB_SIZES,
  goodsFallbackLabel,
  goodsImageMode,
} from './components/goods/media'
import { isButtonInert, tabAccessibilityLabel } from './components/interaction'

const appStyles = readFileSync(new URL('./app.scss', import.meta.url), 'utf8')
const loginScreen = readFileSync(new URL('./pages/login/index.tsx', import.meta.url), 'utf8')
const homeScreen = readFileSync(new URL('./pages/index/index.tsx', import.meta.url), 'utf8')
const profileScreen = readFileSync(new URL('./pages/profile/index.tsx', import.meta.url), 'utf8')
const procurementScreen = readFileSync(new URL('./pages/procurement/index.tsx', import.meta.url), 'utf8')
const productDetailScreen = readFileSync(new URL('./pages/product-detail/index.tsx', import.meta.url), 'utf8')
const cartScreen = readFileSync(new URL('./pages/cart/index.tsx', import.meta.url), 'utf8')
const goodsCard = readFileSync(new URL('./components/goods/GoodsCard.tsx', import.meta.url), 'utf8')

describe('product media presentation contract', () => {
  it('supports list thumbnails and a non-cropping detail hero', () => {
    assert.deepEqual(GOODS_THUMB_SIZES, ['sm', 'md', 'lg', 'hero'])
    assert.equal(goodsImageMode('hero'), 'aspectFit')

    for (const size of ['sm', 'md', 'lg'] as const) {
      assert.equal(goodsImageMode(size), 'aspectFill')
    }
  })

  it('creates a stable fallback label for missing or failed images', () => {
    assert.equal(goodsFallbackLabel('  益生菌检测'), '益')
    assert.equal(goodsFallbackLabel('🧬基因检测'), '🧬')
    assert.equal(goodsFallbackLabel('   '), '品')
  })
})

describe('shared interaction states', () => {
  it('prevents actions while a button is disabled or loading', () => {
    assert.equal(isButtonInert(false, false), false)
    assert.equal(isButtonInert(true, false), true)
    assert.equal(isButtonInert(false, true), true)
  })

  it('announces the selected tab and capped cart count', () => {
    assert.equal(tabAccessibilityLabel('首页', true), '首页，当前页')
    assert.equal(tabAccessibilityLabel('购物车', false, 5), '购物车，5 件商品')
    assert.equal(tabAccessibilityLabel('购物车', false, 105), '购物车，99 件以上')
  })
})

describe('merchant prototype surface contract', () => {
  it('keeps the visual materials inside the black-gold theme scope', () => {
    assert.match(appStyles, /\.theme-gold\s+\.prototype-surface/)
    assert.match(appStyles, /\.theme-gold\s+\.prototype-decor/)
    assert.match(appStyles, /\.theme-gold\s+\.prototype-gold-action/)
  })

  it('keeps wide H5 shells and bottom sheets safe-area aware', () => {
    assert.match(appStyles, /\.prototype-shell[\s\S]*max-width:\s*var\(--mall-shell-max\)/)
    assert.match(appStyles, /\.prototype-sheet[\s\S]*env\(safe-area-inset-bottom\)/)
  })
})

describe('merchant prototype screen contract', () => {
  it('gives the sign-in screen an explicit branded black-gold header', () => {
    assert.match(loginScreen, /百英诺 · 商家中心/)
    assert.match(loginScreen, /login-brand-block prototype-decor/)
    assert.match(loginScreen, /login-card prototype-surface/)
  })

  it('keeps operating metrics before the five direct merchant shortcuts', () => {
    assert.ok(homeScreen.indexOf('home-operations') < homeScreen.indexOf('home-apps-section'))
    assert.match(homeScreen, /hero b-hero prototype-surface prototype-decor/)
    assert.match(homeScreen, /PRIMARY_HOME_ENTRIES\.map/)
  })

  it('presents profile identity and prepaid account as prototype surfaces', () => {
    assert.match(profileScreen, /profile-user-card prototype-surface prototype-decor/)
    assert.match(profileScreen, /card profile-stats prototype-surface/)
    assert.match(profileScreen, /可用预付款/)
  })
})

describe('merchant commerce prototype contract', () => {
  it('uses a visual card and direct cart action for each catalogue product', () => {
    assert.match(goodsCard, /className="goods-card prototype-surface"/)
    assert.match(goodsCard, /className="goods-card-media"/)
    assert.match(goodsCard, /className="goods-card-action"/)
  })

  it('renders the catalogue category rail and two-column product grid from existing filters', () => {
    assert.match(procurementScreen, /className="proc-side proc-category-rail"/)
    assert.match(procurementScreen, /scrollX/)
    assert.match(procurementScreen, /className="proc-catalog-grid"/)
    assert.match(procurementScreen, /filteredProducts\.map/)
  })

  it('keeps detail media inside the prototype stage and exposes a specification trigger', () => {
    assert.match(productDetailScreen, /goods-media-stage detail-media-stage prototype-surface prototype-decor/)
    assert.match(productDetailScreen, /className="detail-spec-trigger"/)
  })
})

describe('merchant prototype feedback contract', () => {
  it('opens a deterministic specification bottom sheet from the detail trigger', () => {
    assert.match(productDetailScreen, /const \[specSheetOpen, setSpecSheetOpen\]/)
    assert.match(productDetailScreen, /onClick=\{\(\) => setSpecSheetOpen\(true\)\}/)
    assert.match(productDetailScreen, /prototype-spec-sheet prototype-sheet/)
    assert.match(productDetailScreen, /selectedSpec/)
  })

  it('shows a submission confirmation before taking the merchant to the order list', () => {
    assert.match(cartScreen, /const \[orderSubmitted, setOrderSubmitted\]/)
    assert.match(cartScreen, /setOrderSubmitted\(true\)/)
    assert.match(cartScreen, /prototype-success-dialog/)
    assert.match(cartScreen, /查看采购单/)
  })
})
