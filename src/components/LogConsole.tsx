/** 底部日志抽屉：流式日志，支持折叠/展开/全屏、按图片过滤、自动滚动、复制 */
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronUp,
  ChevronDown,
  Copy,
  ChevronsUp,
  Trash2,
  Terminal,
} from 'lucide-react'
import { store, useStore } from '../store/store'
import { logTime } from '../lib/image-utils'
import type { LogLine, LogLevel } from '../lib/types'
import { Select } from './ui'

const LEVEL_STYLE: Record<LogLevel, { dot: string; text: string }> = {
  info: { dot: 'bg-ink-3', text: 'text-ink-2' },
  success: { dot: 'bg-success', text: 'text-success' },
  warn: { dot: 'bg-warn', text: 'text-warn' },
  error: { dot: 'bg-danger', text: 'text-danger' },
}

export function LogConsole() {
  const { logs, logFilterImageId, images, logDrawer, activeTaskId, tasks } = useStore()
  const [autoScroll, setAutoScroll] = useState(true)
  const bodyRef = useRef<HTMLDivElement>(null)

  const candidates = useMemo(() => {
    // 过滤候选：全部日志 / 当前任务内的图片 / 指定图片
    if (logFilterImageId) return [{ value: logFilterImageId, label: `图片 ${shortId(logFilterImageId)}` }]
    if (activeTaskId && tasks[activeTaskId]) {
      return tasks[activeTaskId].imageIds.map((id) => ({ value: id, label: `#${tasks[activeTaskId].imageIds.indexOf(id) + 1}` }))
    }
    return []
  }, [logFilterImageId, activeTaskId, tasks, images])

  const shown = useMemo(() => {
    if (!logFilterImageId) return logs
    return logs.filter((l) => l.imageId === logFilterImageId)
  }, [logs, logFilterImageId])

  // 自动滚动
  useEffect(() => {
    if (autoScroll && bodyRef.current && logDrawer !== 'collapsed') {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight
    }
  }, [shown.length, autoScroll, logDrawer])

  if (logDrawer === 'collapsed') {
    return (
      <div className="shrink-0 border-t border-line bg-panel">
        <button
          onClick={() => store.setLogDrawer('open')}
          className="flex h-9 w-full items-center gap-2 px-4 text-xs text-ink-2 hover:bg-hover cursor-pointer"
        >
          <Terminal className="h-3.5 w-3.5" />
          <span className="font-medium">运行日志</span>
          <span className="rounded-md bg-subtle px-1.5 py-0.5 text-[10px] tabular-nums">{logs.length}</span>
          {logFilterImageId && <span className="text-accent">· 已过滤 {shortId(logFilterImageId)}</span>}
          <ChevronUp className="ml-auto h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  return (
    <div
      className={`flex shrink-0 flex-col border-t border-line bg-panel transition-[height] duration-200 ${
        logDrawer === 'full' ? 'h-[70vh]' : 'h-64'
      }`}
    >
      {/* 工具行 */}
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-line px-3 text-xs">
        <Terminal className="h-3.5 w-3.5 text-ink-3" />
        <span className="font-medium text-ink-2">运行日志</span>
        <span className="rounded-md bg-subtle px-1.5 py-0.5 text-[10px] tabular-nums text-ink-2">{shown.length}</span>

        <div className="ml-2 w-32">
          <Select
            size="sm"
            value={logFilterImageId ?? ''}
            options={[{ value: '', label: '全部日志' }, ...candidates]}
            onChange={(v) => store.setLogFilterImageId(v || null)}
          />
        </div>

        <label className="ml-2 flex cursor-pointer items-center gap-1 text-[11px] text-ink-2">
          <input type="checkbox" checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)} className="accent-[var(--accent)]" />
          自动滚动
        </label>

        <div className="ml-auto flex items-center gap-1">
          <ToolBtn title="复制日志" onClick={() => navigator.clipboard.writeText(shown.map(formatLine).join('\n')).catch(() => {})}>
            <Copy className="h-3.5 w-3.5" />
          </ToolBtn>
          <ToolBtn title="清空" onClick={() => store.clearLogs()}>
            <Trash2 className="h-3.5 w-3.5" />
          </ToolBtn>
          <ToolBtn
            title={logDrawer === 'full' ? '退出全屏' : '全屏'}
            onClick={() => store.setLogDrawer(logDrawer === 'full' ? 'open' : 'full')}
          >
            <ChevronsUp className="h-3.5 w-3.5" />
          </ToolBtn>
          <ToolBtn title="收起" onClick={() => store.setLogDrawer('collapsed')}>
            <ChevronDown className="h-3.5 w-3.5" />
          </ToolBtn>
        </div>
      </div>

      {/* 日志主体 */}
      <div ref={bodyRef} className="log-font min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {shown.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-ink-3">
            暂无日志，提交生成后这里会实时滚动输出
          </div>
        ) : (
          shown.map((line, i) => <LogRow key={i} line={line} onFilter={store.setLogFilterImageId} />)
        )}
      </div>
    </div>
  )
}

function LogRow({ line, onFilter }: { line: LogLine; onFilter: (id: string | null) => void }) {
  const style = LEVEL_STYLE[line.level]
  return (
    <div className="flex items-start gap-2 py-px">
      <span className="shrink-0 tabular-nums text-ink-3">{logTime(line.t)}</span>
      <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${style.dot}`} />
      {line.imageId && (
        <button
          onClick={() => onFilter(line.imageId!)}
          className="shrink-0 rounded bg-subtle px-1 text-[10px] leading-4 text-accent hover:bg-accent-soft cursor-pointer"
          title="只看这张图的日志"
        >
          {shortId(line.imageId)}
        </button>
      )}
      <span className={`${style.text} break-all`}>{line.text}</span>
    </div>
  )
}

function ToolBtn({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="flex h-6.5 w-6.5 items-center justify-center rounded-md text-ink-3 hover:bg-hover hover:text-ink cursor-pointer"
    >
      {children}
    </button>
  )
}

function shortId(id: string) {
  return id.slice(-6)
}

function formatLine(l: LogLine) {
  return `[${logTime(l.t)}] ${l.level.toUpperCase().padEnd(7)} ${l.imageId ? `(${shortId(l.imageId)}) ` : ''}${l.text}`
}
