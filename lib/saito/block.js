'use strict';

const saito    = require('../saito');
const Big = require('big.js');
const Promise = require('bluebird');
//const BloomFilter = require('bloom-filter');

/**
 * Block Constructor
 * @param {*} app
 * @param {string} blkjson
 * @param {int} conf
 */
function Block(app, blkjson="", confirmations=-1) {

  if (!(this instanceof Block)) {
    return new Block(app, blkjson, confirmations=-1);
  }

  this.app = app || {};

  /////////////////////////
  // consensus variables //
  /////////////////////////
  this.block                  = {};
  this.block.ts               = new Date().getTime();
  this.block.prevhash         = "";
  this.block.merkle           = "";
  this.block.creator          = "";
  this.block.id               = 1;
  this.block.txsjson          = [];
  this.block.bf               = {};    // burn fee object
  this.block.difficulty       = 0.51;
  this.block.paysplit         = 0.5;
  this.block.treasury         = Big("10000000000.0");
  this.block.coinbase         = Big("0.0");
  this.block.reclaimed        = Big("0.0");
  this.block.vote             = 0;     // paysplit vote
                                       // -1 reduce miner payout
                                       //  0 no change
                                       //  1 increase miner payout
  this.maxtid                 = 0;
  this.mintid                 = 0;

  this.confirmations          = confirmations;
  this.is_valid 	      = 1;           // set to zero if there is an
                                             // error importing the blkjson
  this.size                   = 0;           // size of block in bytes
  this.hash                   = "";          // block hash (bhash)
  this.prehash                = "";          // hash of signature source that combines
                                             // with this.prevhash to create this.hash

  this.peer_publickey         = "";	     // publickey of peer that gave me this block
  this.save_bid               = -1;
  this.save_db_id             = -1;
  this.filename               = "";    	// name of file on disk if set
  this.prevalidated           = 0;
  this.ghost                  = 0;     	// 0 = normal block
					// 1 = ghost added via addHashToBlockchain
					//     via "lite-client" blockchain sync.

  this.callbacks              = [];
  this.callbacksTx            = [];



  this.contains_golden_ticket = -1;

  this.transactions           = [];

  //
  // bloom filter
  //
  // 75,000 elements with 0.00001 false positive rate
  //
  this.transactions_bloom     = null;
  this.transactions_bloom_n   = 100;
  this.transactions_bloom_err = 0.01;
  this.transactions_bloom_hmap = [];

  if (blkjson != "") {
    try {
      this.block = JSON.parse(blkjson.toString("utf8"));
      for (var i = 0; i < this.block.txsjson.length; i++) {
        this.transactions[i] = new saito.transaction(this.block.txsjson[i]);
        if (!this.transactions[i].is_valid) {
          this.is_valid = 0;
          return;
        }
      }
    } catch (err) {
      this.app.logger.logError("Error thrown in Block constructor", err);
      this.is_valid = 0;
      return;
    }
  }


  /////////////////
  // min/max ids //
  /////////////////
  if (this.transactions.length > 0) {

    if (this.transactions.length > 0) {
      this.mintid = this.transactions[0].transaction.id;
      this.maxtid = this.transactions[this.transactions.length-1].transaction.id;
    }

    ///////////////////////////
    // populate bloom filter //
    ///////////////////////////
    //
    if (this.app.BROWSER == 0) {

      this.transactions_bloom_hmap = [];
      for (let i = 0; i < this.transactions.length; i++) {
        for (let ii = 0; ii < this.transactions[i].transaction.from.length; ii++) {
          this.transactions_bloom_hmap[this.transactions[i].transaction.from[ii].add] = 1;
        }   
        for (let ii = 0; ii < this.transactions[i].transaction.to.length; ii++) {
          this.transactions_bloom_hmap[this.transactions[i].transaction.to[ii].add] = 1;
        }   
      }

//
// Because of memory issues in the bloom filter module, we are temporarily replacing
// our bloom filter with a hashmap that serves the same purpose. we will look at re-
// implementing a bloom filter when we have time to look at a more robust solution.
//
//      this.transactions_bloom = BloomFilter.create(this.transactions_bloom_n, this.transactions_bloom_err);
//      for (let i = 0; i < this.transactions.length; i++) {
//        for (let ii = 0; ii < this.transactions[i].transaction.from.length; ii++) {
//          this.transactions_bloom.insert(new Buffer(this.transactions[i].transaction.from[ii].add, 'utf8'));
//        }   
//        for (let ii = 0; ii < this.transactions[i].transaction.to.length; ii++) {
//          this.transactions_bloom.insert(new Buffer(this.transactions[i].transaction.to[ii].add, 'utf8'));
//        }   
//      }

    }
  }


  return this;

}
module.exports = Block;


