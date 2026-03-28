import type { FetchBaseQueryError } from "@reduxjs/toolkit/query"

export function getQueryErrorStatus(error: unknown): number | undefined {
  const e = error as FetchBaseQueryError
  return typeof e?.status === "number" ? e.status : undefined
}

export function getQueryErrorMessage(error: unknown): string {
  const e = error as FetchBaseQueryError
  const d = e?.data
  if (d && typeof d === "object" && "message" in d) {
    const m = (d as { message: unknown }).message
    if (typeof m === "string") return m
  }
  if (typeof d === "string") return d
  return ""
}
