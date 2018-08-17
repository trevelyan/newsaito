'use strict';

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
  this.block.difficulty       = 0.1875;
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
      console.log(err);
      //this.app.logger.logError("Error thrown in Block constructor", err);
      this.is_valid = 0;
      return;
    }
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
 * @returns {int} block_id
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

  for (let i = 0; i < this.transactions.length; i++) {
    if (this.transactions[i].isGoldenTicket() == 1) { return 1; }
  }

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

    this.block.id 	      = prevblk.block.id + 1;
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
      // sort our txs
      //
      this.block.txsjson.sort();

      //
      // give them sequential ids
      //

      //
      // add tx merkle root
      //


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
    resolve({reclaimed: 0.0, validates: true});
  });
}

/**
 * Validates block by checking transactions, merkle, and golden ticket
 */
Block.prototype.validate = function validate() {
  return new Promise((resolve, reject) => {

    //
    // validate transactions
    //

    //
    // validate merkleTree
    //

    //
    // validate fees
    //

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

    // validate transactions
    resolve(true);
  });
}



