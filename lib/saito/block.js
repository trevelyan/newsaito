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
  this.block.creation_time    = new Date().getTime();
  this.block.prevhash         = "";
  this.block.merkle           = "";
  this.block.miner            = "";
  this.block.id               = 0;
  this.block.transactions     = [];
  this.block.burn_fee         = 2.0;
  this.block.actual_burn_fee  = 0;
  //this.block.fee_step         = 0.000165;
  this.block.difficulty       = 0.1875;
  this.block.paysplit         = 0.5;
  this.block.treasury         = Big("10000000000.0");
  this.block.coinbase         = Big("0.0");
  this.block.reclaimed        = Big("0.0");
  this.block.paysplit_vote    = 0;     // -1 reduce miner payout
                                       //  0 no change
                                       //  1 increase miner payout
  // 
  this.block.elapsed_time     = 0;
  this.block.burnedFees       = 0;
  this.block.totalFees        = 0;

  this.confirmations          = conf;

  return this;

}
module.exports = Block;

Block.prototype.addTransaction = function addTransaction(tx) {
  this.block.transactions.push(JSON.stringify(tx));
  this.transactions.push(tx);
}

Block.prototype.returnHash = function returnHash() {
  if (this.hash != "") { return this.hash; }
  this.hash = this.app.crypt.hash( this.returnSignatureSource() );
  return this.hash;
}

