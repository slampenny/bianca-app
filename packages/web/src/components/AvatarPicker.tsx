import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

type AvatarPickerProps = {
  label: string
  initialsSource: string
  existingAvatarUrl?: string | null
  onPick: (file: File | null) => void
}

export function AvatarPicker({ label, initialsSource, existingAvatarUrl, onPick }: AvatarPickerProps) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [preview])

  const displayAvatar = useMemo(() => preview || existingAvatarUrl || "", [preview, existingAvatarUrl])

  const pickFile = (f: File | null) => {
    if (preview) URL.revokeObjectURL(preview)
    setPreview(f ? URL.createObjectURL(f) : null)
    setFileName(f?.name ?? null)
    onPick(f)
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 8 }}>
      {displayAvatar ? (
        <img
          src={displayAvatar}
          alt=""
          style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover", border: "1px solid var(--va-slate-200)" }}
        />
      ) : (
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            background: "var(--va-slate-200)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "1.25rem",
            color: "var(--va-slate-500)",
          }}
        >
          {(initialsSource || "?").slice(0, 1).toUpperCase()}
        </div>
      )}
      <div style={{ fontSize: "0.8125rem", color: "var(--va-slate-600)" }}>
        <span style={{ display: "block", marginBottom: 6 }}>{label}</span>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={(ev) => pickFile(ev.target.files?.[0] ?? null)}
          style={{ display: "none" }}
        />
        <button
          type="button"
          className="va-btn-secondary"
          style={{ padding: "0.35rem 0.65rem", fontSize: "0.75rem" }}
          onClick={() => inputRef.current?.click()}
        >
          {t("profile.choosePhoto")}
        </button>
        <p style={{ fontSize: "0.75rem", margin: "6px 0 0", color: "var(--va-slate-500)" }}>
          {fileName ?? t("profile.noPhotoSelected")}
        </p>
      </div>
    </div>
  )
}
