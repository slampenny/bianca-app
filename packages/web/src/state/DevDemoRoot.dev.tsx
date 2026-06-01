import type { ReactNode } from "react"
import { DemoProvider } from "./DemoProvider.dev"

export function DevDemoRoot({ children }: { children: ReactNode }) {
  return <DemoProvider>{children}</DemoProvider>
}
