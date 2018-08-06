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

  return this;
}
module.exports = Monitor;

/**
 * returns bundling_active field
 * @returns {boolean} bundling_active
 */
Monitor.prototype.canBundleBlock = function canBundleBlock() {
  if (
    this.app.mempool.bundle_active == 1
  ) {
    return true;
  }
  return false;
}


/**
 * toggleBundleBlock toggles bundling_active field
 */
Monitor.prototype.toggleBundlingActive = function toggleBundlingActive() {
  this.bundling_active = !this.bundling_active
}