/**
 * check bloom filter for transactions to this address
 **/
Block.prototype.hasKeylistTransactionsInBloomFilter = function hasKeylistTransactionsInBloomFilter(keylist) {
  for (let i = 0; i < keylist.length; i++) {
    if (this.transactions_bloom_hmap[keylist[i]] == 1) { return true; }
  }
  return false;

//  if (this.transactions_bloom == null) { return false; }
//  for (let i = 0; i < keylist.length; i++) {
//    if (this.transactions_bloom.contains(new Buffer(keylist[i], 'utf8')) != false) {
//      return true;
//    }
//  }
  return false;
}

/**
 * check bloom filter for transactions to this address
 **/
Block.prototype.hasTransactionsInBloomFilter = function hasTransactionsInBloomFilter(add) {
  if (this.transactions_bloom_hmap[add] == 1) { return true; }
  return false;

//  if (this.transactions_bloom == null) { return false; }
//  return this.transactions_bloom.contains(new Buffer(add, 'utf8'));
}



/**
 * decrypt transactions
 **/
Block.prototype.decryptTransactions = function decryptTransactions() {
  for (let i = 0; i < this.transactions.length; i++) {
    if (this.transactions[i].involvesPublicKey(this.app.wallet.returnPublicKey()) == 1) {
      this.transactions[i].decryptMessage(this.app);
    }
  }
}


/*
 * add callbacks into the appropriate array
 */
Block.prototype.affixCallbacks = function affixCallbacks() {
  for (let z = 0; z < this.transactions.length; z++) {
    var txmsg = this.transactions[z].returnMessage();
    this.app.modules.affixCallbacks(z, txmsg, this.callbacks, this.callbacksTx, this.app);
  }
}


/**
 * Returns the hash
 */
Block.prototype.returnDifficulty = function returnDifficulty() {
  return this.block.difficulty;
}

Block.prototype.returnTreasury = function returnTreasury() {
  return this.block.treasury;
}

Block.prototype.returnReclaimed = function returnReclaimed() {
  return this.block.reclaimed;
}

Block.prototype.returnCoinbase = function returnCoinbase() {
  return this.block.coinbase;
}

Block.prototype.returnPaysplit = function returnPaysplit() {
  return this.block.paysplit;
}

/**
 * Returns the hash
 */
Block.prototype.returnHash = function returnHash() {
  if (this.hash != "") { return this.hash; }

  //
  // having a pre-hash allows us to send lite-clients a shorter
  // proof-of-chain on connection. no need to send the full
  // block headers.
  //
  this.prehash = this.app.crypto.hash( this.returnSignatureSource() );
  this.hash = this.app.crypto.hash( this.prehash + this.block.prevhash );
  return this.hash;
}

/**
 * Returns the start burn fee value
 *
 * TODO: this should return the value that was actually PAID
 * for the block, instead of the STARTING burn fee, because
 * with things this way, we may screw up the logic of using
 * the burn fee to measure money paid in various rewrite attack
 * scenarios.
 */
Block.prototype.returnBurnFeeValue = function returnBurnFeeValue() {
  return this.block.bf.current;
}

/**
 * Returns a signature created from the sum of the blocks data
 */
Block.prototype.returnSignatureSource = function returnSignatureSource() {

  return this.block.ts
        + this.block.creator
        + this.block.merkle
        + this.block.id
        + JSON.stringify(this.block.bf)
        + this.block.difficulty
        + this.block.paysplit
        + this.block.treasury
        + this.block.coinbase
        + this.block.vote
        + this.block.reclaimed;

};

/**
 * Return block id
 *
 * @returns {integer} block_id
 */
Block.prototype.returnId = function returnId() {
  return this.block.id;
}


Block.prototype.updateConfirmationNumberWithoutCallbacks = function updateConfirmationNumberWithoutCallbacks(confnum) {
  if (confnum > this.confirmations) {this.confirmations = confnum; }
}


/**
 * Returns the max transaction ID
 */
Block.prototype.returnMaxTxId = function returnMaxTxId() {
  if (this.maxtid != 0) { return this.maxtid; }

  var mti = 0;
  for (var z = 0; z < this.transactions.length; z++) {
    if (this.transactions[z].transaction.id > mti) {
      mti = this.transactions[z].transaction.id;
    }
  }

  this.maxtid = mti;
  return this.maxtid;
}

/**
 * Returns the min transaction ID
 */
