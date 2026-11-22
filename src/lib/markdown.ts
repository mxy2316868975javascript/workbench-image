/**
 * Markdown 渲染：marked 解析 + DOMPurify 消毒（与 Toonflow 剧本节点同款管线）。
 * 仅用于剧本文档预览等内部受信内容的展示，输出前统一过 DOMPurify。
 */
import { marked } from 'marked'
import DOMPurify from 'dompurify'

marked.setOptions({ breaks: true, gfm: true })

export function renderMarkdown(md: string): string {
  const html = marked.parse(md ?? '', { async: false })
  return DOMPurify.sanitize(html)
}
