import { useTranslation } from "react-i18next"

/** Visible label for intentionally retained sample/mock content (dev or labeled previews). */
export function MockDataBanner({ testId }: { testId?: string }) {
  const { t } = useTranslation()
  return (
    <p
      data-testid={testId ?? "mock-data-banner"}
      style={{
        margin: 0,
        padding: "0.65rem 0.85rem",
        borderRadius: 8,
        fontSize: "0.8125rem",
        fontWeight: 600,
        color: "var(--va-amber-900)",
        background: "var(--va-amber-50)",
        border: "1px solid var(--va-amber-200)",
        lineHeight: 1.45,
      }}
      role="note"
    >
      {t("common.mockDataBanner")}
    </p>
  )
}
