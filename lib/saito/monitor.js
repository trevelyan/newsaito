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
 * returns mempool_is_bundling field
 * @returns {boolean} mempool_is_bundling
 */
Monitor.prototype.canMempoolBundleBlock = function canMempoolBundleBlock() {
  return (!
    this.app.mempool.bundling_active == true &&
    this.app.mempool.blocks.length > 0
  );
}

/**
 * Checks if multiple values are true to determine if the blockchain is active
 */
Monitor.prototype.canBlockBundle = function canBlockBundle() {
  return (!
    this.app.mempool.bundling_active == true
  );
}



