'use strict';

const saito    = require('../saito');
const Big = require('big.js');
const Promise = require('bluebird');

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
  this.block.difficulty       = 5.9999;
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
  this.is_valid 	            = true;  // set to zero if there is an
                                             // error importing the blkjson
  this.hash                   = "";    // block hash (bhash)
  this.prehash                = "";    // hash of signature source that combines
                                              // with this.prevhash to create this.hash

  this.save_bid               = -1;
  this.save_db_id             = -1;
  this.prevalidated           = 0;

  this.contains_golden_ticket = -1;

  this.transactions           = [];


  if (blkjson != "") {
    try {
      this.block = JSON.parse(blkjson.toString("utf8"));
      for (var i = 0; i < this.block.txsjson.length; i++) {
        this.transactions[i] = new saito.transaction(this.block.txsjson[i]);
        if (this.transactions[i].is_valid == 0) {
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
    this.mintid = this.transactions[0].transaction.id;
    this.maxtid = this.transactions[this.transactions.length-1].transaction.id;
  }


  return this;

}
module.exports = Block;

/**
 * Returns the hash
 */
Block.prototype.returnDifficulty = function returnDifficulty() {
  return this.block.difficulty;
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
  this.hash = this.app.crypto.hash( this.prehash + this.prevhash );
  return this.hash;
}

/**
 * Returns the start burn fee value
 */
Block.prototype.returnBurnFeeValue = function returnBurnFeeValue() {
  return this.block.bf.start;
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
 * @param {*} prevblk
 */
Block.prototype.bundle = function bundle(prevblk=null) {
  //
  // set default values
  //
  if (prevblk != null) {

    this.block.id         = prevblk.block.id + 1;
    this.block.treasury   = Big(prevblk.block.treasury).plus(prevblk.block.reclaimed);
    this.block.coinbase   = Big(this.block.treasury).div(this.app.blockchain.genesis_period).toFixed(8);
    this.block.treasury   = this.block.treasury.minus(Big(this.block.coinbase)).toFixed(8);
    this.block.prevhash   = prevblk.returnHash();
    this.block.difficulty = prevblk.block.difficulty;
    this.block.paysplit   = prevblk.block.paysplit;

  }

  //
  // update burn fee
  //
  this.block.bf = this.app.burnfee.calculateBurnFee(prevblk, this.block.ts);


  //
  // this calculates the amount of tokens that
  // are unspent and cannot be rebroadcast in
  // the block that will fall off the chain when
  // we add this to the head of the chain.
  //
  // lite-clients will not properly set this
  // because lite-clients do not have the full
  // history of the blockchain.
  //
  this.calculateReclaimedFunds()
    .then(({reclaimed, validates}) => {
      if (!validates) { return false; }
      //
      // tell our block
      //
      this.block.reclaimed = reclaimed;

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
      // and let us know
      //
      return true;
    })
    .catch((err) =>  { console.log(err);  return false; });
    // end then
    // end calculateReclaimedFunds
}

/**
 * Returns reclaimed funds and a validation boolean
 * @returns {Promise} reclaimed, validates
 */
Block.prototype.calculateReclaimedFunds = async function calculateReclaimedFunds() {
  return new Promise(async (resolve, reject) => {

    if (this.app.BROWSER == 1 || this.app.SPVMODE == 1) { resolve({reclaimed: Big(0.0), validates: true}); }

    var eliminated_block_id = this.returnId() - this.app.blockchain.returnGenesisPeriod() - 1;
    var total_amount_to_add_to_treasury = 0.0;
    var does_block_validate = 1;
    var total_rebroadcast = 0;
    var current_rebroadcast = 0;

    if (eliminated_block_id < 1) {
      resolve({reclaimed: Big(0.0), validates: true});
      return;
    } else {
      // need eliminated_block_id instead of hash
      var block = await this.app.storage.loadSingleBlockFromDiskByID(eliminated_block_id);

      var unspent_amt = Big(0.0);

      for (var i = 0; i < blk.transactions.length; i++) {
        for (var j = 0; j < blk.transactions[j].transaction.to.length; j++) {
          var slip = blk.transactions[i].transaction.to[ii];
            slip.bid = blk.returnId();
            slip.tid = blk.transactions[i].transaction.id;
            slip.sid = ii;
            slip.bhash = blk.returnHash();

          if (Big(slip.amt).gt(0)) {
            if (slip.bhash == "") { slip.bhash = blk.returnHash(); }
            if (slip.gt != null || slip.ft != null) {
              if (storage_self.isSlipSpent(slip, block_self.returnId()) == 0) {
                //////////////////////////////////////////
                // automatic transaction rebroadcasting //
                //////////////////////////////////////////	// deadblk, newblk, slip_id
              }
            }
          }
        }
      }
    }

    var block2 = await this.app.storage.loadSingleBlockFromDiskByID(eliminated_block_id + 1);

    if (block2.containsGoldenTicket() == 0) {
      unspent_amt = unspent_amt.plus(Big(block.block.coinbase));
      resolve({reclaimed: unspent_amt, validates: true});
    }

    resolve({reclaimed: 0.0, validates: true});
  });
}

/**
 * Validates block by checking transactions, merkle, and golden ticket
 */
Block.prototype.validate = async function validate() {

  //
  // fetch prev block
  //
  if (this.block.prevhash == "") { return 1; }
  var prevblk = await this.app.blockchain.returnBlockByHash(this.block.prevhash);
  if (prevblk == null) { return 1; }

  //
  // check transactions
  //
  if (this.block.txsjson.length != this.transactions.length) {
    console.log("Block transaction and txsjson arrays do not match. Discarding.");
    this.app.logger.logError("Block transactions do not match. Discarding.", {message:"",err:""});
    return 0;

  }
  //
  // validate transactions
  //
  for (let i = 0; i < this.transactions.length; i++) {
    if (!this.transactions[i].validate(this.app, this)) {
      console.log("Block invalid: contains invalid transaction: " + i);
      this.app.logger.logError("Block invalid: contains invalid transaction: " + i, {message:"",err:""});
      return 0;
    }
  }


  //
  // ensure no duplicate input slips
  //
  let transaction_input_hmap = [];
  for (let i = 0; i < this.transactions.length; i++) {
    for (let j = 0; j < this.transactions[i].transaction.from.length; j++) {
      if (transaction_input_hmap[this.transactions[i].transaction.from[j].returnIndex()] != undefined) {
        console.log("Block invalid: doublespend input");
        this.app.logger.logError("Block merkle root hash is not as expected", {message:"",err:""});
        return 0;
      }
      transaction_input_hmap[this.transactions[i].transaction.from[j].returnIndex()] = 1;
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

    let burn_fee_needed   = Big(this.app.burnfee.returnBurnFeeNeeded(prevblk, (this.block.ts-prevblk.block.ts)));
    let credits_available = Big(this.returnAvailableFees(this.block.creator));
    let surplus_available = credits_available.minus(burn_fee_needed);

    if (credits_available.lt(burn_fee_needed)) {
      console.log("Block invalid: transaction fees inadequate: " + credits_available.toFixed(8) + " -- " + burn_fee_needed.toFixed(8));
      this.app.logger.logError("Block invalid: transaction fees inadequate", {message:"",err:""});
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
        console.log("Block invalid: surplus exists but does not match fee ticket: " + v.toFixed(8) + " -- " + surplus_available.toFixed(8));
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
    if (this.transactions[i].transaction.type == 2) {
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
    if (! golden.validateSolution(this, gttx.transaction.from[0].add) ) {
      console.log("Block invalid: contains invalid golden ticket (solution invalid)");
      this.app.logger.logError("Block contains invalid golden ticket (solution invalid)", {message:"",err:""});
      return 0;
    }

    //
    // ensure golden ticket miner and node payouts are exactly right
    //

/*****
    // validate paysplit and difficulty
    if (this.returnDifficulty() != this.app.goldenticket.calculateDifficulty(gttx.transaction.msg, prevblk)) {
      console.log("Block invalid: difficulty adjustment is incorrect");
      this.app.logger.logError("Block invalid: difficulty adjustment is incorrect", {message:"",err:""});
      return 0;
    }
    if (this.returnPaysplit() != this.app.goldenticket.calculatePaysplit(gttx.transaction.msg, prevblk)) {
      console.log("Block invalid: paysplit adjustment is incorrect");
      this.app.logger.logError("Block invalid: paysplit adjustment is incorrect", {message:"",err:""});
      return 0;
    }


    // validate monetary policy
    if (gtix != null) {
      if (gtix.validateMonetaryPolicy(this.returnTreasury(), this.returnCoinbase(), prevblk) != 1) {
        console.log("Block invalid: monetary policy does not validate");
        this.app.logger.logError("Block invalid: monetary policy does not validate", {message:"",err:""});
        return 0;
      }
    }
******/
  }
  console.log("FINISHED VALIDATION");
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



