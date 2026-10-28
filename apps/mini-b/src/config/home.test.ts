import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import * as home from './home'

type Entry = { label: string; url: string }

function groupedEntries(): { primary: Entry[]; secondary: Entry[] } {
  const exports = home as unknown as Record<string, Entry[] | undefined>
  return {
    primary: exports.PRIMARY_HOME_ENTRIES ?? [],
    secondary: exports.SECONDARY_HOME_ENTRIES ?? [],
  }
}

describe('merchant home application groups', () => {
  it('puts the five highest-frequency merchant actions first', () => {
    const { primary } = groupedEntries()

    assert.deepEqual(
      primary.map((entry) => entry.label),
      ['采购商城', '预付款', '商品定价', '报告与解读', '我的客户'],
    )
  })

  it('covers every home entry exactly once across primary and secondary groups', () => {
    const { primary, secondary } = groupedEntries()
    const groupedLabels = [...primary, ...secondary].map((entry) => entry.label)
    const uniqueLabels = new Set(groupedLabels)

    assert.equal(primary.length, 5)
    assert.equal(uniqueLabels.size, groupedLabels.length)
    assert.deepEqual(
      [...uniqueLabels].sort(),
      home.HOME_ENTRIES.map((entry) => entry.label).sort(),
    )
  })

  it('keeps all primary actions directly navigable', () => {
    const { primary } = groupedEntries()
    for (const entry of primary) {
      assert.match(entry.url, /^\/pages\//)
    }
  })
})
