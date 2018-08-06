'use strict';

const saito = require('../saito');
const fs = require('fs');
const path = require('path');
const Big = require('big.js');


/**
 * Monitorl Constructor
 * @param {*} app
 */
function Monitor(app) {

  if (!(this instanceof Monitor)) {
    return new Monitor(app);
  }

  this.app                = app || {};

}
module.exports = Monitor;


/**
 * can the mempool bundle a block?
 */
Monitor.prototype.canBundleBlock = function canBundleBlock() {

  if (
    this.app.mempool.bundling_active == 0
  ) { return 1; }
  return 0;

}


