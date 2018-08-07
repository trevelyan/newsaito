'use strict';

const saito = require('../saito');


/**
 * Mempool Constructor
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
Miner.prototype.startMining = function startMining(blk) {

  if (blk == null) { return; }
  if (blk.is_valid == 0) { return; }

  if (this.mining_active) { clearInterval(this.mining_timer); }
  this.mining_active = true;

  var miner_self = this;

  this.mining_speed = setInterval(function(){
    miner_self.attemptSolution(blk);
  }, this.mining_speed);

}


////////////////
// stopMining //
////////////////
//
// stop the timer loop for solving golden tickets
//
Miner.prototype.stopMining = function stopMining() {
  clearInterval(this.mining_timer);
}

Miner.prototype.attemptSolution = function attemptSolution(prevblock) {

  if (prevblock == null) { return; }
  if (prevblock.is_valid == 0) { return; }

  let randomNumber  = Math.random().toString();
  let hashValue     = this.app.crypto.hash(ourPublicKey + randomNumber);

  if (intDifficulty == 0) {
    h1 = 1;
    h2 = 1;
  } else {
    h1 = parseInt(hashValue.slice((0,intDifficulty+1)),16);
    h2 = parseInt(prevblock.returnHash().slice((0,intDifficulty+1)),16);
  }
  if (h2 >= h1 && h2-h1 <= 16) {
    if ((h2-h1)/16 <= prevblock.returnDifficulty() % 1){
      this.stopMining();
      console.log("Huzzah, we have a solution");
    }
  }
