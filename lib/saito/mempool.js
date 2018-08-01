'use strict';

const saito = require('../saito');
const fs = require('fs');
const path = require('path');
const Big = require('big.js');


/////////////////
// Constructor //
/////////////////
function Mempool(app) {

  if (!(this instanceof Mempool)) {
    return new Mempool(app);
  }

  this.app = app || {};

  this.directory = path.join(__dirname, '../data/');

  this.transactions = []; // array
  this.transactions_hash = {}; // contains tx.sig --> index
  //           gt --> index
  this.downloads = []; // queue fifo
  this.blocks = []; // queue fifo
  this.recovered = []; // array of recovered txs
  // used when reorgs affect
  // our old blocks

  this.currently_bundling = 0;
  this.bundling_speed = 50;

  this.burnfee = 2;
  this.desiredBlockTime = 30000;

  return this;

}
module.exports = Mempool;


////////////////
// initialize //
////////////////
//
// start the loop to try and bundle blocks
//
Mempool.prototype.initialize = function initialize() {

  var mempool_self = this;

  if (mempool_self.app.BROWSER == 0 || mempool_self.app.SPVMODE == 0) {

    // use a timeout to get network class a
    // bit of time to initialize. otherwise
    // we can have problems with calls to
    // returnNumberOfPeers() etc.
    // older - setTimeout(function() {
    mempool_self.startBundling();
    // older - }, 1000);
  }

}


///////////////////
// startBundling //
///////////////////
//
// start our loop that attempts to bundle blocks
//
Mempool.prototype.startBundling = function startBundling() {

  if (this.currently_bundling == 1) {
    return;
  }

  //var mempool_self = this;

  // older - this.bundling_timer = setInterval(function() { mempool_self.tryToBundleBlock(); }, this.bundling_speed);
  // need to ensure we don't get hung up on bundling
  mempool_self.tryToBundleBlock();
}

Mempool.prototype.tryToBundleBlock = function tryToBundleBlock() {

  //check if we have golden ticket from last block?

  //check with monitor that we are ready to bundle block.

  var lastBlockInChain = mempool_self.app.blockchain.returnLastBlockInChain();
  var block_paysplit_vote = mempool_self.app.voter.returnPaysplitVote(lastBlockInChain.block.paysplit);
  var current_burn_fee = returnCurrentBurnFee(latestBlk.burn_fee, latestBlk.creation_time);

  console.log(`${new Date()}: ${latestBurnFee} - ${latestFeesAvailable}`);

  if (current_burn_fee >= this.returnFeesAvailable()) {

    console.log(`${new Date()}: ${latestBurnFee} - ${latestFeesAvailable}`);

    // checks for edge cases around starting and flooding.

    mempool_self.bundleBlock(lastBlockInChain);
  }

}

Mempool.prototype.containsTransaction = function containsTransaction({
  transaction: {
    sig
  }
}) {
  return this.transactions_hash.hasOwnProperty(sig)
}

Mempool.prototype.containsGoldenTicket = function containsGoldenTicket() {
  return "gt" in this.transactions_hash
}

Mempool.prototype.removeTransaction = function removeTransaction({
  transaction: {
    sig
  }
}) {
  index = this.transactions_hash[sig]
  if (index != undefined) {
    this.transactions.splice(index, 1);
    delete this.transactions_hash[sig]
  } else {
    console.log("TX COULDN'T BE FOUND")
  }
}

Mempool.prototype.removeGoldenTicket = function removeGoldenTicket() {
  index = this.transactions_hash.gt
  if (index != undefined) {
    this.transactions.splice(index, 1);
    delete this.transactions_hash.gt
  } else {
    console.log("GT COULDN'T BE FOUND")
  }
}

Mempool.prototype.removeBlock = function removeBlock() {
  return;
}

Mempool.prototype.updateTransactionHash = function updateTransactionHash(field, index) {
  let newHash = {}
  newHash[field] = index;
  this.transactions_hash = Object.assign({}, this.transactions_hash, newHash)
}

