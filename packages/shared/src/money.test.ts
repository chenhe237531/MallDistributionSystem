import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { applyRate, formatCents, parseYuanToCents } from './money'

describe('money', () => {
  it('formats cents with two decimals', () => {
    assert.equal(formatCents(123456), '1234.56')
    assert.equal(formatCents(5), '0.05')
    assert.equal(formatCents(-1050), '-10.50')
  })

  it('applies rates with round-half-up to cents', () => {
    assert.equal(applyRate(1999, 0.1), 200)
    assert.equal(applyRate(1001, 0.333), 333)
  })

  it('parses yuan input safely', () => {
    assert.equal(parseYuanToCents('12.34'), 1234)
    assert.equal(parseYuanToCents('12.3'), 1230)
    assert.equal(parseYuanToCents('12.345'), null)
    assert.equal(parseYuanToCents('abc'), null)
  })
})