Block.prototype.returnMinTxId = function returnMinTxId() {
  if (this.mintid != 0) { return this.mintid; }
  if (this.transactions.length == 0) {
    return this.app.blockchain.returnMinTxId();
  };
  var mti = this.transactions[0].transaction.id;
  for (var z = 1; z < this.transactions.length; z++) {
    if (this.transactions[z].transaction.id < mti) {
      mti = this.transactions[z].transaction.id;
    }
  }

  this.mintid = mti;
  return this.mintid;
}

/**
 * Returns if the block contains a golden ticket
 */
Block.prototype.containsGoldenTicket = function containsGoldenTicket() {
  if (this.contains_golden_ticket != -1) { return this.contains_golden_ticket; }

  for (let i = 0; i < this.transactions.length; i++) {
    if (this.transactions[i].isGoldenTicket() == 1) {
      this.contains_golden_ticket = 1;
      return 1;
    }
  }

  this.contains_golden_ticket = 0;
  return 0;

}


/**
 * Bundles a block by calculating the burn fee and reclaiming funds
 * @param {saito.block} prevblk
 */
Block.prototype.bundle = async function bundle(prevblk=null) {

  //
  // set default values
  //
  if (prevblk != null) {

    this.block.id         = prevblk.block.id + 1;
    this.block.treasury   = Big(prevblk.block.treasury).plus(Big(prevblk.block.reclaimed));
    this.block.coinbase   = Big(this.block.treasury).div(this.app.blockchain.genesis_period).toFixed(8);
    this.block.treasury   = this.block.treasury.minus(Big(this.block.coinbase)).toFixed(8);
    this.block.prevhash   = prevblk.returnHash();
    this.block.difficulty = prevblk.block.difficulty;
    this.block.paysplit   = prevblk.block.paysplit;

  }

  //
  // update burn fee
  //
  this.block.bf = this.app.burnfee.adjustBurnFee(prevblk, this);
  if (this.block.bf == null) { this.block.bf = {}; }

  //
  // this calculates the amount of tokens that
  // are unspent and cannot be rebroadcast in
  // the block that will fall off the chain when
  // we add this to the head of the chain.
  //
  // reclaimed = how many tokens to add to our
  // treasury (next block) because they will disappear
  // (when we add this block).
  //
  let reclaimed = await this.calculateReclaimedFunds();
  this.block.reclaimed = reclaimed.reclaimed;


  //
  // automatic transaction rebroadcasting
  //
  let rebroadcast_txarray = await this.calculateRebroadcastTransactions();
  for (let i = 0; i < rebroadcast_txarray.length; i++) {
    this.transactions.push(rebroadcast_txarray[i]);
  }


  //
  // sequential ids and stringify
  //
  let starting_id = 1;
  if (prevblk != null) { starting_id = prevblk.returnMaxTxId()+1; }
  for (let i = 0; i < this.transactions.length; i++) {
    this.transactions[i].transaction.id = (starting_id + i);
    this.block.txsjson.push(JSON.stringify(this.transactions[i]));
  }


  //
  // add tx merkle root
  //
  if (this.block.txsjson.length > 0) {
    this.block.txsjson.sort();
    this.block.merkle = this.app.crypto.returnMerkleTree(this.block.txsjson).root;
  }


  //
  // update difficulty and paysplit if golden ticket exists
  //
  if (prevblk != null) {
    for (let i = 0; i < this.transactions.length; i++) {
      if (this.transactions[i].isGoldenTicket() == 1) {
        let golden = new saito.goldenticket(this.app, JSON.stringify(this.transactions[i].transaction.msg));
	this.block.difficulty = golden.calculateDifficulty(prevblk);
	this.block.paysplit = golden.calculatePaysplit(prevblk);
      }
    }
  }


  //
  // bloom filters
  //
  this.transactions_bloom_hmap = [];
  for (let i = 0; i < this.transactions.length; i++) {
    for (let ii = 0; ii < this.transactions[i].transaction.from.length; ii++) {
      this.transactions_bloom_hmap[this.transactions[i].transaction.from[ii].add] = 1;
    }   
    for (let ii = 0; ii < this.transactions[i].transaction.to.length; ii++) {
      this.transactions_bloom_hmap[this.transactions[i].transaction.to[ii].add] = 1;
    }   
  }

//
// temporary response to memory issues with BloomFilter class - we are replacing
// with a hashmap and can return to the bloom filter once we have a more robust
// solution that will not crash a long-running server.
//
//  this.transactions_bloom = BloomFilter.create(this.transactions_bloom_n,  this.transactions_bloom_err);
//  for (let i = 0; i < this.transactions.length; i++) {
//    for (let ii = 0; ii < this.transactions[i].transaction.from.length; ii++) {
//      this.transactions_bloom.insert(new Buffer(this.transactions[i].transaction.from[ii].add, 'utf8'));
//    }
//    for (let ii = 0; ii < this.transactions[i].transaction.to.length; ii++) {
//      this.transactions_bloom.insert(new Buffer(this.transactions[i].transaction.to[ii].add, 'utf8'));
//    }
//  }


  // and let us know
  return true;

}


