const saito = require('../saito');
const Big = require('big.js');


/////////////////
// Constructor //
/////////////////
function GoldenTicket(app, gtjson = "") {

  if (!(this instanceof GoldenTicket)) {
    return new GoldenTicket(app, gtjson);
  }
  this.app = app || {};

  this.solution                 = {};
  this.solution.name            = "golden ticket";
  this.solution.target 		= "";
  this.solution.vote 		= "";
  this.solution.random	 	= "";

  if (gtjson != "") {
    try {
      this.solution = JSON.parse(gtjson);
    } catch (err) {
      return null;
    }
  }

  return this;

}

module.exports = GoldenTicket;


GoldenTicket.prototype.calculateSolution = function calculateSolution(blk, publickey, privatekey, rn) {

  this.solution.name            = "golden ticket";
  this.solution.target          = blk.returnHash();
  this.solution.vote            = this.app.voter.returnDifficultyVote(blk.block.difficulty);
  this.solution.random          = rn;

  return(this.solution);
}


GoldenTicket.prototype.validateSolution = function validateSolution(blk, prevblk, publickey) {

  if (blk == null) { return 0; }
  if (blk.block == null) { return 0; }

  //
  // no previous blocks? just accept
  // 
  if (prevblk == null) { return 1; }

  //
  // is our target this block?
  //
  if (this.solution.target != prevblk.returnHash()) { return 0; }

  //
  // check hash is valid
  //
  let proposedSolution = this.app.crypto.hash(blk.block.creator + this.solution.random);
  if (this.isValidSolution(proposedSolution, prevblk)) {
    return 1;
  }

  return 0;

}

/**
 *
 * given a solution, we figure out who the recipients of the
 * token issuance are going to be and return them in an array
 *
 * @params {saito.block} previous block
 * @returns {array} of winners
 *
 * TODO: weight the winners based on their share of transaction
 * or burn fee value, so that winnings reflect proportionality
 * of work instead of just a simpler lottery.
 **/
GoldenTicket.prototype.findWinner = function findWinner(solution, blk=null) {

  var winners    = [];

  //
  // find which of the previous block transactions is Charlie
  // based on the hexadecimal number in our signature turned
  // into a selection mechanism for a walk through an array
  // of contenders
  //
  let children  = this.returnGoldenTicketContenders(blk);
  if (children.length == 0) { return blk.block.creator; }
  let winner    = this.app.crypto.hash(solution.random).slice((-1 * (children.length)));
  let winnerInt = parseInt(winner, 16);
  let charlie   = children[winnerInt%children.length];

  return charlie;

}

/**
 * Calculate monetary policy given previous block
 *
 * @param {saito.block} prevblk
 */
GoldenTicket.prototype.calculateMonetaryPolicy = function calculateMonetaryPolicy(prevblk) {

  let prev_treasury  = prevblk.returnTreasury();
  let prev_reclaimed = prevblk.returnReclaimed();
  let prev_coinbase  = prevblk.returnCoinbase();

  let new_treasury = Big(prev_treasury).plus(Big(prev_reclaimed));
  let new_coinbase = Big(new_treasury).div(prevblk.app.blockchain.returnGenesisPeriod()).toFixed(8);
      new_treasury = Big(new_treasury).minus(Big(new_coinbase)).toFixed(8);

  var mp = [];
  mp[0]  = new_treasury;
  mp[1]  = new_coinbase;

  return mp;

}


/**
 *
 * Returns an array of all possible winners for the node share of
 * the golden ticket. TODO: note that this needs to be weighted
 * according to the weight of the value of the transaction to
 * the network at the time of the node processing it.
 *
 * @returns {array} winners
 *
 **/
GoldenTicket.prototype.returnGoldenTicketContenders = function returnGoldenTicketContenders(blk=null) {

  var children = [];

  if (blk == null) { return children; }
  if (blk.transactions == null) { return children; }
  if (blk.transactions.length == 0) { return children; }

  for (var v = 0; v < blk.transactions.length; v++) {

    //
    // only new paying transactions eligible
    //
    if (blk.transactions[v].transaction.type == 0) {
      if (blk.transactions[v].transaction.path.length == 0) {

        //
        // no path length, so add sender
        //
        children.push(blk.transactions[v].transaction.from[0].add);

      } else {

        // otherwise, we pick the destination node in each hop through
        // the transmission path. this eliminates the sender and keeps
        // the focus on nodes that actively transmitted the message
        //
        // NOTE: this is not weighted according to the relative value of
        // each node during the transmission process. We can add that
        // later and should to ensure that payout reflects value of the
        // txs being introduced into the network.
        //
        for (var x = 0; x < blk.transactions[v].transaction.path.length; x++) {
          children.push(blk.transactions[v].transaction.path[x].to);
        }
      }
    }
  }
  return children;

}


/**
 * Validates monetary policy
 *
 * @param {string} treasury
 * @param {string} coinbase
 * @param {saito.block} previous block
 * @returns {boolean} does validate?
 *
 */
GoldenTicket.prototype.validateMonetaryPolicy = function validateMonetaryPolicy(adjusted_treasury, adjusted_coinbase, prevblk) {

  let mp = this.calculateMonetaryPolicy(prevblk);

  if (mp[0] != adjusted_treasury) {
    console.log(`Treasury invalid: ${adjusted_treasury} -- ${mp[0]}`);
    return 0;
  }
  if (mp[1] != adjusted_coinbase) {
    console.log(`Coinbase invalid: ${adjusted_coinbase} -- ${mp[1]}`);
    return 0;
  }

  return 1;

}


/**
 * Calculate difficult using votes or from previous block
 *
 * @param {object} solution
 * @param {saito.block} prevblk
 */
GoldenTicket.prototype.calculateDifficulty = function calculateDifficulty(prevblk) {

  if (this.solution.vote == -1) {
    return (prevblk.returnDifficulty() - 0.01);
  }
  if (this.solution.vote == 1) {
    return (prevblk.returnDifficulty() + 0.01);
  }
  return prevblk.returnDifficulty();
}


/**
 * Calculate paysplit using votes or from previous block
 *
 * @param {object} solution
 * @param {saito.block} prevblk
 */
GoldenTicket.prototype.calculatePaysplit = function calculatePaysplit(prevblk) {
  if (prevblk.block.vote == -1) {
    return (prevblk.returnPaysplit() - 0.0001).toFixed(8);
  }
  if (prevblk.block.vote == 1) {
    return (prevblk.returnPaysplit() + 0.0001).toFixed(8);
  }
  return prevblk.returnPaysplit();
}

GoldenTicket.prototype.isValidSolution = function isValidSolution(soln, blk) {
    // Set the number of digits to match - difficultyOrder
    // As our difficulty is granular to several decimal places
    // we check that the last digit in the test is within the
    // difficultyGrain - the decimal part of the difficulty
    //
    let difficultyOrder = Math.floor(blk.returnDifficulty());
    let difficultyGrain = blk.returnDifficulty() % 1;

    // We are testing our generated hash against the hash of the previous block.
    // th is the test hash.
    // ph is the previous hash.
    //
    let th = parseInt(soln.slice(0,difficultyOrder+1),16);
    let ph = parseInt(blk.returnHash().slice(0,difficultyOrder+1),16);

    if (th >= ph && (th-ph)/16 <= difficultyGrain) {return true;}
    return false;
}

