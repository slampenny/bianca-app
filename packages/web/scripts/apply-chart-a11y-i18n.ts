/**
 * Applies chart/a11y i18n strings added for WCAG chart summaries and schedule labels.
 * Run: yarn tsx scripts/apply-chart-a11y-i18n.ts
 */
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const LOCALES_DIR = path.join(__dirname, "../src/i18n/locales")

const FIXES: Record<string, Record<string, string>> = {
  es: {
    "dashboard.chartSummaryItem": "{{hour}}: {{count}} llamadas",
    "dashboard.chartSummary": "Llamadas por hora: {{items}}",
    "dashboard.chartSummaryEmpty": "No hay datos de llamadas por hora.",
    "residentDetail.scheduleFrequencyLabel": "Frecuencia",
    "residentDetail.scheduleTimeLabel": "Hora",
    "residentDetail.sentimentChartSummaryItem": "{{date}} · {{score}}",
    "residentDetail.sentimentChartSummary": "Puntuaciones de sentimiento por fecha: {{items}}",
    "residentDetail.sentimentChartSummaryEmpty": "No hay datos de tendencia de sentimiento.",
    "reports.activityChartSummaryItem": "{{day}}: {{count}} ejecuciones",
    "reports.activityChartSummary": "Ejecuciones de informes por día: {{items}}",
    "reports.activityChartSummaryEmpty": "No hay datos de ejecución de informes.",
  },
  fr: {
    "dashboard.chartSummaryItem": "{{hour}} : {{count}} appels",
    "dashboard.chartSummary": "Appels par heure : {{items}}",
    "dashboard.chartSummaryEmpty": "Aucune donnée d'appels par heure.",
    "residentDetail.scheduleFrequencyLabel": "Fréquence",
    "residentDetail.scheduleTimeLabel": "Heure",
    "residentDetail.sentimentChartSummaryItem": "{{date}} : {{score}}",
    "residentDetail.sentimentChartSummary": "Scores de sentiment par date : {{items}}",
    "residentDetail.sentimentChartSummaryEmpty": "Aucune donnée de tendance de sentiment.",
    "reports.activityChartSummaryItem": "{{day}} : {{count}} exécutions",
    "reports.activityChartSummary": "Exécutions de rapports par jour : {{items}}",
    "reports.activityChartSummaryEmpty": "Aucune donnée d'exécution de rapports.",
  },
  de: {
    "dashboard.chartSummaryItem": "{{hour}}: {{count}} Anrufe",
    "dashboard.chartSummary": "Anrufe pro Stunde: {{items}}",
    "dashboard.chartSummaryEmpty": "Keine stündlichen Anrufdaten.",
    "residentDetail.scheduleFrequencyLabel": "Häufigkeit",
    "residentDetail.scheduleTimeLabel": "Uhrzeit",
    "residentDetail.sentimentChartSummaryItem": "{{date}} · {{score}}",
    "residentDetail.sentimentChartSummary": "Stimmungswerte nach Datum: {{items}}",
    "residentDetail.sentimentChartSummaryEmpty": "Keine Stimmungstrenddaten.",
    "reports.activityChartSummaryItem": "{{day}}: {{count}} Ausführungen",
    "reports.activityChartSummary": "Berichtsausführungen pro Tag: {{items}}",
    "reports.activityChartSummaryEmpty": "Keine Berichtsausführungsdaten.",
  },
  zh: {
    "dashboard.chartSummaryItem": "{{hour}}：{{count}} 通电话",
    "dashboard.chartSummary": "每小时通话量：{{items}}",
    "dashboard.chartSummaryEmpty": "暂无每小时通话数据。",
    "residentDetail.scheduleFrequencyLabel": "频率",
    "residentDetail.scheduleTimeLabel": "时间",
    "residentDetail.sentimentChartSummaryItem": "{{date}}：{{score}}",
    "residentDetail.sentimentChartSummary": "按日期的情绪分数：{{items}}",
    "residentDetail.sentimentChartSummaryEmpty": "暂无情绪趋势数据。",
    "reports.activityChartSummaryItem": "{{day}}：{{count}} 次运行",
    "reports.activityChartSummary": "每日报告运行次数：{{items}}",
    "reports.activityChartSummaryEmpty": "暂无报告运行数据。",
  },
  ja: {
    "dashboard.chartSummaryItem": "{{hour}}: {{count}} 件の通話",
    "dashboard.chartSummary": "時間別通話数: {{items}}",
    "dashboard.chartSummaryEmpty": "時間別通話データがありません。",
    "residentDetail.scheduleFrequencyLabel": "頻度",
    "residentDetail.scheduleTimeLabel": "時間",
    "residentDetail.sentimentChartSummaryItem": "{{date}} · {{score}}",
    "residentDetail.sentimentChartSummary": "日付別の感情スコア: {{items}}",
    "residentDetail.sentimentChartSummaryEmpty": "感情トレンドデータがありません。",
    "reports.activityChartSummaryItem": "{{day}}: {{count}} 回",
    "reports.activityChartSummary": "日別レポート実行回数: {{items}}",
    "reports.activityChartSummaryEmpty": "レポート実行データがありません。",
  },
  pt: {
    "dashboard.chartSummaryItem": "{{hour}}: {{count}} chamadas",
    "dashboard.chartSummary": "Chamadas por hora: {{items}}",
    "dashboard.chartSummaryEmpty": "Sem dados de chamadas por hora.",
    "residentDetail.scheduleFrequencyLabel": "Frequência",
    "residentDetail.scheduleTimeLabel": "Hora",
    "residentDetail.sentimentChartSummaryItem": "{{date}} · {{score}}",
    "residentDetail.sentimentChartSummary": "Pontuações de sentimento por data: {{items}}",
    "residentDetail.sentimentChartSummaryEmpty": "Sem dados de tendência de sentimento.",
    "reports.activityChartSummaryItem": "{{day}}: {{count}} execuções",
    "reports.activityChartSummary": "Execuções de relatórios por dia: {{items}}",
    "reports.activityChartSummaryEmpty": "Sem dados de execução de relatórios.",
  },
  it: {
    "dashboard.chartSummaryItem": "{{hour}}: {{count}} chiamate",
    "dashboard.chartSummary": "Chiamate per ora: {{items}}",
    "dashboard.chartSummaryEmpty": "Nessun dato sulle chiamate orarie.",
    "residentDetail.scheduleFrequencyLabel": "Frequenza",
    "residentDetail.scheduleTimeLabel": "Ora",
    "residentDetail.sentimentChartSummaryItem": "{{date}} · {{score}}",
    "residentDetail.sentimentChartSummary": "Punteggi di sentiment per data: {{items}}",
    "residentDetail.sentimentChartSummaryEmpty": "Nessun dato sulla tendenza del sentiment.",
    "reports.activityChartSummaryItem": "{{day}}: {{count}} esecuzioni",
    "reports.activityChartSummary": "Esecuzioni report per giorno: {{items}}",
    "reports.activityChartSummaryEmpty": "Nessun dato sulle esecuzioni dei report.",
  },
  ru: {
    "dashboard.chartSummaryItem": "{{hour}}: {{count}} звонков",
    "dashboard.chartSummary": "Звонки по часам: {{items}}",
    "dashboard.chartSummaryEmpty": "Нет данных о звонках по часам.",
    "residentDetail.scheduleFrequencyLabel": "Частота",
    "residentDetail.scheduleTimeLabel": "Время",
    "residentDetail.sentimentChartSummaryItem": "{{date}} · {{score}}",
    "residentDetail.sentimentChartSummary": "Оценки настроения по датам: {{items}}",
    "residentDetail.sentimentChartSummaryEmpty": "Нет данных о тренде настроения.",
    "reports.activityChartSummaryItem": "{{day}}: {{count}} запусков",
    "reports.activityChartSummary": "Запуски отчётов по дням: {{items}}",
    "reports.activityChartSummaryEmpty": "Нет данных о запусках отчётов.",
  },
  ar: {
    "dashboard.chartSummaryItem": "{{hour}}: {{count}} مكالمات",
    "dashboard.chartSummary": "المكالمات حسب الساعة: {{items}}",
    "dashboard.chartSummaryEmpty": "لا توجد بيانات للمكالمات حسب الساعة.",
    "residentDetail.scheduleFrequencyLabel": "التكرار",
    "residentDetail.scheduleTimeLabel": "الوقت",
    "residentDetail.sentimentChartSummaryItem": "{{date}} · {{score}}",
    "residentDetail.sentimentChartSummary": "درجات المشاعر حسب التاريخ: {{items}}",
    "residentDetail.sentimentChartSummaryEmpty": "لا توجد بيانات لاتجاه المشاعر.",
    "reports.activityChartSummaryItem": "{{day}}: {{count}} تشغيلات",
    "reports.activityChartSummary": "تشغيلات التقارير حسب اليوم: {{items}}",
    "reports.activityChartSummaryEmpty": "لا توجد بيانات لتشغيل التقارير.",
  },
  ko: {
    "dashboard.chartSummaryItem": "{{hour}}: {{count}}통",
    "dashboard.chartSummary": "시간별 통화: {{items}}",
    "dashboard.chartSummaryEmpty": "시간별 통화 데이터가 없습니다.",
    "residentDetail.scheduleFrequencyLabel": "빈도",
    "residentDetail.scheduleTimeLabel": "시간",
    "residentDetail.sentimentChartSummaryItem": "{{date}} · {{score}}",
    "residentDetail.sentimentChartSummary": "날짜별 감정 점수: {{items}}",
    "residentDetail.sentimentChartSummaryEmpty": "감정 추세 데이터가 없습니다.",
    "reports.activityChartSummaryItem": "{{day}}: {{count}}회 실행",
    "reports.activityChartSummary": "일별 보고서 실행: {{items}}",
    "reports.activityChartSummaryEmpty": "보고서 실행 데이터가 없습니다.",
  },
  hu: {
    "dashboard.chartSummaryItem": "{{hour}}: {{count}} hívás",
    "dashboard.chartSummary": "Hívások óránként: {{items}}",
    "dashboard.chartSummaryEmpty": "Nincs óránkénti hívásadat.",
    "residentDetail.scheduleFrequencyLabel": "Gyakoriság",
    "residentDetail.scheduleTimeLabel": "Idő",
    "residentDetail.sentimentChartSummaryItem": "{{date}} · {{score}}",
    "residentDetail.sentimentChartSummary": "Hangulatelemzési pontszámok dátum szerint: {{items}}",
    "residentDetail.sentimentChartSummaryEmpty": "Nincs hangulatelemzési trendadat.",
    "reports.activityChartSummaryItem": "{{day}}: {{count}} futtatás",
    "reports.activityChartSummary": "Jelentésfuttatások naponta: {{items}}",
    "reports.activityChartSummaryEmpty": "Nincs jelentésfuttatási adat.",
  },
}

function setByPath(obj: Record<string, unknown>, dotPath: string, value: string) {
  const parts = dotPath.split(".")
  let cur: Record<string, unknown> = obj
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i]
    if (!cur[key] || typeof cur[key] !== "object") cur[key] = {}
    cur = cur[key] as Record<string, unknown>
  }
  cur[parts[parts.length - 1]] = value
}

for (const [code, fixes] of Object.entries(FIXES)) {
  const mod = await import(`../src/i18n/locales/${code}.ts`)
  const tree = structuredClone(mod[code] as Record<string, unknown>)
  for (const [dotPath, value] of Object.entries(fixes)) {
    setByPath(tree, dotPath, value)
  }
  const banner = `/** ${code.toUpperCase()} UI strings for the web app. */\n`
  fs.writeFileSync(path.join(LOCALES_DIR, `${code}.ts`), `${banner}export const ${code} = ${JSON.stringify(tree, null, 2)} as const\n`, "utf8")
  console.log(`${code}: applied ${Object.keys(fixes).length} chart/a11y strings`)
}
