'use strict';
const Big = require('big.js')
const saito = require('../saito');
const path = require('path');

/**
 * Mempool Constructor
 * @param {*} app
 */
function Mempool(app) {

  if (!(this instanceof Mempool)) {
    return new Mempool(app);
  }

  this.app                      = app || {};

  this.directory                = path.join(__dirname, '../data/');
  this.blocks                   = [];
  this.transactions             = [];
  this.transactions_hmap        = [];
  this.transactions_inputs_hmap = [];

  this.bundling_fees_needed     = "-1";

  this.bundling_active          = false;
  this.bundling_speed           = 1000;
  this.bundling_timer           = null;

  this.processing_active        = false;
  this.processing_speed         = 500;
  this.processing_timer         = null;

  this.clearing_active          = false;

  return this;

}
module.exports = Mempool;


/**
 * Initializes mempool and starts trying to bundle blocks
 */
Mempool.prototype.initialize = function initialize() {
  if (this.app.BROWSER == 1) { return; }
  if (this.app.SPVMODE == 1) { return; }
  this.bundling_timer = setInterval(() => { this.bundleBlock(); }, this.bundling_speed);
}


/**
 * Adds block to Mempool queue
 */
Mempool.prototype.addBlock = function addBlock(blk) {
  if (blk == null) { return false; }
  if (!blk.is_valid) { return false; }

  for (let i = 0; i < this.blocks.length; i++) {
    if (this.blocks[i].returnHash() == blk.returnHash()) { return false; }
  }

  this.blocks.push(blk);

}





/**
 * return fees needed to produce a block. used when
 * checking if a new transaction pushes us over the edge
 *
 * @returns {string} bundling_fees_needed
 **/
Mempool.prototype.returnBundlingFeesNeeded = function returnBundlingFeesNeeded() {
  return this.bundling_fees_needed;
}


/**
 * Starts bundling block if there is enough available funds and if bundling_active is false
 */
Mempool.prototype.bundleBlock = async function bundleBlock() {

  // ensure not bundling
  if (this.app.monitor.canMempoolBundleBlock() == false) { return; }
  this.bundling_active = true;

  let prevblk = this.app.blockchain.returnLatestBlock();
  let vote    = 0;
  let credits = "0.0";


  if (prevblk != null) {
    vote = this.app.voter.returnPaysplitVote(prevblk.block.paysplit);
    credits = this.returnAvailableFees(vote);
    console.log(`${new Date()} : ${this.app.burnfee.returnBurnFeeNeeded(prevblk, ((new Date().getTime()) - prevblk.block.ts)).toFixed(8)} ---- ${credits} ( ${this.transactions.length} / ${this.containsGoldenTicket()} )`);
  }

  this.bundling_fees_needed = this.app.burnfee.returnBurnFeeNeededNow(prevblk);

  if (Big(this.bundling_fees_needed).lte(Big(credits))) {

    if (
      this.app.network.isPrivateNetwork() ||
      this.transactions.length > 0
    ) {

      try {

        //
        // create block
        //
        var blk = new saito.block(this.app);
        blk.block.creator = this.app.wallet.returnPublicKey();
        if (prevblk != null) { 
          blk.block.prevhash = prevblk.returnHash(); 
          blk.block.vote = this.app.voter.returnPaysplitVote(prevblk.block.paysplit);
        }

        //
        // add mempool transactions
        //
        for (let i = 0; i < this.transactions.length; i++) {
          let addtx = 1;
          if (this.transactions[i].transaction.type == 1) {

            //
            // this will happen if we run into a Golden Ticket for an older
            // block. we do not want to include this as it will make our
            // block invalid.
            //
            // this GT will be removed from our mempool automatically the
            // next time we receive a golden ticket from someone else.
            //
            if (this.transactions[i].transaction.msg.target != prevblk.returnHash()) {
              addtx = 0;
            }
          }
          if (blk.block.vote == -1) {
            if (this.transactions[i].transaction.ps == 1) {
              addtx = 0;
           }
          }
          if (blk.block.vote == 1) {
            if (this.transactions[i].transaction.ps == -1) {
              addtx = 0;
            }
          }
          if (addtx == 1) {
            blk.block.txsjson.push(JSON.stringify(this.transactions[i]));
            blk.transactions.push(this.transactions[i]);
          } else {
	  }
        }

        //
        // queue and process
        //
        blk.bundle(prevblk);
        this.addBlock(blk);
        this.processBlocks();

      } catch(err) {
        console.log("ERROR: bundling block together: " + err);
      }

    }
  }

  // reset for next loop
  this.bundling_active = false;

}


