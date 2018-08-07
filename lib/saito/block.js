'use strict';

const Big = require('big.js');

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

  return this;

}
module.exports = Block;

Block.prototype.returnHash = function returnHash() {
  if (this.hash != "") { return this.hash; }
  this.hash = this.app.crypt.hash( this.returnSignatureSource() );
  return this.hash;
}

Block.prototype.bundle = async function bundle(prevblock) {
  return new Promise((resolve, reject) => {
    if (this.app.monitor.isBlockchainActive()) {
      var { currently_indexing, currently_reclaiming } = this.app.blockchain
      console.log(`block.js -- busy and refusing to create block: ${currently_indexing} / ${currently_reclaiming} / ${this.app.mempool.currently_clearing}`);

      this.app.logger.logInfo(`block.js -- busy and refusing to create block: ${currently_indexing} / ${currently_reclaiming} / ${this.app.mempool.currently_clearing}`)
      return reject(false);
    }

    // alphabetize
    // need more optimal sort()
    this.block.txsjson.sort();

    // sequential block IDs
    if (prevblock != null) {
      this.block.id = prevblock.block.id + 1;
    }

    // sequential transaction IDs
    // insert transaction json
    var mtid = 0;
    if (prevblock != null) { mtid = prevblock.returnMaxTxId(); }
    for (let i = 0; i < this.block.txsjson.length; i++) {
      mtid++;
      this.block.txsjson[i].transaction.id = mtid;
      this.block.txsjson[i] = this.block.txsjson[i].returnTransactionJson();
    }

    if (this.block.txsjson.length == 0) {
      this.block.merkle     = "";
    } else {
      this.block.merkle     = this.app.crypt.returnMerkleTree(this.block.txsjson).root;
    }

    if (prevblock != null) {

      this.block.treasury   = Big(prevblock.block.treasury).plus(prevblock.block.reclaimed);
      this.block.coinbase   = Big(this.block.treasury).div(this.app.blockchain.genesis_period).toFixed(8);
      this.block.treasury   = this.block.treasury.minus(Big(this.block.coinbase)).toFixed(8);

      this.block.prevhash   = prevblock.block.returnHash();
      this.block.difficulty = prevblock.block.difficulty;
      this.block.paysplit   = prevblock.block.paysplit;
      this.block.bf         = prevblock.block.bf;
    }

    this.calculateReclaimedFunds(false)
      .then(({reclaimed, validates}) => {
        this.block.txsjson.sort();

        var mtid = 0;
        if (prevblock != null) { mtid = prevblock.returnMaxTxId(); }
        for (i = 0; i < this.block.txsjson.length; i++) {
          mtid++;
          this.block.txsjson[i].transaction.id = mtid;
        }
        for (var i = 0; i < this.block.txsjson.length; i++) {
          this.block.txsjson[i] = this.block.txsjson[i].returnTransactionJson();
        }
        if (this.block.txsjson.length == 0) {
          this.block.merkle     = "";
        } else {
          this.block.merkle     = this.app.crypt.returnMerkleTree(this.block.txsjson).root;
        }

        ///////////////////////////////////////////
        // lite nodes will not properly set this //
        ///////////////////////////////////////////
        //
        // Big.js number
        //
        this.block.reclaimed = reclaimed;


        resolve(validates);
      })
      .catch( err => console.log(err));

  });
}

Block.prototype.calculateReclaimedFunds = function calculateReclaimedFunds() {
  return new Promise((resolve, reject) => {
    resolve({reclaimed: 0.0, validates: true});
  });
}

Block.prototype.validate = function validate(){
  return new Promise((resolve, reject) => {
    resolve(true);
  })
}

Block.prototype.validateReclaimedFunds = function validateReclaimedFunds() {
  return new Promise((resolve, reject) => {
      // lite clients exit without validating
    if (this.app.BROWSER == 1 || this.app.SPVMODE == 1) {
      resolve(true);
    }

    // full nodes have to check
    this.calculateReclaimedFunds()
    .then(results => {

      if (!results.validates) {
        reject("validation error: failure to rebroadcast required transaction")
      }

      if (Big(this.block.reclaimed).eq(results.reclaimed)) {
        resolve(true);
      } else {
        resolve(false);
      }
    })
    .catch(err => console.log(err));
  });

}