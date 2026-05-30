/** Builds a comma-separated summary for bar/line chart screen readers. */
export function summarizeChartSeries<T extends object>(
  data: T[],
  categoryKey: keyof T & string,
  valueKey: keyof T & string,
  formatItem: (category: string | number, value: string | number) => string,
  emptyLabel: string,
): string {
  if (!data.length) return emptyLabel
  return data
    .map((row) => formatItem(row[categoryKey] as string | number, row[valueKey] as string | number))
    .join(", ")
}
