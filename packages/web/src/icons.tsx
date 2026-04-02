import type { CSSProperties, ReactNode } from "react"

const svgBase = {
  xmlns: "http://www.w3.org/2000/svg",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
}

function S({
  size = 20,
  className = "",
  style,
  children,
}: {
  size?: number
  className?: string
  style?: CSSProperties
  children: ReactNode
}) {
  return (
    <svg
      {...svgBase}
      width={size}
      height={size}
      className={className}
      style={style}
      viewBox="0 0 24 24"
    >
      {children}
    </svg>
  )
}

export function PanelIcon(p: { size?: number; className?: string; rotated?: boolean }) {
  return (
    <S
      size={p.size}
      className={p.className}
      style={p.rotated ? { transform: "rotate(180deg)" } : undefined}
    >
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
      <path d="M9 3v18" />
    </S>
  )
}

export function DashboardIcon(p: { size?: number; className?: string }) {
  return (
    <S {...p}>
      <rect width="7" height="9" x="3" y="3" rx="1" />
      <rect width="7" height="5" x="14" y="3" rx="1" />
      <rect width="7" height="9" x="14" y="12" rx="1" />
      <rect width="7" height="5" x="3" y="16" rx="1" />
    </S>
  )
}

export function BellIcon(p: { size?: number; className?: string }) {
  return (
    <S {...p}>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </S>
  )
}

export function UsersIcon(p: { size?: number; className?: string }) {
  return (
    <S {...p}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </S>
  )
}

export function FileTextIcon(p: { size?: number; className?: string }) {
  return (
    <S {...p}>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M10 9H8" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
    </S>
  )
}

export function SettingsIcon(p: { size?: number; className?: string }) {
  return (
    <S {...p}>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </S>
  )
}

export function ZapIcon(p: { size?: number; className?: string }) {
  return (
    <S {...p}>
      <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />
    </S>
  )
}

export function ChevronRightIcon(p: { size?: number; className?: string }) {
  return (
    <S {...p}>
      <path d="m9 18 6-6-6-6" />
    </S>
  )
}

export function ChevronLeftIcon(p: { size?: number; className?: string }) {
  return (
    <S {...p}>
      <path d="m15 18-6-6 6-6" />
    </S>
  )
}

export function ChevronDownIcon(p: { size?: number; className?: string }) {
  return (
    <S {...p}>
      <path d="m6 9 6 6 6-6" />
    </S>
  )
}

export function SearchIcon(p: { size?: number; className?: string }) {
  return (
    <S {...p}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </S>
  )
}

export function AlertOctagonIcon(p: { size?: number; className?: string }) {
  return (
    <S {...p}>
      <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2" />
      <line x1="12" x2="12" y1="8" y2="12" />
      <line x1="12" x2="12.01" y1="16" y2="16" />
    </S>
  )
}

export function CheckIcon(p: { size?: number; className?: string }) {
  return (
    <S {...p}>
      <path d="M20 6 9 17l-5-5" />
    </S>
  )
}

export function PhoneIcon(p: { size?: number; className?: string }) {
  return (
    <S {...p}>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </S>
  )
}

export function MessageIcon(p: { size?: number; className?: string }) {
  return (
    <S {...p}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </S>
  )
}

export function ClockIcon(p: { size?: number; className?: string }) {
  return (
    <S {...p}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </S>
  )
}

export function InboxIcon(p: { size?: number; className?: string }) {
  return (
    <S {...p}>
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </S>
  )
}

export function DownloadIcon(p: { size?: number; className?: string }) {
  return (
    <S {...p}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" x2="12" y1="15" y2="3" />
    </S>
  )
}

export function ChartBarIcon(p: { size?: number; className?: string }) {
  return (
    <S {...p}>
      <path d="M3 3v18h18" />
      <path d="M18 17V9" />
      <path d="M13 17V5" />
      <path d="M8 17v-3" />
    </S>
  )
}

export function PrintIcon(p: { size?: number; className?: string }) {
  return (
    <S {...p}>
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect width="12" height="8" x="6" y="14" rx="1" />
    </S>
  )
}

export function PencilIcon(p: { size?: number; className?: string }) {
  return (
    <S {...p}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </S>
  )
}

export function TrashIcon(p: { size?: number; className?: string }) {
  return (
    <S {...p}>
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M19 6v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </S>
  )
}