Mempool.prototype.addTransaction = function addTransaction(tx, relay_on_validate = true) {
  //
  // avoid adding if there is an obvious problem
  //
  if (tx == null) {
    return;
  }
  if (tx.is_valid == 0) {
    return;
  }
  if (tx.transaction == null) {
    return;
  }
  if (this.containsTransaction(tx) == true) {
    return;
  }

  //
  // only accept one golden ticket
  //
  if (tx.transaction.gt != null) {
    if (gt in this.transactions_hash) {
      var {
        gtx
      } = this.transactions_hash.gt

      if (gtx.gt.target == this.app.blockchain.returnLatestBlockHash()) {

        var txUsableFee = Big(tx.returnFeeUsable())
        var gtUsableFee = Big(gtx.returnFeeUsable())
        var walletPublicKey = this.app.wallet.returnPublicKey();

        if (txUsableFee.gt(gtUsableFee) || gtx.from[0].add != walletPublicKey && tx.from[0].add == walletPublicKey) {
          this.updateTransactionHash("gt", this.transactions.gt.index);
          this.transactions[this.transactions.gt.index] = tx;
        }
      } else {
        this.removeGoldenTicket();
      }
    }
    this.updateTransactionHash("gt", this.transactions.length);
    this.transactions.push(tx)
  } else {
    if (Big(this.bundling_fees_needed).gt(Big(tx.returnFeeUsable()))) {
      this.updateTransactionHash(tx.sig, this.transactions.length);
      this.transactions.push(tx);
    }
  }

}

Mempool.prototype.bundleBlock = function bundleBlock(previousBlock) {
  //
  // creating a block requires DB access for things
  // like figuring out the reclaimed fees. this can
  // cause bad blocks to pile up in the creation process
  // at large data blocks, so we check to make sure
  // we are not already in the process of bundling
  // one before we try again....
  //
  if (this.currently_creating == 1) {
    return;
  }
  this.currently_creating = 1;

  //
  // create the block
  //
  var nb = new saito.block(this.app);
  if (nb == null || nb.is_valid == 0) {
    this.currently_creating = 0;
    return;
  }
  //
  // set the paysplit vote
  //
  nb.block.paysplit_vote = this.app.voter.returnPaysplitVote(previousBlock.block.paysplit);

  //
  // set miner (needed to validate tx fees
  //
  nb.block.miner = this.app.wallet.returnPublicKey();

  //
  // set prevhash -- needed to calculate surplus fees
  //
  if (previousBlock != null) {
    console.log("ADDING PREVHASH: " + previousBlock.returnHash());
    nb.block.prevhash = previousBlock.returnHash();
  }

  mempool_self.adjustBurnFee(this.burnfee, this.blockTime);
  return;
}

Mempool.prototype.returnCurrentBurnFee = function returnCurrentBurnFee(burn_fee, last_block_time) {
  //will get these from elsewhere later
  let unixtime_current = new Date().getTime();
  var elapsed_blocktime = unixtime_current - last_block_time;

  // if we are at twice the desired block time - just make a block
  if (elapsed_blocktime >= desiredBlockTime * 2) {
    return 0;
  } else {
    // line below is the burn fee algorithm - can be updated to anything
    // that depends on the burn fee and desired block time
    // bf = burnfee - (burnfee * (desiredBlockTime / elapsed_blocktime));
    return this.calculateBurnFee(bufn_fee, elapsed_blocktime);
  }
}

Mempool.prototype.calculateBurnFee = function calculateBurnFee(burn_fee, elapsed_blocktime) {
  return burn_fee - (burn_fee * (this.desiredBlockTime / elapsed_blocktime));
}

Mempool.prototype.adjustBurnFee = function(bf, blockTime) {
  // example simple burn fee adjustment algorithm.
  var adjustedbf = Math.sqrt(desiredBlockTime / blockTime) * bf;
  return adjustedbf;
}

Mempool.prototype.returnFeesAvailable = function returnFeesAvailable() {
  let fees_available = Big(mempool_self.returnUsableTransactionFees(block_paysplit_vote));
  if (fees_available.lt(0)) {
    return Big(0);
  }
  return fees_available;
}



Mempool.prototype.returnUsableTransactionFees = function returnUsableTransactionFees(paysplit_vote = 0) {
  var v = Big(0);
  for (let i = 0; i < this.transactions.length; i++) {
    if (paysplit_vote == -1) {
      if (this.transactions[i].transaction.ps <= 0) {
        v = v.plus(Big(this.transactions[i].returnFeeUsableForBlockCreator(this.app, this.app.wallet.returnPublicKey())));
      }
    }
    if (paysplit_vote == 0) {
      v = v.plus(Big(this.transactions[i].returnFeeUsableForBlockCreator(this.app, this.app.wallet.returnPublicKey())));
    }
    if (paysplit_vote == 1) {
      if (this.transactions[i].transaction.ps >= 0) {
        v = v.plus(Big(this.transactions[i].returnFeeUsableForBlockCreator(this.app, this.app.wallet.returnPublicKey())));
      }
    }
  }
  return v.toFixed(8);
}
