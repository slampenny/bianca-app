const winston = require('winston');

const logger = winston.createLogger({
  //level: process.env.NO DE_ENV === 'production' ? 'info' : 'debug',
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => `${timestamp} ${level}: ${message}`)
  ),
  transports: [
    new winston.transports.Console({
      stderrLevels: ['error'] // 'error' level logs go to STDERR; all others to STDOUT
    })
  ],
  exceptionHandlers: [
    new winston.transports.Console({
      stderrLevels: ['error']
    })
  ],
  rejectionHandlers: [
    new winston.transports.Console({
      stderrLevels: ['error']
    })
  ]
});

module.exports = logger;
