'use strict';
const Big = require('big.js')
const saito = require('../saito');
const path = require('path');
const request = require('request');

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
  this.downloads                = [];
  this.transactions             = [];
  this.recovered                = [];
  this.transactions_hmap        = [];  // index is tx.transaction.sig
  this.transactions_inputs_hmap = [];  // index is slip returnIndex()

  this.bundling_fees_needed     = "-1";


  //
  // mempool safety caps
  //
  // temporary safety limits designed to help avoid
  // spam attacks taking down everyone in the network
  // by preventing propagation past a certain point
  //
  this.transaction_size_cap       = 1024000000;// bytes hardcap 1GB
  this.transaction_size_current   = 0.0;
  this.block_size_cap             = 1024000000; // bytes hardcap 1GB
  this.block_size_current         = 0.0;


  this.bundling_active          = false;
  this.bundling_speed           = 1000;
  this.bundling_timer           = null;

  this.processing_active        = false;
  this.processing_speed         = 500;
  this.processing_timer         = null;

  this.downloading_active       = false;
  this.downloading_speed        = 500;
  this.downloading_timer        = null;

  this.clearing_active          = false;

  return this;

}
module.exports = Mempool;



/**
 * given a block hash, fetches that block from the peer that
 * has told us they have it.
 *
 * @params {saito.peer} who told us they have this
 * @params {string} the hash of the new block
 **/
Mempool.prototype.fetchBlock = function fetchBlock(peer, bhash) {

  //
  // avoid dupes
  //
  for (let i = 0; i < this.downloads.length; i++) {
    if (this.downloads[i].bhash == bhash) { return; }
  }
  if (this.app.blockchain.isHashIndexed(bhash) == 1) {
    return;
  }

  //
  // enqueue
  //
  this.downloads.push({ peer : peer , bhash : bhash });

  //
  // start timer
  //
  if (this.downloading_timer == null) {
    this.downloading_timer = setInterval( () => {

      if (this.downloads.length == 0) {
        clearInterval(this.downloading_timer);
        this.downloading_timer = null;
        this.downloading_active = 0;
      }
      if (this.downloading_active == 1) { 
        return;
      }
      this.downloading_active = 1;

      //
      // check we have space
      //
      try {

        if ( this.block_size_current <= this.block_size_cap ) {

          let url_sync_address = "blocks/";
          let url_sync_pkey    = "";
          let block_to_download = this.downloads[0];

          if (block_to_download.peer.peer.synctype == "lite") { 
            url_sync_address   = "lite-blocks/"; 
            url_sync_pkey      = "/" + this.app.wallet.returnPublicKey();
          }

          let block_to_download_url = block_to_download.peer.peer.protocol + "://" +
                                      block_to_download.peer.peer.host + ":" +
                                      block_to_download.peer.peer.port + "/" +
                                      url_sync_address +
                                      block_to_download.bhash +
				      url_sync_pkey;
          //
          // servers
          //
          if (this.app.BROWSER == 0) {

            var requestSettings = {
              url: block_to_download_url,
              method: 'GET',
              timeout: 5000,
              encoding: null
            }
            request(requestSettings, (err, res, body) => {


              this.downloads.splice(0, 1);
              this.downloading_active = 0;

              if (err) { 
		return;
              }

              let blk = new saito.block(this.app, body);

	      if (blk.is_valid == 0) { return; }

              blk.size = body.length;
              blk.peer_publickey = block_to_download.peer.peer.publickey;

              //
              // confirm validity
              //
              if (blk.returnHash() != block_to_download.bhash) { 
		return; 
	      }

              //
              // should we propagate this block (?)
              //
              this.app.network.propagateBlock(blk);
              this.addBlock(blk);
              this.processBlocks();

            });

          //
          // browsers
          //
          } else {

            //
            // AJAX
            //
            $.get(
              block_to_download_url, {
              }, (data) => {
                if (data !== '{}') {
                  var blk = new saito.block(this.app, data);
                  blk.size = data.length;
                  if (blk.returnHash() != block_to_download.bhash) { return; }
                  this.addBlock(blk);
                  this.processBlocks();
                } else {
		  this.app.modules.updateBlockchainSync(block_to_download.bid, this.app.blockchain.returnTargetBlockId());
		}
                this.downloads.splice(0, 1);
                this.downloading_active = 0;
console.log("DOWNLOAD OF: " + block_to_download_url + " completed!");
              }
            );
          }
       } // mempool capacity check
      //
      // in event of error, remove bad block
      //
      } catch (err) {
        this.downloads.splice(0, 1);
        this.downloading_active = 0;
      }
    }, this.downloading_speed);
  }
}



