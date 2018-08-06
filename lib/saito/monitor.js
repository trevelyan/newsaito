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
 * canBundleBlock returns an inverse boolean of bundling_active
 * @returns {boolean} inverse bundling_active
 */
Monitor.prototype.canBundleBlock = function canBundleBlock() {
  return !this.bundling_active
}

/**
 * returns bundling_active boolean
 * @returns {boolean} bundling_active
 */
Monitor.prototype.returnBundlingActive = function returnBundlingActive() {
  return this.bundling_active
}

/**
 * toggleBundleBlock toggles the boolean value of bundling_active
 */
Monitor.prototype.toggleBundlingActive = function toggleBundlingActive() {
  this.bundling_active = !this.bundling_active
}


