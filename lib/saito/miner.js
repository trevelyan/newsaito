'use strict';

const saito = require('../saito');


/**
 * Miner Constructor
 * @param {*} app
 */
function Miner(app) {

  if (!(this instanceof Miner)) {
    return new Miner(app);
  }

  this.app                = app || {};

  this.mining_active    = false;
  this.mining_speed     = 1000;
  this.mining_timer     = null;

  return this;

}
module.exports = Miner;

/////////////////
// startMining //
/////////////////
//
// start a timer that tries to find solutions to
// golden tickets
//
//
/**
* Miner Start function
* @param {*} saito.block
*/
Miner.prototype.startMining = function startMining(blk) {

  if (blk == null) { return; }
  if (!blk.is_valid) { return; }

  if (this.mining_active) { clearInterval(this.mining_timer); }
  this.mining_active = true;

  var miner_self = this;

  this.mining_speed = setInterval(function(){
    miner_self.attemptSolution(blk);
  }, this.mining_speed);

}


/**
* Miner Stop FUNCTION
*/
Miner.prototype.stopMining = function stopMining() {
  clearInterval(this.mining_timer);
}


/**
* Attempt to create a valid solution to Saito's proof-of-work function
* @param {*} saito.block
*/
Miner.prototype.attemptSolution = function attemptSolution(prevblk) {

  // Check that we have a previous block to mine on.
  if (prevblk == null) { return; }
  if (!prevblk.is_valid) { return; }

  // Saito uses the miner's public key in it's PoW
  // This simplifies verifying the origin of solutions
  var publicKey = this.app.wallet.returnPublicKey();

  // Generate a random hash to check.
  // And grab the previous block hash.

  let randomNumber  = Math.random().toString();
  let hashValue     = this.app.crypto.hash(publicKey + randomNumber);

  // Set the number of digits to match - difficultyOrder
  // As our difficulty is granular to several decimal places
  // we check that the last digit in the test is within the
  // difficultyGrain - the decimal part of the difficulty
  let difficultyOrder = Math.floor(prevblk.returnDifficulty());
  let difficultyGrain = prevblk.returnDifficulty() % 1;

  // We are testing our generated has against the hash of the previous block.
  // th is the test hash.
  // ph is the previous hash.
  th = parseInt(hashValue.slice((0,difficultyOrder+1)),16);
  ph = parseInt(prevblk.returnHash().slice((0,difficultyOrder+1)),16);

  if (th >= ph && (th-ph)/16 <= difficultyGrain) {
    this.stopMining();
    console.log("Huzzah, we have a solution");
  }
}


