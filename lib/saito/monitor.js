'use strict';

/**
 * Monitor Constructor
 * @param {*} app
 */
function Monitor(app) {

  if (!(this instanceof Monitor)) {
    return new Monitor(app);
  }

  this.app                = app || {};
  this.bundling_active    = false;

  return this;
}
module.exports = Monitor;

/**
 * returns bundling_active field
 * @returns {boolean} bundling_active
 */
Monitor.prototype.isBundlingActive = function returnBundlingActive() {
  return this.bundling_active
}

/**
 * toggleBundleBlock toggles bundling_active field
 */
Monitor.prototype.toggleBundlingActive = function toggleBundlingActive() {
  this.bundling_active = !this.bundling_active
}


