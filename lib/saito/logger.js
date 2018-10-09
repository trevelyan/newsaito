'use strict'

const Winston = require('winston');
require('winston-daily-rotate-file');

/**
 * Logger Constructor
 * @param {*} app
 */

function Logger(app) {

  if (!(this instanceof Logger)) { return new Logger(app); }

  this.app    = app || {};
  this.logger = null;

  return this;
}
module.exports = Logger;

/**
 * Initializes the Logger object
 * @returns {winston.Logger} logger
 */
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
            timestamp: true,
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
      //exceptionHandlers: [
      //    new Winston.transports.File({
      //        filename: 'logs/exceptions.log'
      //    })
      //  ]
    });

    if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV === 'test') {
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

/**
 * Logs a message to info log file
 * @param {string} message
 */
Logger.prototype.logInfo = function logInfo(message) {
  if (this.app.BROWSER == 1) {
    return;
  }
  //console.log(message);
  //process.exit(1)
  this.logger.info(message);
}


/**
 * Logs an error to error log file
 * @param {string} message
 * @param {error} err
 */
Logger.prototype.logError = function logError(message, err) {
  console.log(message);

  //
  //process.exit(1);

  if (this.app.BROWSER == 1) {
    console.log(message + ": " + err);
    return;
  }
  this.logger.error(message, {
    message: err.message || '',
    stack: err.stack || '',
  });
}

