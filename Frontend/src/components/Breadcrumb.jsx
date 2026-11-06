import { ChevronRight, Home } from 'lucide-react'

import { buildBreadcrumbs } from '../utils/format'

export default function Breadcrumb({ path, onNavigate }) {
  const crumbs = buildBreadcrumbs(path)

  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center overflow-x-auto whitespace-nowrap text-sm">
      {crumbs.map((crumb, index) => {
        const isLast = index === crumbs.length - 1
        return (
          <div key={crumb.path || 'home'} className="flex items-center">
            {index > 0 && <ChevronRight className="mx-1 h-4 w-4 shrink-0 text-slate-400" />}
            {isLast ? (
              <span className="flex items-center gap-1.5 rounded-md px-1.5 py-1 font-semibold text-slate-900">
                {index === 0 && <Home className="h-4 w-4" />}
                {crumb.name}
              </span>
            ) : (
              <button
                onClick={() => onNavigate(crumb.path)}
                className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-slate-500 hover:bg-slate-200/60 hover:text-slate-900"
              >
                {index === 0 && <Home className="h-4 w-4" />}
                {crumb.name}
              </button>
            )}
          </div>
        )
      })}
    </nav>
  )
}
