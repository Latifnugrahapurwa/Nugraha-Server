import { ChevronRight } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'

function MenuItem({ item, onSelect }) {
  const rowRef = useRef(null)
  const [sub, setSub] = useState(null) // { flip, alignBottom } saat submenu terbuka
  const Icon = item.icon
  const hasSub = Array.isArray(item.submenu)

  const openSub = () => {
    const rect = rowRef.current.getBoundingClientRect()
    const estimatedHeight = item.submenu.length * 38 + 16
    setSub({
      flip: rect.right + 240 > window.innerWidth,
      alignBottom: rect.top + estimatedHeight > window.innerHeight,
    })
  }

  const tone = item.danger
    ? 'text-red-600 hover:bg-red-50'
    : 'text-slate-700 hover:bg-slate-100'

  return (
    <div
      ref={rowRef}
      className="relative"
      onMouseEnter={hasSub ? openSub : undefined}
      onMouseLeave={hasSub ? () => setSub(null) : undefined}
    >
      <button
        type="button"
        disabled={item.disabled}
        onClick={() => {
          if (hasSub) {
            if (sub) setSub(null)
            else openSub()
          } else {
            onSelect(item)
          }
        }}
        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40 ${tone} ${
          hasSub && sub ? 'bg-slate-100' : ''
        }`}
      >
        {Icon && <Icon className="h-4 w-4 shrink-0" />}
        <span className="flex-1 truncate text-left">{item.label}</span>
        {hasSub && <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />}
      </button>

      {hasSub && sub && (
        <div
          className={`absolute z-10 w-56 ${sub.flip ? 'right-full pr-1' : 'left-full pl-1'} ${
            sub.alignBottom ? 'bottom-0' : 'top-0'
          }`}
        >
          <div className="rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
            {item.submenu.map((subItem) =>
              subItem.type === 'separator' ? (
                <div key={subItem.key} className="my-1.5 h-px bg-slate-100" role="separator" />
              ) : (
                <MenuItem key={subItem.key} item={subItem} onSelect={onSelect} />
              ),
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// items: [{ key, label, icon, onClick, danger, disabled, submenu: [...] } | { type: 'separator', key }]
export default function ContextMenu({ x, y, items, onClose }) {
  const menuRef = useRef(null)
  const [position, setPosition] = useState({ left: x, top: y })

  // Jaga agar menu tidak keluar dari layar
  useLayoutEffect(() => {
    const element = menuRef.current
    if (!element) return
    const rect = element.getBoundingClientRect()
    setPosition({
      left: Math.max(8, Math.min(x, window.innerWidth - rect.width - 8)),
      top: Math.max(8, Math.min(y, window.innerHeight - rect.height - 8)),
    })
  }, [x, y, items])

  useEffect(() => {
    const onMouseDown = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) onClose()
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    const close = () => onClose()

    window.addEventListener('mousedown', onMouseDown)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('blur', close)
    window.addEventListener('resize', close)
    window.addEventListener('scroll', close, true)
    return () => {
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('blur', close)
      window.removeEventListener('resize', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [onClose])

  const handleSelect = (item) => {
    onClose()
    item.onClick?.()
  }

  return (
    <div
      ref={menuRef}
      className="fixed z-[80] w-60 animate-fade-in rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl"
      style={{ left: position.left, top: position.top }}
      onContextMenu={(event) => event.preventDefault()}
      role="menu"
    >
      {items.map((item) =>
        item.type === 'separator' ? (
          <div key={item.key} className="my-1.5 h-px bg-slate-100" role="separator" />
        ) : (
          <MenuItem key={item.key} item={item} onSelect={handleSelect} />
        ),
      )}
    </div>
  )
}
