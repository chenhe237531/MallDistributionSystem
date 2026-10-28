import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  GOODS_THUMB_SIZES,
  goodsFallbackLabel,
  goodsImageMode,
} from './components/goods/media'

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
