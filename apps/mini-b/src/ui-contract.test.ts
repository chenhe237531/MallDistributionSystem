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
