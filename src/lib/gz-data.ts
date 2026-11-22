/**
 * 归藏社交卡片（op7418/guizang-social-card-skill）的色板与版式数据。
 * 来自 references/theme-presets.md（10 套主题色板）与 references/layout-recipes.md（28 种版式）。
 */

export interface GzPalette {
  value: string
  label: string
  paper: string
  ink: string
  accent: string
}

export interface GzLayout {
  code: string
  name: string
  desc: string
}

/** Editorial Magazine × E-ink 色板（6 套，Midnight Ink 为唯一深色变体） */
export const GZ_EDITORIAL_PALETTES: GzPalette[] = [
  { value: 'ink-classic', label: 'Ink Classic（默认·商业评论）', paper: '#f1efea', ink: '#0a0a0b', accent: '#111111' },
  { value: 'indigo-porcelain', label: 'Indigo Porcelain（科技 / 数据）', paper: '#f1f3f5', ink: '#0a1f3d', accent: '#315d93' },
  { value: 'forest-ink', label: 'Forest Ink（户外 / 自然）', paper: '#f5f1e8', ink: '#1a2e1f', accent: '#2e6b4f' },
  { value: 'kraft-paper', label: 'Kraft Paper（手作 / 工艺）', paper: '#eedfc7', ink: '#2a1e13', accent: '#9b5a2e' },
  { value: 'dune', label: 'Dune（沙漠 / 暖调）', paper: '#f0e6d2', ink: '#1f1a14', accent: '#8f7650' },
  { value: 'midnight-ink', label: 'Midnight Ink（唯一深色变体）', paper: '#0e0d0c', ink: '#ece2cf', accent: '#d4a04a' },
]

/** Swiss International 色板（4 套，单一高饱和强调色） */
export const GZ_SWISS_PALETTES: GzPalette[] = [
  { value: 'ikb', label: 'IKB（默认·克莱因蓝）', paper: '#fafaf8', ink: '#0a0a0a', accent: '#002FA7' },
  { value: 'lemon', label: 'Lemon（柠檬黄）', paper: '#fafaf8', ink: '#0a0a0a', accent: '#FFD500' },
  { value: 'lemon-green', label: 'Lemon Green（柠檬绿）', paper: '#fafaf8', ink: '#0a0a0a', accent: '#C5E803' },
  { value: 'safety-orange', label: 'Safety Orange（安全橙）', paper: '#fafaf8', ink: '#0a0a0a', accent: '#FF6B35' },
]

/** 28 种版式（Editorial M01-M16 / Swiss S01-S12，构图要点来自 layout-recipes.md） */
export const GZ_LAYOUTS: GzLayout[] = [
  { code: 'M01', name: 'Cover: Magazine Issue Cover', desc: 'Rednote page 1. Top issue row, large serif title 2-4 lines, one image 35-55% of page, bottom issue strip with 3-5 points.' },
  { code: 'M02', name: 'Field Note Photo', desc: 'Outdoor, object, hardware, or real-world observation with field-note captions.' },
  { code: 'M03', name: 'Editorial Essay Split', desc: 'Explaining one idea with nuance; split layout with image and compressed explanation column.' },
  { code: 'M04', name: 'Pull Quote / Thesis', desc: 'A core sentence or conclusion as a large pull quote with small source row.' },
  { code: 'M05', name: 'Checklist / Buying Guide', desc: 'Rednote practical content: numbered items, one supporting image crop.' },
  { code: 'M06', name: 'Evidence Wall', desc: 'Multiple screenshots, references, or small images arranged as evidence.' },
  { code: 'M07', name: 'Closing Note', desc: 'Final page of a carousel.' },
  { code: 'M08', name: 'Tall Ledger', desc: 'Lists, roles, pros/cons, gear items, product capabilities in a tall ledger format.' },
  { code: 'M09', name: 'Atmospheric Thesis', desc: 'Sparse but important points with atmospheric background.' },
  { code: 'M10', name: 'Evidence Feature', desc: 'Supplied screenshots or photos as the feature element.' },
  { code: 'M11', name: 'Marginalia Essay', desc: 'Nuanced explanation with marginalia column and moderate text.' },
  { code: 'M12', name: 'Section Divider', desc: 'A mid-carousel breath between dense pages.' },
  { code: 'M13', name: 'Hero Question', desc: 'A sharp question as the hook, for the last page of a carousel or a mid-carousel pivot.' },
  { code: 'M14', name: 'Vertical Pipeline', desc: 'Explaining a 3-5 step workflow, decision tree, or recipe.' },
  { code: 'M15', name: 'Before / After', desc: 'Old way vs new way, before AI vs after AI, rookie vs pro.' },
  { code: 'M16', name: 'Image-Led Cover (Full-Bleed Hero)', desc: 'Lifestyle, image-heavy content where the user has 1+ excellent photos. Photo qualification gate before choosing M16.' },
  { code: 'S01', name: 'Accent Cover', desc: 'Rednote cover in Swiss style: one accent color, strict grid, huge light-weight type.' },
  { code: 'S02', name: 'Two Signals / Comparison', desc: 'Two sources, two options, or two product directions compared side by side.' },
  { code: 'S03', name: 'Data Layer / File Card', desc: 'Markdown, memory, source-of-truth, database, or state as the content.' },
  { code: 'S04', name: 'Interface / Browser Mock', desc: 'HTML, UI, presentation, interaction, or output layer shown as a browser mock.' },
  { code: 'S05', name: 'Trap / Warning Rows', desc: 'Problems, anti-patterns, and do-not-do-this pages as warning rows.' },
  { code: 'S06', name: 'Pipeline / Architecture', desc: 'Workflows and layered systems as a pipeline diagram.' },
  { code: 'S07', name: 'Takeaway Ledger', desc: 'Final page takeaways in a ledger format.' },
  { code: 'S08', name: 'Image Hero', desc: 'The WeChat 21:9 main cover and the Rednote cover when you have a strong hero image.' },
  { code: 'S09', name: 'KPI Tower', desc: 'Product-update pages, release notes, traffic dashboards, growth posts — 3-4 numbers compared at a glance.' },
  { code: 'S10', name: 'H-Bar Chart', desc: 'Rankings, comparisons of 5-10 items, top-N lists, before/after bars.' },
  { code: 'S11', name: 'Stacked Ledger', desc: 'Shopping lists, expense rollups, agent capability inventories in a stacked ledger.' },
  { code: 'S12', name: 'Matrix + Hero Stat', desc: 'Capability matrices, agent inventories, this-set-covers-X-do-that statements.' },
]
