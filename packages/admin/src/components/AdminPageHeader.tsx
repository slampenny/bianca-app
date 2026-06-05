import type { ReactNode } from "react"

type AdminPageHeaderProps = {
  title: string
  subtitle?: ReactNode
  actions?: ReactNode
}

export function AdminPageHeader({ title, subtitle, actions }: AdminPageHeaderProps) {
  return (
    <div className="admin-page-header">
      <div className="admin-page-header-text">
        <h1 className="admin-header-title">{title}</h1>
        {subtitle ? <p className="admin-header-sub">{subtitle}</p> : null}
      </div>
      {actions ? <div className="admin-page-header-actions">{actions}</div> : null}
    </div>
  )
}
