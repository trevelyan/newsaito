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
  this.hash                   = "";
  this.block.ts               = new Date().getTime();
  this.block.prevhash         = "";
  this.block.merkle           = "";
  this.block.creator          = "";
  this.block.id               = 0;
  this.block.txsjson          = [];
  this.block.bf               = {};    // burn fee object
  this.block.difficulty       = 0.1875;
  this.block.paysplit         = 0.5;
  this.block.treasury         = Big("10000000000.0");
  this.block.coinbase         = Big("0.0");
  this.block.reclaimed        = Big("0.0");
  this.block.vote             = 0;    // paysplit vote
				                              // -1 reduce miner payout
                                      //  0 no change
                                      //  1 increase miner payout
  this.confirmations          = confirmations;
  this.is_valid 	            = true;  //
				                              // error importing the blkjson

  return this;

}
module.exports = Block;

/**
 * Returns the hash
 */
Block.prototype.returnHash = function returnHash() {
  if (this.hash != "") { return this.hash; }
  this.hash = this.app.crypto.hash( this.returnSignatureSource() );
  return this.hash;
}

/**
 * Returns the signature basis that will be hashed
 */
Block.prototype.returnSignatureSource = function returnSignatureSource(){
  return this.block.ts.toString();
};

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
}

Block.prototype.calculateReclaimedFunds = async function calculateReclaimedFunds() {
  return new Promise(async (resolve, reject) => {
    resolve({reclaimed: 0.0, validates: true});
  });
}


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



