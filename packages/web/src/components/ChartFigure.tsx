import { useId, type CSSProperties, type ReactNode } from "react"

export type ChartFigureProps = {
  title: string
  summary: string
  children: ReactNode
  className?: string
  style?: CSSProperties
  chartStyle?: CSSProperties
}

/** Wraps a chart with screen-reader title and data summary; visual chart is aria-hidden. */
export function ChartFigure({ title, summary, children, className, style, chartStyle }: ChartFigureProps) {
  const titleId = useId()
  const summaryId = useId()

  return (
    <figure className={className} style={style} aria-labelledby={titleId} aria-describedby={summaryId}>
      <figcaption id={titleId} className="sr-only">
        {title}
      </figcaption>
      <p id={summaryId} className="sr-only">
        {summary}
      </p>
      <div aria-hidden="true" style={chartStyle}>
        {children}
      </div>
    </figure>
  )
}
