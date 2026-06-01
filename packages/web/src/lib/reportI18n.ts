import type { TFunction } from "i18next"
import { reportTemplates, type ReportTemplate, type ReportTemplateId } from "../data/reportCatalog"

/** Localized copy for report library cards (ids match `reports.templates.*` in en). */
export function localizedReportTemplates(t: TFunction): ReportTemplate[] {
  return reportTemplates.map((tm) => ({
    ...tm,
    title: t(`reports.templates.${tm.id}.title`),
    subtitle: t(`reports.templates.${tm.id}.subtitle`),
    description: t(`reports.templates.${tm.id}.description`),
    cadence: t(`reports.templates.${tm.id}.cadence`),
    tags: [t(`reports.templates.${tm.id}.tag0`), t(`reports.templates.${tm.id}.tag1`)],
  }))
}

export function localizedStaffVersusFamily(t: TFunction) {
  return {
    title: t("reports.staffVsFamilyTitle"),
    body: [t("reports.staffVsFamily1"), t("reports.staffVsFamily2"), t("reports.staffVsFamily3")],
  }
}

export function localizedReportTemplate(t: TFunction, id: ReportTemplateId): ReportTemplate | undefined {
  const base = reportTemplates.find((x) => x.id === id)
  if (!base) return undefined
  return {
    ...base,
    title: t(`reports.templates.${id}.title`),
    subtitle: t(`reports.templates.${id}.subtitle`),
    description: t(`reports.templates.${id}.description`),
    cadence: t(`reports.templates.${id}.cadence`),
    tags: [t(`reports.templates.${id}.tag0`), t(`reports.templates.${id}.tag1`)],
  }
}
