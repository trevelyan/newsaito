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

  this.solution = {};
  this.solution.target = "";
  this.solution.vote = "";
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

  this.solution.target          = blk.returnHash();
  this.solution.vote            = this.app.voter.returnDifficultyVote(blk.block.difficulty);
  this.solution.random          = rn;

  return(JSON.stringify(this.solution));
}


GoldenTicket.validateSolution = function calculateSolution(blk, solution, publickey) {

  let sol = JSON.parse(solution);
  let hashValue     = this.app.crypto.hash(publickey + sol.rn);


  //
  // Set the number of digits to match - difficultyOrder
  // As our difficulty is granular to several decimal places
  // we check that the last digit in the test is within the
  // difficultyGrain - the decimal part of the difficulty
  //
  let difficultyOrder = Math.floor(prevblk.returnDifficulty());
  let difficultyGrain = prevblk.returnDifficulty() % 1;


  //
  // We are testing our generated has against the hash of the 
  // previous block.
  //
  // th is the test hash.
  // ph is the previous hash.
  //
  th = parseInt(hashValue.slice((0,difficultyOrder+1)),16);
  ph = parseInt(prevblk.returnHash().slice((0,difficultyOrder+1)),16);

  if (th >= ph && (th-ph)/16 <= difficultyGrain) {
    return 1;
  }
  return 0;
  
}