/**
 * Returns an array of transactions with input slips that need to be rebroadcast.
 */
Block.prototype.calculateRebroadcastTransactions = async function calculateRebroadcastTransactions() {

  let txarray = [];

  if (this.app.BROWSER == 1 || this.app.SPVMODE == 1) { return []; }

  var eliminated_block_id = this.returnId() - this.app.blockchain.returnGenesisPeriod() - 1;
  var goldenticket_block_id = eliminated_block_id+1;
  //
  // if no blocks to eliminate, return 0.0 and confirm valid
  //
  if (eliminated_block_id < 1) { return []; }

  //
  // otherwise, load the relevant blocks
  //
  var eblk = await this.app.storage.loadSingleBlockFromDiskById(eliminated_block_id);
  var gblk = await this.app.storage.loadSingleBlockFromDiskById(goldenticket_block_id);

  var unspent_amt = Big(0.0);

console.log("Generating Rebroadcast TXs 1 -- checking!");

  for (var i = 0; i < eblk.transactions.length; i++) {

    //
    // the TO slips are the ones that may or may
    // not have been spent, so we check to see if
    // they are spent using our hashmap.
    //
    for (var ii = 0; ii < eblk.transactions[i].transaction.to.length; ii++) {

      var slip   = eblk.transactions[i].transaction.to[ii];
      slip.bid   = eblk.returnId();
      slip.tid   = eblk.transactions[i].transaction.id;
      slip.bhash = eblk.returnHash();
      slip.sid   = ii;

      if (Big(slip.amt).gt(0)) {

        //
        // if the tx has NOT been spent
        //
        if (this.app.storage.validateTransactionInput(slip, this.block.id)) {
          if (eblk.transactions[i].isAutomaticallyRebroadcast(eblk, this, ii)) {

            //
            // create a transaction to rebroadcast this slip
            //
	    // 2 = average fee in block
	    //
	    // TODO -- make this the actual average fee in the block
	    //
	    // we submit transaction_id as well as block_id, since we only
	    // filter to reject txs based on block id, but we need a unique
	    // tx id in all of the slips in order for them to count as unique
	    // when avoiding duplicates. Since no TX IDs + SLIP IDs will be 
	    // repeated, we just use our original data.
	    //
            var newtx = eblk.transactions[i].generateRebroadcastTransaction(slip.tid, slip.sid, 2);
            if (newtx == null) {
              console.log("ERROR GENERATING REBROADCAST TX: null tx returned");
	      process.exit(1);
              return [];
            }

	    //
            // update newtx with bid
            //
	    for (let iii = 0; iii < newtx.transaction.from.length; iii++) {
              newtx.transaction.from[iii].bid = this.block.id;
            }

            txarray.push(newtx);

	  }
        }
      }
    }
  }

  return txarray;
}




/**
 * validates that the rebroadcast txs in the block are OK
 */
