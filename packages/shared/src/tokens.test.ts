import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { themePacks } from './tokens'

const REQUIRED_THEME_ROLES = [
  '--mall-surface-raised',
  '--mall-surface-sunken',
  '--mall-border-strong',
  '--mall-focus-ring',
  '--mall-disabled-bg',
  '--mall-disabled-text',
  '--mall-media-bg',
  '--mall-overlay',
  '--mall-shell-max',
] as const

function hexToRgb(value: string): [number, number, number] {
  const normalized = value.replace('#', '')
  assert.match(normalized, /^[\da-f]{6}$/i)
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ]
}

function luminance(value: string): number {
  const [red, green, blue] = hexToRgb(value).map((channel) => {
    const ratio = channel / 255
    return ratio <= 0.04045 ? ratio / 12.92 : ((ratio + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

function contrast(foreground: string, background: string): number {
  const lighter = Math.max(luminance(foreground), luminance(background))
  const darker = Math.min(luminance(foreground), luminance(background))
  return (lighter + 0.05) / (darker + 0.05)
}

describe('merchant theme packs', () => {
  it('provides the same complete semantic role contract in both themes', () => {
    const goldKeys = Object.keys(themePacks.gold.vars).sort()
    const classicKeys = Object.keys(themePacks.classic.vars).sort()

    assert.deepEqual(goldKeys, classicKeys)
    for (const role of REQUIRED_THEME_ROLES) {
      assert.ok(themePacks.gold.vars[role], `gold is missing ${role}`)
      assert.ok(themePacks.classic.vars[role], `classic is missing ${role}`)
    }
  })

  it('keeps primary buttons and body copy readable in both themes', () => {
    for (const pack of Object.values(themePacks)) {
      assert.ok(
        contrast(pack.vars['--mall-on-primary'], pack.vars['--mall-primary']) >= 4.5,
        `${pack.key} primary button contrast is below WCAG AA`,
      )
      assert.ok(
        contrast(pack.vars['--mall-text'], pack.vars['--mall-card']) >= 4.5,
        `${pack.key} primary text contrast is below WCAG AA`,
      )
      assert.ok(
        contrast(pack.vars['--mall-text-secondary'], pack.vars['--mall-card']) >= 4.5,
        `${pack.key} secondary text contrast is below WCAG AA`,
      )
    }
  })

  it('keeps theme preview swatches synchronized with runtime colors', () => {
    for (const pack of Object.values(themePacks)) {
      assert.deepEqual(pack.swatch.map((value) => value.toLowerCase()), [
        pack.vars['--mall-bg'],
        pack.vars['--mall-primary'],
        pack.vars['--mall-text'],
      ].map((value) => value.toLowerCase()))
    }
  })

  it('avoids pure black and pure white surfaces in the gold theme', () => {
    const surfaceRoles = [
      '--mall-bg',
      '--mall-card',
      '--mall-surface-2',
      '--mall-surface-raised',
      '--mall-surface-sunken',
    ]

    for (const role of surfaceRoles) {
      const value = themePacks.gold.vars[role]
      assert.ok(value, `gold is missing ${role}`)
      assert.notEqual(value, '#000000')
      assert.notEqual(value, '#ffffff')
    }
  })
})
