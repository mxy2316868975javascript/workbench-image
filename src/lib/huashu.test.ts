import { describe, expect, it } from 'vitest'
import { buildHuashuPrompt, parseHuashuStyles } from './huashu'

const md = `## 网页设计(1种)

#### 极简

**Linear** \`Web / SaaS\`
- 视觉DNA: 冷灰底、细线、低饱和强调色
- 适配: SaaS 落地页

## ⚠️ AI 生图专用风格（仅在确认用户有生图能力时才推）

| 风格 | 灵魂 | 为什么 HTML 做不了 |
|------|------|------------------|
| Active Theory（WebGL 粒子） | 3D 粒子系统/实时渲染 | 纯 CSS 无法 |
| Ash Thorp（电影光影） | 电影级体积光/概念美术 | CSS 光影是劣化 |
`

describe('huashu parser', () => {
  it('解析普通风格和 AI 生图专用风格表格', () => {
    const styles = parseHuashuStyles(md)
    expect(styles).toHaveLength(3)

    const linear = styles.find((s) => s.name === 'Linear')
    expect(linear).toMatchObject({ group: '网页设计', sub: '极简', aiNative: false })
    expect(linear?.dna).toContain('冷灰底')

    const active = styles.find((s) => s.name.startsWith('Active Theory'))
    expect(active).toMatchObject({
      group: 'AI 生图专用风格',
      tag: 'WebGL 粒子',
      aiNative: true,
    })
    expect(active?.dna).toContain('3D 粒子')
    expect(active?.fit).toContain('纯 CSS')
  })

  it('AI 生图风格会带上载体说明', () => {
    const style = parseHuashuStyles(md).find((s) => s.aiNative)
    expect(style).toBeTruthy()
    const prompt = buildHuashuPrompt(style!, { topic: '一个音乐节主视觉' })
    expect(prompt).toContain('AI 直出的视觉设计图')
    expect(prompt).toContain('AI 直出图')
  })
})
