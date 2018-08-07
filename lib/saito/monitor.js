'use strict';

/**
 * Monitor Constructor
 * @param {*} app
 */
function Monitor(app) {

  if (!(this instanceof Monitor)) {
    return new Monitor(app);
  }


//   this.app                      = app || {};
//   this.blockchain_is_indexing   = false;
//   this.blockchain_is_reclaiming = false;
//   this.mempool_is_bundling      = false;
//   this.mempool_is_creating      = false;
  this.app                = app || {};


  return this;
}
module.exports = Monitor;

/**
 * returns mempool_is_bundling field
 * @returns {boolean} mempool_is_bundling
 */
Monitor.prototype.canBundleBlock = function canBundleBlock() {
  return this.app.mempool.bundle_active;
}

/**
 * Checks if multiple values are true to determine if the blockchain is active
 */
Monitor.prototype.isBlockchainActive = function isBlockchainActive() {
  return this.app.blockchain.indexing
  && this.app.blockchain.reclaiming
  && this.app.mempool.bundling_clearing
}
