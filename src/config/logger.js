const winston = require('winston');
const config = require('./config');

const enumerateErrorFormat = winston.format((info) => {
  if (info instanceof Error) {
    Object.assign(info, { message: info.stack });
  }
  return info;
});

console.log("CONFIG ENV:", config.env);

const logger = winston.createLogger({
  level: ['development', 'test'].includes(config.env) ? 'debug' : 'info',
  format: winston.format.combine(
    enumerateErrorFormat(),
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => `${timestamp} ${level}: ${message}`)
  ),
  transports: [
    // Log to the console
    new winston.transports.Console({
      stderrLevels: ['error']
    }),
    // Log to a file (logs/app.log)
    new winston.transports.File({ filename: 'logs/app.log' })
  ],
  exceptionHandlers: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/exceptions.log' })
  ],
  rejectionHandlers: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/rejections.log' })
  ]
});

logger.debug("Logger initialized at level: " + logger.level);

module.exports = logger;