Block.prototype.bundleBlock = function bundleBlock(prevblock=null) {
  console.log("block to bundle block:   " + (new Date().getTime()));

  //////////////////
  // sanity check //
  //////////////////
  if (this.app.blockchain.currently_indexing == true && this.app.blockchain.currently_reclaiming == true && this.app.mempool.currently_clearing == true) {
    var { currently_indexing, currently_reclaiming } = this.app.blockchain
    this.app.logger.logInfo(`block.js -- busy and refusing to create block: ${currently_indexing} / ${currently_reclaiming} / ${this.app.mempool.currently_clearing}`)
    return 0;
  }

  /////////////////
  // alphabetize //
  /////////////////
  this.transactions.sort();

  ////////////////////////////////
  // sequential transaction IDs //
  ////////////////////////////////

  /////////////////////////////
  // insert transaction json //
  /////////////////////////////
  var mtid = 0;
  if (prevblock != null) { mtid = prevblock.returnMaxTxId(); }
  for (let i = 0, n = this.transactions.length; i < n; i++) {
    mtid++;
    this.transactions[i].transaction.id = mtid;
    this.block.transactions[i] = this.transactions[i].returnTransactionJson();
  }


  ////////////////////////
  // set default values //
  ////////////////////////
  this.originating_peer   = "";


  if (this.transactions.length == 0) {
    this.block.merkle     = "";
  } else {
    this.block.merkle     = this.app.crypt.returnMerkleTree(this.block.transactions).root;
  }
  this.block.miner        = this.app.wallet.returnPublicKey();

  if (prevblock != null) {
    this.block.treasury = Big(prevblock.block.treasury).plus(prevblock.block.reclaimed);
    this.block.coinbase = Big(this.block.treasury).div(this.app.blockchain.genesis_period).toFixed(8);
    this.block.treasury = this.block.treasury.minus(Big(this.block.coinbase)).toFixed(8);

    this.block.id         = prevblock.block.id + 1;
    this.block.prevhash   = prevblock.returnHash();
    this.block.difficulty = prevblock.returnDifficulty();
    this.block.paysplit   = prevblock.returnPaysplit();
    this.block.burn_fee   = prevblock.returnBurnFee();
    this.block.fee_step   = prevblock.returnFeeStep();
  }

  ///////////////////
  // paysplit vote //
  ///////////////////
  //
  // now set in mempool as we select the txs for inclusion there
  //

  //////////////
  // burn fee //
  //////////////
  var nbf = this.calculateBurnFee(this.block.burn_fee, this.block.fee_step);
  this.block.burn_fee = nbf[0];
  this.block.fee_step = nbf[1];

  /////////////////////
  // monetary policy //
  /////////////////////
  // var block_self = this;

  // this.calculateReclaimedFunds(0, function(reclaimed, validates=0) {

    //////////////////////////////////////
    // repeat ourselves as new tx added //
    //////////////////////////////////////

    //
    // TODO - test to see if we can remove this earlier
    //
    // block_self.transactions.sort();
    // var mtid = 0;
    // if (prevblock != null) { mtid = prevblock.returnMaxTxId(); }
    // for (i = 0; i < block_self.transactions.length; i++) {
    //   mtid++;
    //   block_self.transactions[i].transaction.id = mtid;
    //   block_self.block.transactions[i] = block_self.transactions[i].returnTransactionJson();
    // }
  if (this.transactions.length == 0) {
    this.block.merkle     = "";
  } else {
    this.block.merkle     = this.app.crypt.returnMerkleTree(this.block.transactions).root;
  }


  ///////////////////////////////////////////
  // lite nodes will not properly set this //
  ///////////////////////////////////////////
  //
  // Big.js number
  //
  this.block.reclaimed = reclaimed;

  /////////////////////////////////////
  // add to blockchain and propagate //
  /////////////////////////////////////
  if (validates == 1) {
    this.app.blockchain.validateBlockAndQueueInMempool(this, 1);    // 1 = propagate
  }
  this.app.mempool.currently_creating = 0;

  // });
}

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
  for (var i = 0, n = this.transactions.length; i < n; i++) {
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
  for (var i = 0, n = this.transactions.length; i < n; i++) {
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
  for (var i = 0, n = this.transactions.length; i < n; i++) {
    var tmpfee = Big(this.transactions[i].returnFeeTotal());
    if (tmpfee.gt(0)) { total_fees = total_fees.plus(tmpfee); }
  }
  // needs proper bignum support
  return total_fees.toFixed(8);
}

Block.prototype.validate = function validate() {

  var block_self = this;

  ////////////////////////
  // check transactions //
  ////////////////////////
  if (block_self.block.transactions.length != block_self.transactions.length) {
    this.app.logger.logError("Block transactions do not match. Discarding.", {message:"",err:""});
    return false;
  }


  if (block_self.block.transactions.length > 0) {
    /////////////////////////
    // validate merkleTree //
    /////////////////////////
    var t = block_self.app.crypt.returnMerkleTree(block_self.block.transactions).root;
    if (t != block_self.block.merkle) {
      this.app.logger.logError("Block transaction roothash is not as expected", {message:"",err:""});
      return false;
    }

    ///////////////////
    // validate fees //
    ///////////////////
    if (block_self.validateTransactionFeesAdequate() == false) {
      this.app.logger.logError("Block invalid: transaction fees inadequate", {message:"",err:""});
      return false;
    }
  }

  ////////////////////////////
  // validate golden ticket //
  ////////////////////////////
  //
  // this is unncessary as we take care of it in the blockchain class
  //
  // when writing longest chain
  //
  //////////////////////////////
  // validate fee transaction //
  //////////////////////////////
  //
  // this is unnecessary as we take care of it in the blockchain class
  //
  // when writing longest chain
  //
  // must be for the surplus value calculated according to creator
  //

  ///////////////////////////
  // validate transactions //
  ///////////////////////////
  var ft_found = 0;
  var gt_found = 0;
  for (var i = 0, n = block_self.transactions.length; i < n; i++) {
    if (block_self.transactions[i].validate(block_self.app, block_self.block.paysplit_vote, block_self.block.id, block_self.returnAverageFee()) != true) {
      block_self.app.logger.logError("Block invalid: contains invalid transaction", {message:"",err:""});
      block_self.app.logger.logError(`hash: ${block_self.app.crypt.hash(JSON.stringify(block_self.transactions[i]))}`, {message:"",err:""});
      block_self.app.logger.logError(`sig: ${block_self.transactions[i].transaction.sig}`, {message:"",err:""});
      block_self.app.logger.logError(`msig: ${block_self.transactions[i].transaction.msig}`, {message:"",err:""});
      return false;
    }
    if (block_self.transactions[i].isGoldenTicket() == 1) { gt_found++; }
    if (block_self.transactions[i].isFeeTransaction() == 1) { ft_found++; }
    if (ft_found > 1) {
      block_self.app.logger.logError("Block invalid: contains invalid transaction", {message:"",err:""});
      return false;
    }
    if (gt_found > 1) {
      block_self.app.logger.logError("Block invalid: contains invalid transaction", {message:"",err:""});
      return false;
    }
  }

  return true;

}

Block.prototype.validateReclaimedFunds = function validateReclaimedFunds() {
  return new Promise((resolve, reject) => {
    // lite clients exit without validating
    if (this.app.BROWSER == 1 || this.app.SPVMODE == 1) {
      resolve(ts_burn_fee);
      return;
    }

    var block_self = this;

    // full nodes have to check
    this.calculateReclaimedFunds(true)
      .then((reclaimed, validates) => {
        if (validates == true) {
          reject("validation error: failure to rebroadcast required transaction");
          return;
        }

        if (Big(block_self.block.reclaimed).eq(reclaimed)) {
          resolve(true);
          return;
        } else {
          resolve(false);
          return;
        }
      });
  });

}

Block.prototype.calculateReclaimedFunds = function calculateReclaimedFunds(validate=false){
  return new Promise((resolve, reject) => {
    reclaimed = Big.js("0.5")
    resolve(reclaimed, true)
  })

}

Block.prototype.validateTransactionFeesAdequate = function validateTransactionFeesAdequate() {

  // validate first block
  if (this.block.prevhash == "") { return true; }
  var tb = this.app.blockchain.returnBlockByHash(this.block.prevhash);
  if (tb == null) { return true; }

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
  if (transaction_fees_needed.gt(usable_transaction_fees)) { return false; }

  return true;

}

Block.prototype.calculateBurnFee = function calculateBurnFee(starting_burn_fee, elapsed_time) {

  var bf    = 0

  bf = this.app.Mempool.adjustBurnFee(starting_burn_fee, elapsed_time)

  return bf;

}
