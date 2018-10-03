'use strict';

/**
 * Slip Constructor
 * @param {*} add
 * @param {*} amt
 * @param {*} type
 * @param {*} bid
 * @param {*} tid
 * @param {*} sid
 * @param {*} bhash
 * @param {*} lc
 * @param {*} rn
 */
function Slip(add="", amt="0", type=0, bid=0, tid=0, sid=0, bhash="", lc=1, rn=-1) {

  if (!(this instanceof Slip)) {
    return new Slip(add, amt, type, bid, tid, sid, bhash, lc, rn);
  }

  this.add    = add;
  this.amt    = amt;
  this.type   = type;	// 0 = normal transaction
      // 1 = golden ticket
      // 2 = fee ticket
      // 3 = automatic tx rebroadcasting
  this.bid    = bid;
  this.tid    = tid;
  this.sid    = sid;
  this.bhash  = bhash;
  this.lc     = lc;
  this.rn     = rn;

  ///////////////////
  // random number //
  ///////////////////
  if (this.rn == -1) { this.rn = Math.floor(Math.random()*100); }

  return this;

}
module.exports = Slip;

/**
 * Returns the index created from the fields of the slip
 * @return {string} index
 */
Slip.prototype.returnIndex = function returnIndex() {
  return this.bid.toString() + this.type.toString() + this.tid.toString() + this.sid.toString() + this.bhash + this.amt.toString();
}