/**
 * Initializes mempool and starts trying to bundle blocks
 */
Mempool.prototype.initialize = function initialize() {
  if (this.app.BROWSER == 1) { return; }
  if (this.app.SPVMODE == 1) { return; }
  try {
    this.bundling_timer = setInterval(() => { this.bundleBlock(); }, this.bundling_speed);
  } catch (err) {
    console.log(err);
  }
}


/**
 * Adds block to Mempool queue
 */
Mempool.prototype.addBlock = function addBlock(blk) {
  if (blk == null) { return false; }
  if (!blk.is_valid) { return false; }

  //
  // confirm this will not cause memory-exhaustion attacks
  //
  if ( (this.block_size_current + blk.size) > this.block_size_cap) { return false; }

  for (let i = 0; i < this.blocks.length; i++) {
    if (this.blocks[i].returnHash() == blk.returnHash()) { return false; }
  }

  this.blocks.push(blk);
  this.block_size_current += blk.size;

}





/**
 * return fees needed to produce a block. used when
 * checking if a new transaction pushes us over the edge
 *
 * @returns {string} bundling_fees_needed
 */
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
    credits = this.returnAvailableFees(vote, prevblk.returnHash());
    console.log(`${new Date()} : ${this.app.burnfee.returnMovingBurnFeeNow(prevblk).toFixed(8)} ---- ${credits} ( ${this.transactions.length} / ${this.containsGoldenTicket()} / ${this.app.wallet.returnBalance() } )`);
  }

  this.bundling_fees_needed = this.app.burnfee.returnMovingBurnFeeNow(prevblk);

  if (Big(this.bundling_fees_needed).lte(Big(credits))) {

    if (
      this.app.network.isPrivateNetwork() ||
      this.transactions.length > 0
      // console.log("TX TYPE", Object.assign({ type: null }, this.transactions[0].transaction).type != 1);
      // this.transactions.some(tx => tx.transaction.type != 1)
    ) {

      if (this.transactions.length == 1) {
        if (!this.app.network.isPrivateNetwork()) {
          if (this.transactions[0].transaction.type == 1) { 
	    this.bundling_active = false;
	    return; 
          }
        }
      }

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
	    // we hit this when we include a solution for a previous 
	    // golden ticket that is not correct. in this case we want
	    // to just quit, and delete this transaction from our 
	    // mempool.
            //
            if (this.transactions[i].transaction.msg.target != prevblk.returnHash()) {
	      this.removeGoldenTicket();
	      this.bundling_active = false;
	      return;
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
            blk.transactions.push(this.transactions[i]);
          } else {
          }
        }


        //
        // add fee-capture transaction
        //
        //
        // we use "Usable Surplus" because we expect all transactions
        // in our mempool to be either path-free (originating from us)
        // or signed and sent to us.
        //

        if (prevblk != null) {

          let total_fees_needed = this.app.burnfee.returnMovingBurnFee(prevblk, (blk.block.ts - prevblk.block.ts));
          let total_fees_available = blk.returnAvailableFees();
          let surplus_fees = Big(total_fees_available).minus(Big(total_fees_needed));

if (surplus_fees.lt(0)) {
 
  console.log("\n\n\nTESTING:\n");
  console.log("SURPLUS FEES ARE LESS THAN ZERO!");
  console.log(total_fees_needed + " -- " + total_fees_available + " -- " + surplus_fees.toFixed(8));
  console.log("PREVIOUS BLOCK", prevblk.block);
  console.log("CURRENT FAILED BLOCK", blk.block);
  process.exit(0);

}

          // add fee surplus
          let tx = new saito.transaction();
          tx.transaction.ts  = new Date().getTime();
          tx.transaction.type = 2;

          // from slips
          tx.transaction.from = [];
          tx.transaction.from.push(new saito.slip(this.app.wallet.returnPublicKey(), 0.0, 2));

          // to slips
          tx.transaction.to.push(new saito.slip(this.app.wallet.returnPublicKey(), surplus_fees.toFixed(8), 2));
          tx = this.app.wallet.signTransaction(tx);
          blk.transactions.push(tx);

        }

        //
        // queue and process
        //
        await blk.bundle(prevblk);

        //
        // propagate our block
        //
        this.app.network.propagateBlock(blk);

        //
        // add it to mempool and process
        //
        this.addBlock(blk);

        await this.processBlocks();

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
Mempool.prototype.processBlocks = async function processBlocks() {

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

  if (this.processing_timer == null) {
    this.processing_timer = setInterval(async () => {
      if (this.app.monitor.canBlockchainAddBlockToBlockchain()) {
console.log("Lengths to process: " + this.blocks.length);
        if (this.blocks.length > 0) {
          await this.app.blockchain.addBlockToBlockchain(this.blocks.shift());
        }
      }	 
      // if we have emptied our queue
      if (this.blocks.length == 0) {
        clearInterval(this.processing_timer);
        this.processing_timer = null;
      }
         this.processing_active = false;
     }, this.processing_speed);

    this.processing_active = false;
    return;

  }
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
Mempool.prototype.returnAvailableFees = function returnAvailableFees(vote=0, prevblk_hash="") {

  var v = Big(0);

  for (let i = 0; i < this.transactions.length; i++) {

    var usable_fees = Big(this.transactions[i].returnFeesUsable(this.app, this.app.wallet.returnPublicKey()));
    
    // verify that the golden ticket is assigned to the right block before calculating
    if (this.transactions[i].transaction.type == 1) {
      if (this.transactions[i].transaction.msg.target != prevblk_hash) { usable_fees = Big(0); }
    }

    switch(vote) {
      case -1:
        if (this.transactions[i].transaction.ps <= 0) {
          v = v.plus(usable_fees);
        }
        break;
      case 1:
        if (this.transactions[i].transaction.ps >= 0) {
          v = v.plus(usable_fees);
        }
        break;
      default:
        v = v.plus(usable_fees);
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
 */
Mempool.prototype.containsTransaction = function containsTransaction(tx) {

  if (tx == null)                  { return 0; }
  if (tx.transaction == null)      { return 0; }
  if (tx.transaction.from == null) { return 0; }

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
 * @param {saito.transaction} transaction to check
 * @returns {boolean} is transaction in mempool?
 */
Mempool.prototype.containsGoldenTicket = function containsGoldenTicket() {
  for (let m = 0; m < this.transactions.length; m++) {
    if (this.transactions[m].isGoldenTicket() == 1) { return 1; }
  }
  return 0;
}



/**
 * add transaction to mempool if provided with tx json
 *
 */
Mempool.prototype.importTransaction = function importTransaction(txjson) {
  var tx = new saito.transaction(txjson);
  if (tx == null) { return; }
  if (tx.is_valid == 0) { return; }
  tx.size = txjson.length;
  this.addTransaction(tx);
}
/**
 * add transaction to mempool if it does not already exist
 *
 */
Mempool.prototype.addTransaction = async function addTransaction(tx, relay_on_validate=0) {

  let transaction_imported = 0;

  //
  // avoid adding if there is an obvious problem
  //
  if (this.containsTransaction(tx) == 1) { return; }
  if (tx == null)                        { return; }
  if (tx.transaction == null)            { return; }
  if (tx.is_valid == 0)                  { return; }

  //
  // do not add if it pushes us past our limit
  //
  if ( (tx.size + this.transaction_size_current) > this.transaction_size_cap) {
    return;
  }

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
            Big(tx.returnFeesUsable(this.app, this.app.wallet.returnPublicKey())).gt(Big(this.transactions[z].returnFeesUsable(this.app, this.app.wallet.returnPublicKey()))) || (
              this.transactions[z].transaction.from[0].add != this.app.wallet.returnPublicKey() &&
              tx.transaction.from[0].add == this.app.wallet.returnPublicKey()
            )
          ) {
            this.removeGoldenTicket();
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
    // sending NULL as the block is used when adding to the mempool
    // the transaction validation function will by default then check
    // only for a transaction that is being added to the mempool, and
    // not for a transaction getting validated as part of a specific
    // block (i.e. vote consistency, etc.)
    //
    if (tx.validate(this.app, null)) {

      //
      // propagate if we can't use tx to create a block
      //
      if ( Big(this.bundling_fees_needed).gt(Big(tx.returnFeesUsable(this.app, this.app.wallet.returnPublicKey()))) ) {

        //
        // add to mempool before propagating
        //
        this.transactions.push(tx);
        this.transactions_size_current += tx.size;
        this.transactions_hmap[tx.transaction.sig] == 1;
        for (let i = 0; i < tx.transaction.from.length; i++) {
          this.transactions_inputs_hmap[tx.transaction.from[i].returnIndex()] = 1;
        }

        if (relay_on_validate == 1) {
          this.app.network.propagateTransaction(tx);
        }
        return;

      } else {

        // propagate if we are a lite-client (not block-producer)
        if (this.app.BROWSER == 1 || this.app.SPVMODE == 1) {
          if (relay_on_validate == 1) {
            this.app.network.propagateTransaction(tx);
          }
        } else {


          //
          // add to mempool before propagating
          //
          this.transactions_size_current += tx.size;
          this.transactions.push(tx);
          this.transactions_hmap[tx.transaction.sig] == 1;
          for (let i = 0; i < tx.transaction.from.length; i++) {
            this.transactions_inputs_hmap[tx.transaction.from[i].returnIndex()] = 1;
          }

        }
      }
    } else {
console.log("totally failed to validate....");
    }
  }
}






/**
 * Remove the block from the mempool
 */
Mempool.prototype.removeBlock = function removeBlock(blk=null) {
  if (blk == null) { return; }
  for (let b = this.blocks.length-1; b >= 0; b--) {
    if (this.blocks[b].returnHash() == blk.returnHash()) {
      this.block_size_current -= this.blocks[b].size;
      this.blocks.splice(b, 1);
    }
  }
}


/**
 * Remove the block and all of its transactions from the mempool
 */
Mempool.prototype.removeBlockAndTransactions = function removeBlockAndTransactions(blk=null) {
  if (blk == null) { return; }
  for (let b = 0; b < blk.transactions.length; b++) {
    this.removeTransaction(blk.transactions[b]);
  }
  this.removeBlock(blk);
}



/**
 * Remove the golden ticket from the mempool
 */
Mempool.prototype.removeGoldenTicket = function removeGoldenTicket() {
  for (let i = this.transactions.length-1; i >= 0; i--) {
    if (this.transactions[i].transaction.type == 1) {
      this.removeTransaction(this.transactions[i]);
      return;
    }
  }
}

/**
 * remove the transaction from the mempool
 *
 * @param {saito.transaction} tx to remove
 */
Mempool.prototype.removeTransaction = function removeTransaction(tx=null) {
  if (tx == null) { return; }

  //
  // remove transactions from queue
  //
  for (let t = this.transactions.length-1; t >= 0; t--) {
    if (this.transactions[t].transaction.sig == tx.transaction.sig) {
      this.transaction_size_current -= this.transactions[t].size;
      this.transactions.splice(t, 1);
    }
  }

  //
  // and delete their UTXO too
  //
  delete this.transactions_hmap[tx.transaction.sig];
  for (let i = 0; i < tx.transaction.from.length; i++) {
    delete this.transactions_inputs_hmap[tx.transaction.from[i].returnIndex()];
  }

}


/**
 * when the chain is reorganized, any nodes that created
 * transactions on the outdated chain will look to see what
 * transactions are still valid and add them to their mempool
 * this provides some continuity over reorgs.
 *
 * @param {saito.transaction} tx
 */
Mempool.prototype.recoverTransaction = function recoverTransaction(tx) {

  if (tx == null) { return; }
  if (tx.is_valid == 0) { return; }
  this.recovered.push(tx);

}


/**
 * when the chain is reorganized, any nodes that created
 * transactions on the outdated chain will look to see what
 * transactions are still valid and add them to their mempool
 * this provides some continuity over reorgs.
 */
Mempool.prototype.reinsertRecoveredTransactions = function reinsertRecoveredTransactions() {

  if (this.recovered.length == 0) { return; }

  //
  // loop through recovered, getting txs
  //
  while (this.recovered.length > 0) {
    var tx2insert = this.recovered[0];
    this.recovered.splice(0, 1);
    if (tx2insert.transaction.type == 0) {
      this.addTransaction(tx2insert, 0);
    }
  }

  //
  // should already be empty
  //
  this.recovered = [];

}

// https://www.youtube.com/watch?v=2k0SmqbBIpQ
Mempool.prototype.stop = function stop() {
 clearInterval(this.bundling_timer);
}

