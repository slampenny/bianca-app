const winston = require('winston');
const config = require('./config');

const enumerateErrorFormat = winston.format((info) => {
  if (info instanceof Error) {
    Object.assign(info, { message: info.stack });
  }
  return info;
});
console.log("CONfIG ENV:" + config.env);
const logger = winston.createLogger({
  level: ['development', 'test'].includes(config.env) ? 'debug' : 'info',
  format: winston.format.combine(
    enumerateErrorFormat(),
    ['development', 'test'].includes(config.env) ? winston.format.colorize() : winston.format.uncolorize(),
    winston.format.splat(),
    winston.format.printf(({ level, message }) => `${level}: ${message}`)
  ),
  transports: [
    new winston.transports.Console({
      stderrLevels: ['error'],
    }),
  ],
});

console.log("LOG_LEVEL:" + logger.level);

module.exports = logger;
