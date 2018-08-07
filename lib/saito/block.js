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
  this.block.id               = 0;
  this.block.txsjson          = [];
  this.block.bf               = {};    // burn fee object
				       // bf.start  (starting fee)
  this.block.difficulty       = 0.1875;
  this.block.paysplit         = 0.5;
  this.block.treasury         = Big("10000000000.0");
  this.block.coinbase         = Big("0.0");
  this.block.reclaimed        = Big("0.0");
  this.block.vote             = 0;     // paysplit vote
				       // -1 reduce miner payout
                                       //  0 no change
                                       //  1 increase miner payout
  this.confirmations          = confirmations;
  this.is_valid 	      = 1;     // set to zero if there is an 
				       // error importing the blkjson

  return this;

}
module.exports = Block;


Block.prototype.returnHash = function returnHash() {
  if (this.hash != "") { return this.hash; }
  this.hash = this.app.crypt.hash( this.returnSignatureSource() );
  return this.hash;
}


Block.prototype.bundle = async function bundle(prevblk=null) {

  return new Promise((resolve, reject) => {

    if (this.app.monitor.canBlockBundle()) {
      console.log(`block.js -- busy and refusing to create block: ${currently_indexing} / ${currently_reclaiming} / ${this.app.mempool.currently_clearing}`);

      this.app.logger.logInfo(`block.js -- busy and refusing to create block: ${currently_indexing} / ${currently_reclaiming} / ${this.app.mempool.currently_clearing}`)
      reject(false);
    }

    // 
    // set default values
    //
    if (prevblk != null) {

      this.block.id 	    = prevblk.block.id + 1;
      this.block.treasury   = Big(prevblk.block.treasury).plus(prevblk.block.reclaimed);
      this.block.coinbase   = Big(this.block.treasury).div(this.app.blockchain.genesis_period).toFixed(8);
      this.block.treasury   = this.block.treasury.minus(Big(this.block.coinbase)).toFixed(8);

      this.block.prevhash   = prevblk.block.returnHash();
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

	if (!validates) { resolve(false); }

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
        resolve(true);

      })
      .catch( (err) => {
        console.log(err);
	resolve(false);
      });
  });
}

Block.prototype.calculateReclaimedFunds = function calculateReclaimedFunds() {
  return new Promise((resolve, reject) => {
    resolve({reclaimed: 0.0, validates: true});
  });
}

Block.prototype.validateTransactions = function validateTransactions(){
  return new Promise((resolve, reject) => {
    // check transactions

    // validate merkleTree

    // validate fees

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

Block.prototype.validateReclaimedFunds = async function validateReclaimedFunds() {
      // lite clients exit without validating
  if (this.app.BROWSER == 1 || this.app.SPVMODE == 1) {
    resolve(true);
  }

  // full nodes have to check
  try {
    var {reclaimed, validates} = await this.calculateReclaimedFunds()
  } catch (err) {
    this.app.logger.logError(`Error thrown in validateReclaimedFunds`, {message: "", err})
  }

  if (!validates) {
    this.app.logger.logInfo("validation error: failure to rebroadcast required transaction")
  }

  if (Big(this.block.reclaimed).eq(reclaimed)) {
    return true;
  } else {
    return false;
  }

}

/**
 * Validates the incoming block
 * @param {saito.block} blk
 * @returns {boolean} validate
 */
Block.prototype.validate = async function validate() {

  // check if indexed
  if (this.app.blockchain.isHashIndexed(this.returnHash())) {
    this.app.logger.logError(`Hash is already indexed: ${this.returnHash()}`,{message:"",err:""});
    return false;
  }

  let validate_tx = await this.validateTransactions();

  // validate block
  if (!validate_tx) {
    this.app.mempool.removeBlock(blk);
    this.app.logger.logError(`INVALID BLOCK HASH: ${blk.returnHash()}`,{message:"",err:""});
    this.block.txsjson = [];

    this.app.logger.logError(JSON.stringify(blk.block, null, 4),{message:"",err:""});
    return false;
  }


  // validate reclaimed funds
  this.currently_reclaiming = true;

  return await this.validateReclaimedFunds()
}






