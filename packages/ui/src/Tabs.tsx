import * as TabsPrimitive from "@radix-ui/react-tabs"
import type { CSSProperties, ReactNode } from "react"

export type TabsProps = {
  value: string
  onValueChange: (value: string) => void
  children: ReactNode
  className?: string
}

export function Tabs({ value, onValueChange, children, className }: TabsProps) {
  return (
    <TabsPrimitive.Root value={value} onValueChange={onValueChange} className={className}>
      {children}
    </TabsPrimitive.Root>
  )
}

export type TabsListProps = {
  children: ReactNode
  "aria-label": string
  variant?: "default" | "pills"
  className?: string
  "data-testid"?: string
}

export function TabsList({ children, "aria-label": ariaLabel, variant = "default", className, "data-testid": testId }: TabsListProps) {
  const listClass =
    variant === "pills"
      ? "bianca-tabs-list bianca-tabs-list--pills"
      : "bianca-tabs-list"
  return (
    <TabsPrimitive.List
      className={[listClass, className].filter(Boolean).join(" ")}
      aria-label={ariaLabel}
      data-testid={testId}
    >
      {children}
    </TabsPrimitive.List>
  )
}

export type TabsTriggerProps = {
  value: string
  children: ReactNode
  variant?: "default" | "pill"
  className?: string
  "data-testid"?: string
}

export function TabsTrigger({ value, children, variant = "default", className, "data-testid": testId }: TabsTriggerProps) {
  const triggerClass =
    variant === "pill" ? "bianca-tabs-trigger bianca-tabs-trigger--pill" : "bianca-tabs-trigger"
  return (
    <TabsPrimitive.Trigger
      value={value}
      className={[triggerClass, "bianca-focus-ring", className].filter(Boolean).join(" ")}
      data-testid={testId}
    >
      {children}
    </TabsPrimitive.Trigger>
  )
}

export type TabsContentProps = {
  value: string
  children: ReactNode
  className?: string
  style?: CSSProperties
}

export function TabsContent({ value, children, className, style }: TabsContentProps) {
  return (
    <TabsPrimitive.Content
      value={value}
      className={["bianca-tabs-content", className].filter(Boolean).join(" ")}
      style={style}
      tabIndex={0}
    >
      {children}
    </TabsPrimitive.Content>
  )
}
