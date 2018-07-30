'use strict'
const saito = require('../saito')
const Winston = require('winston');
require('winston-daily-rotate-file');

/**
 * Logger Class
 * @param app
 */

function Logger(app) {

  if (!(this instanceof Logger)) { return new Logger(app); }

  this.app    = app || {};
  this.logger = null;

  return this;
}
module.exports = Logger;


Logger.prototype.initialize = function initialize() {
  if (this.app.BROWSER == 0) {
    const logger = Winston.createLogger({
      exitOnError: false,
      transports: [
        new (Winston.transports.DailyRotateFile)({
            name: 'info-file',
            filename: 'logs/info.log',
            level: 'info',
            prettyPrint: true,
            tailable: true,
            json: true,
            maxsize: 20000,
            zippedArchive: true,
        }),
        new (Winston.transports.DailyRotateFile)({
            name: 'error-file',
            filename: 'logs/error.log',
            level: 'warn',
            prettyPrint: true,
            tailable: true,
            json: true,
            maxsize: 20000,
            zippedArchive: true,
        })
      ],
      exceptionHandlers: [
          new Winston.transports.File({
              filename: 'logs/exceptions.log'
          })
        ]
    });

    if (process.env.NODE_ENV !== 'production') {
      logger.add(new Winston.transports.Console({
        name: 'console',
        format: Winston.format.simple(),
        timestamp: true,
        colorize: true,
        prettyPrint: true,
        depth: 4
      }));
    }
    this.logger = logger;
  }
}

Logger.prototype.logInfo = function logInfo(message) {
  if (this.app.BROWSER == 1) {
    console.log(message);
    return;
  }
  this.logger.info(message);
}

Logger.prototype.logError = function logError(message, err) {
  if (this.app.BROWSER == 1) {
    console.log(message + ": " + err);
    return;
  }
  this.logger.error(message, {
    message: err.message || '',
    stack: err.stack || '',
  });
}

