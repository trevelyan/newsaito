'use strict';

const saito = require('../saito');
const Big = require('big.js');


function Block(app, blkjson="", conf=-1) {

  if (!(this instanceof Block)) {
    return new Block(app, blkjson, conf=-1);
  }

  this.app = app || {};

  /////////////////////////
  // consensus variables //
  /////////////////////////
  this.block                  = {};
  this.block.creation_time     = new Date().getTime();
  this.block.prevhash         = "";
  this.block.merkle           = "";
  this.block.miner            = "";
  this.block.id               = 0;
  this.block.transactions     = [];
  this.block.burn_fee         = 2.0;
  //this.block.fee_step         = 0.000165;
  this.block.difficulty       = 0.0;
  this.block.paysplit         = 0.5;
  this.block.treasury         = Big("10000000000.0");
  this.block.coinbase         = Big("0.0");
  this.block.reclaimed        = Big("0.0");
  this.block.paysplit_vote    = 0;     // -1 reduce miner payout
                                       //  0 no change
                                       //  1 increase miner payout
  this.block.elapsed_time     = 0;
  this.block.burnedFees       = 0;
  this.block.totalFees        = 0;
  //this.

  this.confirmations          = conf;

  return this;

}
module.exports = Block;


Block.prototype.returnTransactionFeesNeeded = function returnTransactionFeesNeeded(ts_start, ts_issue, ts_burn_fee) {
  var unixtime_original        = ts_start;
  var unixtime_current         = ts_issue;
  var milliseconds_since_block = unixtime_current - unixtime_original;

  var feesneeded = this.app.mempool.calculateBurnFee(ts_burn_fee, milliseconds_since_block);

  if (feesneeded.lt(0)) { feesneeded = Big(0); }

  return feesneeded.toFixed(8);

}
Block.prototype.returnTransactionFeesNeededForThisBlock = function returnTransactionFeesNeededForThisBlock() {

  var unixtime_start = this.app.blockchain.returnUnixtime(this.block.prevhash);
  var unixtime_current = this.block.unixtime;
  var ts_bf = this.app.blockchain.returnBurnFee(this.block.prevhash);

  if (ts_bf == -1) { return Big(0).toFixed(8); }

  return this.returnTransactionFeesNeeded(unixtime_start, unixtime_current, ts_bf);

}

Block.prototype.returnTransactionFeesTotalSurplus = function returnTransactionFeesTotalSurplus() {

  var unixtime_start = this.app.blockchain.returnUnixtime(this.block.prevhash);
  var unixtime_current = this.block.unixtime;
  var ts_bf = this.app.blockchain.returnBurnFee(this.block.prevhash);

  var transaction_fees_needed = Big(this.returnTransactionFeesNeeded(unixtime_start, unixtime_current, ts_bf));
  var transaction_fees   = Big(this.returnTransactionFeesTotal());

  var surplus_fees = transaction_fees.minus(transaction_fees_needed);
  if (surplus_fees.lt(0)) { surplus_fees = Big(0); }

  return surplus_fees.toFixed(8);

}

