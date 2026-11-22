/** 通用 UI 原语 */
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

type BtnVariant = 'primary' | 'default' | 'ghost' | 'danger' | 'subtle'

const btnBase =
  'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors select-none whitespace-nowrap disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer'

const btnVariants: Record<BtnVariant, string> = {
  primary: 'bg-accent text-white hover:bg-accent-strong shadow-sm',
  default: 'bg-panel border border-line text-ink hover:bg-hover',
  ghost: 'text-ink-2 hover:bg-hover hover:text-ink',
  danger: 'bg-danger-soft text-danger border border-danger/25 hover:bg-danger hover:text-white',
  subtle: 'bg-accent-soft text-accent hover:bg-accent hover:text-white',
}

const btnSizes = {
  xs: 'h-6 px-2 text-xs',
  sm: 'h-7.5 px-2.5 text-xs',
  md: 'h-9 px-3.5 text-[13px]',
  lg: 'h-11 px-5 text-sm',
}

export function Button({
  variant = 'default',
  size = 'md',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: keyof typeof btnSizes }) {
  return <button className={`${btnBase} ${btnVariants[variant]} ${btnSizes[size]} ${className}`} {...props} />
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-baseline justify-between gap-2">
        <span className="shrink-0 text-xs font-medium text-ink-2">{label}</span>
        {hint && <span className="min-w-0 truncate text-right text-[11px] font-normal text-ink-3">{hint}</span>}
      </span>
      {children}
    </label>
  )
}

/* ---------------- 自定义下拉（替代原生 select，弹出层可定制样式） ---------------- */

export interface SelectOption {
  value: string
  label: string
}

export function Select({
  value,
  options,
  onChange,
  size = 'md',
  className = '',
}: {
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
  size?: 'md' | 'sm'
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const activeRef = useRef(0)
  activeRef.current = active
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number; minWidth: number } | null>(null)

  const selectedIndex = Math.max(0, options.findIndex((o) => o.value === value))
  const selected = options[selectedIndex]

  const openList = () => {
    const r = triggerRef.current!.getBoundingClientRect()
    const itemH = size === 'md' ? 31 : 27
    const estH = Math.min(260, options.length * itemH + 8)
    const below = window.innerHeight - r.bottom
    const top = below < estH + 12 ? Math.max(8, r.top - estH - 6) : r.bottom + 6
    const width = Math.max(r.width, 140)
    setPos({
      left: Math.min(r.left, window.innerWidth - width - 8),
      top,
      minWidth: width,
    })
    setActive(selectedIndex)
    setOpen(true)
  }

  const commit = (idx: number) => {
    const opt = options[idx]
    if (opt) onChange(opt.value)
    setOpen(false)
    triggerRef.current?.focus()
  }

  // 打开期间：外部按下关闭、Esc/方向键/Enter 键盘导航、滚动与窗口变化时关闭
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (!triggerRef.current?.contains(t) && !listRef.current?.contains(t)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setOpen(false)
        triggerRef.current?.focus()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActive((a) => Math.min(options.length - 1, a + 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActive((a) => Math.max(0, a - 1))
      } else if (e.key === 'Home') {
        e.preventDefault()
        setActive(0)
      } else if (e.key === 'End') {
        e.preventDefault()
        setActive(options.length - 1)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        commit(activeRef.current)
      } else if (e.key === 'Tab') {
        setOpen(false)
      }
    }
    const onScrollOrResize = (e: Event) => {
      if (listRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, options.length])

  // 键盘导航时保持高亮项可见
  useEffect(() => {
    if (!open) return
    const el = listRef.current?.children[active] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  const triggerCls = `flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg border bg-panel transition-colors ${
    size === 'md' ? 'h-9 px-2.5 text-[13px]' : 'h-6 rounded-md px-2 text-xs'
  } ${open ? 'border-accent shadow-[0_0_0_2px_var(--accent-soft)]' : 'border-line hover:border-ink-3'} ${className}`

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={(e) => {
          if (open) return
          if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            openList()
          }
        }}
        className={triggerCls}
      >
        <span className="min-w-0 flex-1 truncate text-left">{selected?.label ?? '请选择'}</span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-ink-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={listRef}
            role="listbox"
            style={{ position: 'fixed', left: pos.left, top: pos.top, minWidth: pos.minWidth, zIndex: 60 }}
            className="max-h-64 overflow-y-auto rounded-lg border border-line bg-panel py-1 shadow-[var(--shadow)]"
          >
            {options.map((o, i) => (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={o.value === value}
                onMouseEnter={() => setActive(i)}
                onClick={() => commit(i)}
                className={`flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-1.5 text-left text-[13px] ${
                  o.value === value
                    ? 'bg-accent-soft font-medium text-accent'
                    : i === active
                      ? 'bg-hover text-ink'
                      : 'text-ink-2'
                }`}
              >
                <span className="min-w-0 flex-1 truncate">{o.label}</span>
                {o.value === value && <Check className="h-3.5 w-3.5 shrink-0" />}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  )
}

/** 批量选择的勾选框（round 用于叠在图片上） */
export function SelectBox({
  checked,
  onClick,
  round = false,
  title,
}: {
  checked: boolean
  onClick: () => void
  round?: boolean
  title?: string
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className={`flex h-5 w-5 shrink-0 items-center justify-center border transition-colors cursor-pointer ${
        round ? 'rounded-full' : 'rounded-md'
      } ${
        checked ? 'border-accent bg-accent text-white' : 'border-ink-3/50 bg-panel text-transparent hover:border-accent'
      }`}
    >
      <Check className="h-3.5 w-3.5" />
    </button>
  )
}

type Tone = 'accent' | 'success' | 'warn' | 'danger' | 'muted'

const toneCls: Record<Tone, string> = {
  accent: 'bg-accent-soft text-accent',
  success: 'bg-success-soft text-success',
  warn: 'bg-warn-soft text-warn',
  danger: 'bg-danger-soft text-danger',
  muted: 'bg-subtle text-ink-2',
}

export function Badge({ tone = 'muted', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap ${toneCls[tone]}`}>
      {children}
    </span>
  )
}

export function ProgressBar({ value, tone = 'accent' }: { value: number; tone?: 'accent' | 'success' | 'danger' }) {
  const bg = tone === 'success' ? 'bg-success' : tone === 'danger' ? 'bg-danger' : 'bg-accent'
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-subtle">
      <div
        className={`h-full rounded-full ${bg} transition-[width] duration-300 ease-out`}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  )
}

export function Modal({
  open,
  onClose,
  title,
  children,
  width = 'max-w-lg',
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  children: ReactNode
  width?: string
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={onClose}>
      <div
        className={`w-full ${width} rounded-2xl border border-line bg-panel shadow-[var(--shadow)]`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
        </div>
        <div className="max-h-[calc(100vh-140px)] overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  )
}
