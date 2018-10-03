'use strict';

/**
 * Voter Constructor
 * @param {*} app
 */
function Voter(app) {

  if (!(this instanceof Voter)) {
    return new Voter(app);
  }

  this.app                      = app || {};

  this.vote                    = {};
  this.vote.difficulty         = true;
  this.vote.paysplit           = true;

  this.target                  = {};
  this.target.difficulty       = 2;
  this.target.paysplit         = 0.5;

  return this;

}
module.exports = Voter;


/**
 * Initialize the voter class
 */
Voter.prototype.initialize = function initialize() {}


/**
 * Returns true if we prefer block A to block B given our voting preferences
 * @param {block} a
 * @param {block} b
 * @returns {boolean} do we prefer a to b?
 */
Voter.prototype.prefersBlock = function prefersBlock(a, b) {
  if(a == null) { return false; }
  if(b == null) { return true; }

  if (a.block.paysplit > this.target.paysplit) {
      if (a.block.vote == -1 && b.block.vote > -1) { return true; }
      if (a.block.vote == 0  && b.block.vote > 0)  { return true; }
  } else {
    if (a.block.paysplit == this.target.paysplit) {
      if (a.block.vote == 0) { return true; }
    } else {
      if (a.block.vote == 1 && b.block.vote < 1)  { return true; }
      if (a.block.vote == 0  && b.block.vote < 0) { return true; }
    }
  }
  return false;
}


/**
 * Returns our preferred difficulty vote
 * @param {float} difficulty
 * @returns {int} preferred vote
 */
Voter.prototype.returnDifficultyVote = function returnDifficultyVote(difficulty) {
  if (this.vote.difficulty) {
    if (difficulty < this.target.difficulty) { return 1; }
    if (difficulty > this.target.difficulty) { return -1; }
    return 0;
  }
  return 0;
}


/**
 * Returns our preferred paysplit vote
 * @params {decimal} paysplit
 * @returns {int} preferred vote
 */
Voter.prototype.returnPaysplitVote   = function returnPaysplitVote(paysplit) {
  if (this.vote.paysplit) {
    if (paysplit < this.target.paysplit) { return 1; }
    if (paysplit > this.target.paysplit) { return -1; }
  }
  return 0;
}