Block.prototype.returnTransactionFeesUsableSurplus = function returnTransactionFeesUsableSurplus() {

  var unixtime_start = this.app.blockchain.returnUnixtime(this.block.prevhash);
  var unixtime_current = this.block.unixtime;
  var ts_bf = this.app.blockchain.returnBurnFee(this.block.prevhash);

  var transaction_fees_needed = Big(this.returnTransactionFeesNeeded(unixtime_start, unixtime_current, ts_bf));
  var transaction_fees   = Big(this.returnTransactionFeesUsable());

  var surplus_fees = transaction_fees.minus(transaction_fees_needed);
  if (surplus_fees.lt(0)) { surplus_fees = Big(0); }

  return surplus_fees.toFixed(8);

}
Block.prototype.returnTransactionFeesUsableForBlockCreatorSurplus = function returnTransactionFeesUsableForBlockCreatorSurplus() {

  var unixtime_start = this.app.blockchain.returnUnixtime(this.block.prevhash);
  var unixtime_current = this.block.unixtime;
  var ts_bf = this.app.blockchain.returnBurnFee(this.block.prevhash);

  var transaction_fees_needed = Big(this.returnTransactionFeesNeeded(unixtime_start, unixtime_current, ts_bf));
  var transaction_fees   = Big(this.returnTransactionFeesUsableForBlockCreator());

  var surplus_fees = transaction_fees.minus(transaction_fees_needed);
  if (surplus_fees.lt(0)) { surplus_fees = Big(0); }

  return surplus_fees.toFixed(8);

}
Block.prototype.returnTransactionFeesUsableForBlockCreatorSurplusForThisBlock = function returnTransactionFeesUsableForBlockCreatorSurplusForThisBlock() {

  var unixtime_start = this.app.blockchain.returnUnixtime(this.block.prevhash);
  var unixtime_current = this.block.unixtime;
  var ts_bf = this.app.blockchain.returnBurnFee(this.block.prevhash);

  var transaction_fees_needed = Big(this.returnTransactionFeesNeeded(unixtime_start, unixtime_current, ts_bf));
  var transaction_fees   = Big(this.returnTransactionFeesUsableForBlockCreator());

  var surplus_fees = transaction_fees.minus(transaction_fees_needed);
  if (surplus_fees.lt(0)) { surplus_fees = Big(0); }

  return surplus_fees.toFixed(8);

}
Block.prototype.returnTransactionFeesUsable = function returnTransactionFeesUsable() {
  var total_fees = Big(0.0);
  for (var i = 0; i < this.transactions.length; i++) {
    var tmpfee = Big(this.transactions[i].returnFeeUsable());
    if (this.transactions[i].transaction.ft != 1) {
      if (tmpfee.gt(0)) {
        total_fees = total_fees.plus(tmpfee);
      }
    }
  }
  return total_fees.toFixed(8);
}
Block.prototype.returnTransactionFeesUsableForBlockCreator = function returnTransactionFeesUsableForBlockCreator() {
  var total_fees = Big(0.0);
  for (var i = 0; i < this.transactions.length; i++) {
    var tmpfee = Big(this.transactions[i].returnFeeUsableForBlockCreator(this.app, this.block.miner));
    if (this.transactions[i].transaction.ft != 1) {
      if (tmpfee.gt(0)) {
        total_fees = total_fees.plus(tmpfee);
      }
    }
  }
  return total_fees.toFixed(8);
}
Block.prototype.returnTransactionFeesTotal = function returnTransactionFeesTotal() {
  var total_fees = Big(0.0);
  for (var i = 0; i < this.transactions.length; i++) {
    var tmpfee = Big(this.transactions[i].returnFeeTotal());
    if (tmpfee.gt(0)) { total_fees = total_fees.plus(tmpfee); }
  }
  // needs proper bignum support
  return total_fees.toFixed(8);
}

Block.prototype.validateTransactionFeesAdequate = function validateTransactionFeesAdequate() {

  // validate first block
  if (this.block.prevhash == "") { return 1; }
  var tb = this.app.blockchain.returnBlockByHash(this.block.prevhash);
  if (tb == null) { return 1; }

  // otherwise calculate
  var unixtime_start = this.app.blockchain.returnUnixtime(this.block.prevhash);
  var unixtime_current = this.block.unixtime;
  var ts_bf = this.app.blockchain.returnBurnFee(this.block.prevhash);

  var transaction_fees_needed = Big(this.returnTransactionFeesNeeded(unixtime_start, unixtime_current, ts_bf));

  var usable_transaction_fees   = Big(0.0);
  for (var i = 0; i < this.block.transactions.length; i++) {
    if (this.transactions[i].transaction.ft != 1) {
      usable_transaction_fees = usable_transaction_fees.plus(this.transactions[i].returnFeeUsable());
    }
  }
  if (transaction_fees_needed.gt(usable_transaction_fees)) { return 0; }

  return 1;

}

Block.prototype.calculateBurnFee = function calculateBurnFee(starting_burn_fee, elapsed_time) {

  var bf    = 0

  bf = this.app.Mempool.adjustBurnFee(starting_burn_fee, elapsed_time)

  return bf;

}
