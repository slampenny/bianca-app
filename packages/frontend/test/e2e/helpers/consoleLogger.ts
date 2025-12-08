import * as fs from 'fs'
import * as path from 'path'

const logsDir = path.join(__dirname, '../../test-logs')
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true })
}

const logFile = path.join(logsDir, `console-${Date.now()}.log`)

export function setupConsoleLogging(page: any) {
  const logs: string[] = []
  const errors: string[] = []
  
  // Capture console messages
  page.on('console', (msg: any) => {
    const timestamp = new Date().toISOString()
    const type = msg.type()
    const text = msg.text()
    const logEntry = `[${timestamp}] [${type}] ${text}\n`
    logs.push(logEntry)
    
    // Also log to console for immediate visibility
    if (type === 'error' || type === 'warning') {
      console.error(`[Browser ${type}]:`, text)
      errors.push(logEntry)
    }
  })
  
  // Capture page errors
  page.on('pageerror', (error: Error) => {
    const timestamp = new Date().toISOString()
    const logEntry = `[${timestamp}] [PAGE ERROR] ${error.message}\n${error.stack}\n\n`
    logs.push(logEntry)
    errors.push(logEntry)
    console.error('[Browser Page Error]:', error)
  })
  
  // Capture unhandled promise rejections
  page.on('requestfailed', (request: any) => {
    const timestamp = new Date().toISOString()
    const logEntry = `[${timestamp}] [REQUEST FAILED] ${request.method()} ${request.url()}\n`
    logs.push(logEntry)
    errors.push(logEntry)
  })
  
  // Write logs to file periodically and on close
  const writeLogs = () => {
    const allLogs = logs.join('')
    const allErrors = errors.join('')
    
    if (allLogs) {
      fs.appendFileSync(logFile, allLogs)
      logs.length = 0 // Clear after writing
    }
    
    if (allErrors) {
      const errorFile = logFile.replace('.log', '-errors.log')
      fs.appendFileSync(errorFile, allErrors)
      console.log(`\n⚠️  Errors captured in: ${errorFile}`)
      errors.length = 0 // Clear after writing
    }
  }
  
  // Write logs on page close
  page.on('close', writeLogs)
  
  // Also write periodically (every 5 seconds)
  const interval = setInterval(writeLogs, 5000)
  
  // Cleanup interval on page close
  page.on('close', () => clearInterval(interval))
  
  console.log(`📝 Console logs will be captured in: ${logFile}`)
}