/**
 * Attempts to process blocks and add them to blockchain
 */
Mempool.prototype.processBlocks = function processBlocks() {

  if (this.processing_active) {
    console.log("Mempool processing.... not adding new block to blockchain");
    return;
  }

  if (this.blocks.length == 0) {
    console.log("Mempool processing.... no blocks to add to blockchain");
    this.processing_active = false;
    return;
  }

  this.processing_active = true;

  // with async/await do we need this timer?
  if (this.processing_timer == null) {
    this.processing_timer = setInterval(() => {

      //
      // implicit check of blk in queue
      //
      if (this.app.monitor.canBlockchainAddBlockToBlockchain()) {
        if (this.blocks.length > 0) {
          this.app.blockchain.addBlockToBlockchain(this.blocks.shift());
        }
      }

      //
      // clear timer when done
      //
      if (this.blocks.length == 0) {
        clearInterval(this.processing_timer);
        this.processing_timer = null;
      }
    }, this.processing_speed);
  }

  this.processing_active = false;
}



/**
 * Returns the "usable value" of the transaction fees in the mempool
 * that can be used to produce a block with a given paysplit vote
 *
 * Note the submission of our own wallet publickey into the transaction
 * class' returnFeesUsable function. This is unnecessary since the default
 * behavior of the function is to examine the transaction from our own
 * perspective. When the same function is called to verify the fees for
 * a block the creator publickey should be called.
 *
 * @param {vote} paysplit vote
 * @returns {string} credits available
 */
Mempool.prototype.returnAvailableFees = function returnAvailableFees(vote=0) {

  var v = Big(0);
  for (let i = 0; i < this.transactions.length; i++) {
    switch(vote) {
      case -1:
        if (this.transactions[i].transaction.ps <= 0) {
          v = v.plus(Big(this.transactions[i].returnFeesUsable(this.app, this.app.wallet.returnPublicKey())));
        }
        break;
      case 1:
        if (this.transactions[i].transaction.ps >= 0) {
          v = v.plus(Big(this.transactions[i].returnFeesUsable(this.app, this.app.wallet.returnPublicKey())));
        }
        break;
      default:
        v = v.plus(Big(this.transactions[i].returnFeesUsable(this.app, this.app.wallet.returnPublicKey())));
        break;
    }
  }
  return v.toFixed(8);
}




/**
 * return 1 if mempool already contains this transaction or a transaction
 * with any UTXO inputs contained in this transaction.
 *
 * @params {saito.transaction} transaction to check
 * @returns {boolean} is transaction in mempool?
 **/
Mempool.prototype.containsTransaction = function containsTransaction(tx) {

  if (tx == null)             { return 0; }
  if (tx.transaction == null) { return 0; }

  if (this.transactions_hmap[tx.transaction.sig] == 1) { return 1; }
  for (let i = 0; i < tx.transaction.from.length; i++) {
    if (this.transactions_inputs_hmap[tx.transaction.from[i].returnIndex()] == 1) {
      return 1;
    }
  }

  return 0;

}



/**
 *
 * return 1 if mempool already contains a Golden Ticket
 *
 * @params {saito.transaction} transaction to check
 * @returns {boolean} is transaction in mempool?
 **/
Mempool.prototype.containsGoldenTicket = function containsGoldenTicket() {
  for (let m = 0; m < this.transactions.length; m++) {
    if (this.transactions[m].isGoldenTicket() == 1) { return 1; }
  }
  return 0;
}





/**
 * add transaction to mempool if it does not already exist
 *
 **/