Block.prototype.validateRebroadcastTransactions = async function validateRebroadcastTransactions() {

  if (this.app.BROWSER == 1 || this.app.SPVMODE == 1) { return true; }

  let needs_rebroadcast = 0;
  let total_rebroadcast = 0;

  var eliminated_block_id = this.returnId() - this.app.blockchain.returnGenesisPeriod() - 1;
  var goldenticket_block_id = eliminated_block_id+1;

  //
  // if no blocks to eliminate, return 0.0 and confirm valid
  //
  if (eliminated_block_id < 1) { return true; }

  //
  // otherwise, load the relevant blocks
  //
  var eblk = await this.app.storage.loadSingleBlockFromDiskById(eliminated_block_id);
  var gblk = await this.app.storage.loadSingleBlockFromDiskById(goldenticket_block_id);

  var unspent_amt = Big(0.0);

  for (var i = 0; i < eblk.transactions.length; i++) {

    //
    // the TO slips are the ones that may or may
    // not have been spent, so we check to see if
    // they are spent using our hashmap.
    //
    for (var ii = 0; ii < eblk.transactions[i].transaction.to.length; ii++) {

      var slip   = eblk.transactions[i].transaction.to[ii];
      slip.bid   = eblk.returnId();
      slip.tid   = eblk.transactions[i].transaction.id;
      slip.bhash = eblk.returnHash();
      slip.sid   = ii;

      if (Big(slip.amt).gt(0)) {
        if (this.app.storage.validateTransactionInput(slip, this.block.id)) {
          if (eblk.transactions[i].isAutomaticallyRebroadcast(eblk, this, ii)) {

	    needs_rebroadcast++;
	    let is_tx_in_block = 0;

            for (let v = 0; v < this.transactions.length; v++) {
              if (this.transactions[v].transaction.sig == eblk.transactions[i].transaction.sig) {
                is_tx_in_block = 1;
	        v = this.transactions.length+1;
              }
            }

	    //
            // we have an eligible tx that has not
	    // been rebroadcast! this constitutes
	    // an attack
	    //
  	    if (is_tx_in_block == 0) {
console.log("CANNOT FIND TX IN BLOCK!");
	      return false;
	    }

	  }
        }
      }
    }
  }


  /////////////////////////////
  // check total rebroadcast //
  /////////////////////////////
  for (let v = 0; v < this.transactions.length; v++) {
    if (this.transactions[v].transaction.type >= 3) {

      //
      // all rebroadcast txs that are new
      // should have an empty message field
      //
      // if someone manually screws with this 
      // they will just trigger a block that 
      // will not be accepted by the network and
      // included in the longest chain.
      //
      if (this.transactions[v].transaction.msg.tx != undefined) {
        total_rebroadcast++;
      }

    }
  }


  if (total_rebroadcast != needs_rebroadcast) {
    console.log("Validation Error: unmatched rebroadcast transactions: " + total_rebroadcast + " - " + needs_rebroadcast);
    return false;
  } else {
    console.log("Validation OK: matched rebroadcast transactions: " + total_rebroadcast + " - " + needs_rebroadcast);
  }

  return true;
}





/**
 * Returns reclaimed funds and a validation boolean
 * @returns {Promise} reclaimed
 */
Block.prototype.calculateReclaimedFunds = async function calculateReclaimedFunds() {

  if (this.app.BROWSER == 1 || this.app.SPVMODE == 1) { return {reclaimed: "0.0", validates: true}; }

  var eliminated_block_id = this.returnId() - this.app.blockchain.returnGenesisPeriod() - 1;
  var goldenticket_block_id = eliminated_block_id + 1;;

    //
    // if no blocks to eliminate, return 0.0 and confirm valid
    //
    if (eliminated_block_id < 1) { return { reclaimed: "0.0", validates: true}; }

    //
    // otherwise, lets load the relevant blocks
    //
    var eblk = await this.app.storage.loadSingleBlockFromDiskById(eliminated_block_id);
    var gblk = await this.app.storage.loadSingleBlockFromDiskById(goldenticket_block_id);

    var unspent_amt = Big(0.0);

    //
    // loop through the transactions in this block, and check
    // which ones of them need to be checked to see if they have
    // been unspent. If these transactions are UNSPENT and do not
    // need to be rebroadcast, add their value to our unspent_amt
    //
    for (var i = 0; i < eblk.transactions.length; i++) {
      for (var j = 0; j < eblk.transactions[i].transaction.to.length; j++) {

        var slip       = eblk.transactions[i].transaction.to[j];
            slip.bid   = eblk.returnId();
            slip.tid   = eblk.transactions[i].transaction.id;
            slip.sid   = j;
            slip.bhash = eblk.returnHash();

        if (Big(slip.amt).gt(0)) {

          //
          // if the tx has NOT been spent
          //
          if (this.app.storage.validateTransactionInput(slip, this.block.id)) {

            if (eblk.transactions[i].isAutomaticallyRebroadcast(eblk, this, j)) {

            } else {

	      /////////////////////
              // slip is unspent //
              /////////////////////
              unspent_amt = unspent_amt.plus(Big(slip.amt));

	    }
          }
        }
      }
    }

    //
    // we have added up the unspent TX slips, now we
    // need to figure out if we need to reclain the
    // golden ticket coinbase
    //
    if (gblk.containsGoldenTicket() == 0) {
      unspent_amt = unspent_amt.plus(Big(eblk.block.coinbase));
      if (eblk.block.bf.current != undefined) {

	//
	// burn fee paid reclaimed in addition to coinbase
	//
        unspent_amt = unspent_amt.plus(Big(eblk.block.bf.current));
      }
    }

    return { reclaimed: unspent_amt.toFixed(8), validates: true };

}


