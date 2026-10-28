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
