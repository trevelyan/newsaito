'use strict';
const saito = require('../saito');
const Big = require('big.js');

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
  this.mining_speed     = 2000;
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

  this.mining_timer = setInterval(function(){
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

  //
  // Check that we have a previous block to mine on.
  //
  if (prevblk == null) { return; }
  if (!prevblk.is_valid) { return; }

  //
  // Saito uses the miner's public key in it's PoW
  // This simplifies verifying the origin of solutions
  //
  var publickey = this.app.wallet.returnPublicKey();
  var privatekey = this.app.wallet.returnPrivateKey();

  //
  // Generate a random hash to check.
  // And grab the previous block hash.
  //
  let randomNumber  = Math.random().toString();
  let hashValue     = this.app.crypto.hash(publickey + randomNumber);

  //
  // Set the number of digits to match - difficultyOrder
  // As our difficulty is granular to several decimal places
  // we check that the last digit in the test is within the
  // difficultyGrain - the decimal part of the difficulty
  //
  let difficultyOrder = Math.floor(prevblk.returnDifficulty());
  let difficultyGrain = prevblk.returnDifficulty() % 1;

  //
  // We are testing our generated has against the hash of the previous block.
  // th is the test hash.
  // ph is the previous hash.
  //
  let th = parseInt(hashValue.slice((0,difficultyOrder+1)),16);
  let ph = parseInt(prevblk.returnHash().slice((0,difficultyOrder+1)),16);

  //console.log("DIFF GRAIN: " + difficultyGrain + " --- " + th + " / " + ph);
  if (1) {
  //if (th >= ph && (th-ph)/16 <= difficultyGrain) {

    this.stopMining();

    let gt = new saito.goldenticket(this.app);
    let gtobj = gt.calculateSolution(prevblk, publickey, privatekey, randomNumber);
    let is_valid = gt.validateSolution(prevblk, JSON.stringify(gtobj), publickey);

    let winning_node = gt.findWinner(gtobj, prevblk);
    if (winning_node == "") { winning_node = this.app.wallet.returnAddress(); }

    //
    // the total amount paid to miners and nodes is the 
    // COINBASE for the last block, plus the TOTAL FEES collected
    // minus the block creator surplus.  
    //
    //
    // this code is shared in the golden ticket validate function, where
    // it validates the node and miner shares of the transactions, in 
    // addition to making sure that the right people are paid.
    //
    let total_fees_needed_for_prevblk    = this.app.burnfee.returnBurnFeePaidForThisBlock(prevblk);
    let total_fees_available_for_creator = prevblk.returnAvailableFees(prevblk.block.creator);
    let total_fees_in_prevblk            = prevblk.returnFeesTotal();
    let creator_surplus			 = Big(total_fees_available_for_creator).minus(Big(total_fees_needed_for_prevblk));
    let total_fees_for_miners_and_nodes  = Big(total_fees_in_prevblk).minus(creator_surplus).plus(prevblk.returnCoinbase());

    // miner and node shares
    let miner_share = total_fees_for_miners_and_nodes.div(2).toFixed(8);
    let node_share =  total_fees_for_miners_and_nodes.minus(Big(miner_share)).toFixed(8);

console.log(

	"\n\n\nFOUND TICKET: " +
	"\n" + 
	"burn needed:    " + total_fees_needed_for_prevblk +
	"\n" + 
	"miner total:    " + total_fees_available_for_creator +
	"\n" + 
	"creator reward: " + creator_surplus + 
	"\n" + 
	"prev coinbase:  " + prevblk.returnCoinbase() +
	"\n" + 
	"total reward:   " + total_fees_for_miners_and_nodes +
	"\n" + 
	"miner share:    " + miner_share +
	"\n" + 
	"node share:     " + node_share +
	"\n\n"

);




    // create the golden ticket transaction
    let tx = new saito.transaction();
    tx.transaction.ts  = new Date().getTime();
    tx.transaction.type = 1;
    tx.transaction.msg = gtobj;

    // from slips
    if (Big(this.app.wallet.returnAvailableInputs()).gte(this.app.wallet.returnDefaultFee())) {
      tx.transaction.from = this.app.wallet.returnAdequateInputs(this.app.wallet.returnDefaultFee());
    } else {
      tx.transaction.from = [];
      tx.transaction.from.push(new saito.slip(this.app.wallet.returnPublicKey(), 0.0, 1));
    }


    // to slips
    tx.transaction.to = [];
    tx.transaction.to.push(new saito.slip(this.app.wallet.returnPublicKey(), miner_share, 1));
    tx.transaction.to.push(new saito.slip(winning_node, node_share, 1));

    // set slip ids
    for (let i = 0; i < tx.transaction.to.length; i++) {
      tx.transaction.to[i].sid = i;
    }

    // change address
    let change_amount = Big(tx.transaction.from[0].amt).minus(Big(this.app.wallet.returnDefaultFee()));
    if (change_amount.gt(0)) {
      tx.transaction.to.push(new saito.slip(this.app.wallet.returnPublicKey(), change_amount.toFixed(8), 0));
      tx.transaction.to[tx.transaction.to.length-1].type = 0;
    }

    tx = this.app.wallet.signTransaction(tx);
    this.app.network.propagateTransaction(tx);

  }
}