/**
 * Validates block by checking transactions, merkle, and golden ticket
 *
 * the default value "already_saved_to_disk" is submitted as 0 if we 
 * are newblock on chain reorganization and validate as part or unwinding
 * and winding, as in this case the latest block is not yet written to 
 * disk.
 */
Block.prototype.validate = async function validate() {


  //
  // fetch prev block
  //
  if (this.block.prevhash == "") { return 1; }
  var prevblk = await this.app.blockchain.returnBlockByHash(this.block.prevhash);
  if (prevblk == null) { return 1; }


  //
  // do we have a full genesis period
  //
  let do_we_have_a_full_genesis_period = 0;
  let tmp_genesis_start = this.block.id - this.app.blockchain.genesis_period;
  if (tmp_genesis_start > this.app.blockchain.lowest_acceptable_bid || (tmp_genesis_start <= 0 && this.app.blockchain.lowest_acceptable_bid == 1)) {
    do_we_have_a_full_genesis_period = 1;
  }


  //
  // check transactions
  //
  // we will delete txsjson, which means that the transactions array
  // may be longer in the event of a chain reorganization.
  //
  if (this.block.txsjson.length > this.transactions.length) {
    console.log("Block transaction and txsjson arrays do not match. Discarding.");
    this.app.logger.logError("Block transactions do not match. Discarding.", {message:"",err:""});
    return 0;

  }


  //
  // ensure no duplicate input slips
  //
  let transaction_input_hmap = [];
  for (let i = 0; i < this.transactions.length; i++) {
    for (let j = 0; j < this.transactions[i].transaction.from.length; j++) {
      if (transaction_input_hmap[this.transactions[i].transaction.from[j].returnIndex()] != undefined) {
        console.log("Block invalid: doublespend input");
        this.app.logger.logError("Block invalid: doublespent input - " + this.transactions[i].transaction.from[j].returnIndex(), {message:"",err:""});
	console.log(i + " -- " + j);
        console.log(JSON.stringify(this.transactions[i].transaction.from[j]));
        return 0;
      }
      transaction_input_hmap[this.transactions[i].transaction.from[j].returnIndex()] = 1;
    }
  }
  

  //
  // validate non-rebroadcast transactions
  //
  for (let i = 0; i < this.transactions.length; i++) {
    if (this.transactions[i].type < 3) {
      if (!this.transactions[i].validate(this.app, this)) {
        console.log(`Block invalid: contains invalid transaction: ${i}`);
        this.app.logger.logError("Block invalid: contains invalid transaction: " + i, {message:"",err:""});
        return 0;
      }
    }
  }

  //
  // validate rebroadcast txs
  //
  if (do_we_have_a_full_genesis_period == 1) {
    let rebroadcast_validated = await this.validateRebroadcastTransactions();
    if (!rebroadcast_validated) {
      console.log("Cannot validate rebroadcast transactions!");
      return 0;
    }
  }

  //
  // validate reclaimed funds
  //
  if (do_we_have_a_full_genesis_period == 1) {
    let block_reclaimed = await this.calculateReclaimedFunds();
    if (block_reclaimed.reclaimed !== this.block.reclaimed) {
      console.log("Block invalid: reclaimed funds do not match - " + block_reclaimed.reclaimed + " vs " + this.block.reclaimed)
      return 0;
    }
  }

  //
  // validate merkle root
  //
  if (this.block.txsjson.length > 0) {
    this.block.txsjson.sort();
    let t = this.app.crypto.returnMerkleTree(this.block.txsjson).root;
    if (t != this.block.merkle) {
      console.log("Block merkle root hash is not as expected");
      this.app.logger.logError("Block merkle root hash is not as expected", {message:"",err:""});
      return 0;
    }
  }

  //
  // validate burn fee and fee transaction
  //
  if (this.block.txsjson.length > 0) {

    //
    // we must use returnMovingBurnFee as it recalculates based on the block
    // provided. using "ForThisBlock" will fetch the information from the 
    // bf object if it exists.
    //
    let burn_fee_needed   = Big(this.app.burnfee.returnMovingBurnFee(prevblk, (this.block.ts-prevblk.block.ts)));
    let credits_available = Big(this.returnAvailableFees(this.block.creator));
    let surplus_available = credits_available.minus(burn_fee_needed);

    if (credits_available.lt(burn_fee_needed)) {
      console.log(`Block invalid: transaction fees inadequate: ${credits_available.toFixed(8)} -- ${burn_fee_needed.toFixed(8)}`);
      this.app.logger.logError("Block invalid: transaction fees inadequate", {message:"",err:""});
console.log(JSON.stringify(this.block));
process.exit(1);
      return 0;
    }

    //////////////////////////////
    // validate fee transaction //
    //////////////////////////////
    if (surplus_available.gt(0)) {

      let feetx = null;
      let feetx_count = 0;

      for (let i = 0; i < this.transactions.length; i++) {
        if (this.transactions[i].transaction.type == 2) {
          feetx = this.transactions[i];
          feetx_count++;
        }
      }

      if (feetx == null) {
        console.log("Block invalid: surplus exists but no fee ticket");
        this.app.logger.logError("Block invalid: surplus exists but no fee ticket", {message:"",err:""});
        return 0;
      }

      if (feetx_count > 1) {
        console.log("Block invalid: multiple fee transactions found in block");
        this.app.logger.logError("Block invalid: multiple fee transactions found in block", {message:"",err:""});
        return 0;
      }

      let v = Big(0);
      for (let i = 0; i < feetx.transaction.to.length; i++) { v = v.plus(feetx.transaction.to[i].amt); }

      if (! Big(v.toFixed(8)).eq(Big(surplus_available.toFixed(8)))) {
        console.log(`Block invalid: surplus exists but does not match fee ticket: ${v.toFixed(8)} -- ${surplus_available.toFixed(8)}`);
        this.app.logger.logError("Block invalid: surplus exists but does not match fee ticket", {message:"",err:""});
        return 0;
      }
    }
  }


  ////////////////////////////
  // validate golden ticket //
  ////////////////////////////
  let gttx = null;
  let gttx_count = 0;

  // check for golden ticket
  for (let i = 0; i < this.transactions.length; i++) {
    if (this.transactions[i].transaction.type == 1) {
      gttx_count++;
      gttx = this.transactions[i];
    }
  }

  if (gttx_count > 1) {
    console.log("Block invalid: has more than one golden ticket");
    this.app.logger.logError("Block invalid: has more than one golden ticket", {message:"",err:""});
    return 0;
  }

  // no golden ticket
  if (gttx == null) {

    // difficulty, paysplit should be unchanged
    if (this.returnPaysplit() != prevblk.returnPaysplit()) {
      console.log("Block invalid: no golden ticket yet paysplit differs");
      this.app.logger.logError("Block invalid: no golden ticket yet paysplit differs", {message:"",err:""});
      return 0;
    }
    if (this.returnDifficulty() != prevblk.returnDifficulty()) {
      console.log("Block invalid: no golden ticket yet difficulty differs");
      this.app.logger.logError("Block invalid: no golden ticket yet difficulty differs", {message:"",err:""});
      return 0;
    }

  } else {

    // ensure golden ticket consistent
    let golden = new saito.goldenticket(this.app, JSON.stringify(gttx.transaction.msg));

    if (! golden.validateSolution(this, prevblk, gttx.transaction.from[0].add) ) {
      console.log("Block invalid: contains invalid golden ticket (solution invalid)");
      this.app.logger.logError("Block contains invalid golden ticket (solution invalid)", {message:"",err:""});
      return 0;
    }

    //
    // ensure golden ticket miner and node payouts are exactly right
    //
    let total_fees_needed_for_prevblk    = await this.app.burnfee.returnBurnFeePaidForThisBlock(prevblk);
    let total_fees_available_for_creator = prevblk.returnAvailableFees(prevblk.block.creator);
    let total_fees_in_prevblk            = prevblk.returnFeesTotal();
    let creator_surplus                  = Big(total_fees_available_for_creator).minus(Big(total_fees_needed_for_prevblk));
    let total_fees_for_miners_and_nodes  = Big(total_fees_in_prevblk).minus(creator_surplus).plus(prevblk.returnCoinbase());


    // miner and node shares
    let miner_share = total_fees_for_miners_and_nodes.div(2).toFixed(8);
    let node_share =  total_fees_for_miners_and_nodes.minus(Big(miner_share)).toFixed(8);

    if (gttx.transaction == null) {
      console.log("Block invalid: contains invalid golden ticket transaction");
      this.app.logger.logError("Block invalid: contains invalid golden ticket transaction", {message:"",err:""});
      return 0;
    }
    if (gttx.transaction.to.length < 2) {
      console.log("Block invalid: contains insufficient transaction to slips");
      this.app.logger.logError("Block invalid: contains insufficient transaction to slips", {message:"",err:""});
      return 0;
    }

    // create the golden ticket transaction
    if (gttx.transaction.to[0].amt != miner_share) {
      console.log("Block invalid: contains invalid miner share in golden ticket");
      this.app.logger.logError("Block invalid: contains invalid miner share in golden ticket", {message:"",err:""});
      return 0;
    }
    if (gttx.transaction.to[1].amt != node_share) {
      console.log("Block invalid: contains invalid node share in golden ticket");
      this.app.logger.logError("Block invalid: contains invalid node share in golden ticket", {message:"",err:""});
      return 0;
    }

    //
    // ensure there are no new tokens snuck into this transaction
    //
    let gttx_from_amt = Big(0);
    for (let i = 0; i < gttx.transaction.from.length; i++) {
      gttx_from_amt = gttx_from_amt.plus(Big(gttx.transaction.from[i].amt));
    }
    let gttx_to_amt = Big(0);
    for (let i = 2; i < gttx.transaction.to.length; i++) {
      gttx_to_amt = gttx_to_amt.plus(Big(gttx.transaction.to[i].amt));
    }
    if (gttx_from_amt.lt(gttx_to_amt)) {
console.log(gttx_from_amt.toFixed(8) + " < " + gttx_to_amt.toFixed(8));
console.log(JSON.stringify(gttx.transaction));
      console.log("Block invalid: golden ticket transaction tries to sneak money into change slip");
      this.app.logger.logError("Block invalid: golden ticket transaction tries to sneak money into change slip", {message:"",err:""});
      return 0;
    }


    //
    // confirm difficulty
    //
    if (this.returnDifficulty() != golden.calculateDifficulty(prevblk)) {
      console.log("Block invalid: difficulty adjustment is incorrect");
      this.app.logger.logError("Block invalid: difficulty adjustment is incorrect", {message:"",err:""});
      return 0;
    }
    if (this.returnPaysplit() != golden.calculatePaysplit(prevblk)) {
      console.log("Block invalid: paysplit adjustment is incorrect");
      this.app.logger.logError("Block invalid: paysplit adjustment is incorrect", {message:"",err:""});
      return 0;
    }


    // validate monetary policy
    if (golden !== null) {
      if (golden.validateMonetaryPolicy(this.returnTreasury(), this.returnCoinbase(), prevblk) != 1) {
        console.log("Block invalid: monetary policy does not validate");
        this.app.logger.logError("Block invalid: monetary policy does not validate", {message:"",err:""});
        return 0;
      }
    }
  }
  return 1;
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
Block.prototype.returnAvailableFees = function returnAvailableFees(publickey="") {

  if (publickey == "") { publickey = this.app.wallet.returnPublicKey(); }

  let v = Big(0);
  for (let i = 0; i < this.transactions.length; i++) {
    v = v.plus(Big(this.transactions[i].returnFeesUsable(this.app, publickey)));
  }
  return v.toFixed(8);

}
Block.prototype.returnFeesTotal = function returnFeesTotal() {

  let v = Big(0);
  for (let i = 0; i < this.transactions.length; i++) {
    v = v.plus(Big(this.transactions[i].returnFeesTotal(this.app, this.block.creator)));
  }
  return v.toFixed(8);

}


/**
 * update Google Dense Hashmap to spend inputs in block
 */
Block.prototype.spendInputs = function spendInputs() {

  for (let b = 0; b < this.transactions.length; b++) {
    for (let bb = 0; bb < this.transactions[b].transaction.from.length; bb++) {
      if (this.transactions[b].transaction.from[bb].amt > 0) {
        let slip_map_index = this.transactions[b].transaction.from[bb].returnIndex();
        this.app.storage.updateShashmap(slip_map_index, this.block.id);
      }
    }
  }
  return 1;

}


/**
 * update Google Dense Hashmap to unspend inputs in block
 */
Block.prototype.unspendInputs = function unspendInputs() {

  for (let b = 0; b < this.transactions.length; b++) {
    for (let bb = 0; bb < this.transactions[b].transaction.from.length; bb++) {
      if (this.transactions[b].transaction.from[bb].amt > 0) {
        let slip_map_index = this.transactions[b].transaction.from[bb].returnIndex();
        this.app.storage.updateShashmap(slip_map_index, -1);
      }
    }
  }
  return 1;

}


/*
 * run callbacks
 */
Block.prototype.runCallbacks = function runCallbacks(confnum) {
  for (let cc = this.confirmations+1; cc <= confnum; cc++) {
    for (let ztc = 0; ztc < this.callbacks.length; ztc++) {
      this.callbacks[ztc](this, this.transactions[this.callbacksTx[ztc]], cc, this.app);
    }
  }
  this.confirmations = confnum;
}