Mempool.prototype.addTransaction = function addTransaction(tx) {

  let transaction_imported = 0;

  //
  // avoid adding if there is an obvious problem
  //
  if (this.containsTransaction(tx) == 1) { return; }
  if (tx == null)                        { return; }
  if (tx.transaction == null)            { return; }
  if (tx.is_valid == 0)                  { return; }

  //
  // TODO: do not add if this pushes us past our limit
  //

  //
  // only accept one golden ticket
  //
  if (tx.isGoldenTicket()) {
    for (let z = 0; z < this.transactions.length; z++) {
      if (this.transactions[z].isGoldenTicket()) {
        //
        // ensure golden ticket is for the latest block
        //
        if (this.transactions[z].transaction.msg.target == this.app.blockchain.returnLatestBlockHash()) {
          //
          // if we already have a golden ticket solution, we will
          // replace it with this new one if the new one pays us
          // more in fees and/or is going to pay us money.
          //
          if (
            Big(tx.returnFeesUsable()).gt(Big(this.transactions[z].returnFeesUsable())) || (
              this.transactions[z].transaction.from[0].add != this.app.wallet.returnPublicKey() &&
              tx.transaction.from[0].add == this.app.wallet.returnPublicKey()
            )
          ) {
            this.transactions[z] = tx;
            transaction_imported = 1;
            z = this.transactions.length+1;
          } else {
            transaction_imported = 1;
          }
        } else {
          this.removeGoldenTicket();
        }
      }
    }
  }

  if (transaction_imported == 0) {

    // 
    // VALIDATE THE TXS AS WE IMPORT THEM
    //
    if (1) {

      //
      // propagate if we can't use tx to create a block
      //
      if ( Big(this.bundling_fees_needed).gt(Big(tx.returnFeesUsable())) ) {

        //
        // add to mempool before propagating
        //
        this.transactions.push(tx);
        this.transactions_hmap[tx.transaction.sig] == 1;
        for (let i = 0; i < tx.transaction.from.length; i++) {
          this.transactions_inputs_hmap[tx.transaction.from[i].returnIndex()] = 1;
        }

        this.app.network.propagateTransaction(tx);
        return;

      } else {

        // propagate if we are a lite-client (not block-producer)
        if (app.BROWSER == 1 || app.SPVMODE == 1) {
          this.app.network.propagateTransaction(tx);
        } else {

          //
          // add to mempool before propagating
          //
          this.transactions.push(tx);
          this.transactions_hmap[tx.transaction.sig] == 1;
          for (let i = 0; i < tx.transaction.from.length; i++) {
            this.transactions_inputs_hmap[tx.transaction.from[i].returnIndex()] = 1;
          }
        }
      }
    }
  }
}






/**
 * Remove the block from the mempool
 **/
Mempool.prototype.removeBlock = function removeBlock(blk=null) {
  if (blk == null) { return; }
  for (let b = this.blocks.length-1; b >= 0; b--) {
    if (this.blocks[b].returnHash() == blk.returnHash()) {
      this.blocks.splice(b, 1);
    }
  }
}


/**
 * Remove the block and all of its transactions from the mempool
 **/
Mempool.prototype.removeBlockAndTransactions = function removeBlockAndTransactions(blk=null) {
  if (blk == null) { return; }
  for (let b = 0; b < blk.transactions.length; b++) {
    this.removeTransaction(blk.transactions[b]);
  }
  this.removeBlock(blk);
}



/**
 * Remove the golden ticket from the mempool
 **/
Mempool.prototype.removeGoldenTicket = function removeGoldenTicket() {
  for (let i = this.transactions.length-1; i >= 0; i--) {
    if (this.transactions[i].transaction.type == 1) {
      this.removeTransaction(this.transactions[i]);
      return;
    }
  }
}

/*
 * remove the transaction from the mempool
 *
 * @params {saito.transaction} tx to remove 
 **/
Mempool.prototype.removeTransaction = function removeTransaction(tx=null) {
  if (tx == null) { return; }
  for (let t = this.transactions.length-1; t >= 0; t--) {
    if (this.transactions[t].transaction.sig == tx.transaction.sig) {
      this.transactions.splice(t, 1);
    }
  }

  delete this.transactions_hmap[tx.transaction.sig];
  for (let i = 0; i < tx.transaction.from.length; i++) {
    delete this.transactions_inputs_hmap[tx.transaction.from[i].returnIndex()];
  }

}






