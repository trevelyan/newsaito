//
// we cannot 'use strict' as we need to delete items from hashmaps
//
const saito    = require('../saito');
const Big      = require('big.js');


/**
 * Blockchain Contructor
 * @param {*} app
 */
function Blockchain(app) {

  if (!(this instanceof Blockchain)) { return new Blockchain(app); }

  this.app                 = app || {};
  this.index = {
    hash:        [],                 // hashes
    prevhash:    [],                 // hash of previous block
    bid:    	 [],                 // block id
    mintid:      [],                 // min tid
    maxtid:      [],                 // max tid
    ts:          [],                 // timestamps
    lc:          [],                 // is longest chain (0 = no, 1 = yes)
    bf:          []                  // burnfee per block
  };
  this.blocks              = [];
  this.block_hash_hmap     = [];

  this.genesis_period      = 20160;
  this.indexing_active     = false;

  this.lc_pos_newblock     = null;
  this.lc_pos_prevblock    = null;

  return this;

}
module.exports = Blockchain;


/**
 * Returns the latest block on the longest chain
 * @returns {saito.block} latest_block
 */
//
// this needs to be fixed
// longest chain is not necessarily the last one
//
Blockchain.prototype.returnPreviousBlock = function returnPreviousBlock(lc=1) {
  if (this.blocks.length == 0) { return null; }
  if (lc == 1) {
    return this.blocks[this.lc_pos];
  } else {
    return this.blocks[this.blocks.length-1];
  }
}


/**
 * Adds block to blockchain
 */
Blockchain.prototype.addBlockToBlockchain = function addBlockToBlockchain(newblock=null) {

  this.indexing_active = true;

  //
  // sanity check
  //
  if (newblock == null || newblock.is_valid == false) {
    this.app.logger.logError("BLOCK IS INVALID",{message:"",err:""});
    this.indexing_active = false;
    return;
  }

  //
  // if our block isnt null
  //
  let hash                   = newblock.returnHash('hex');
  let ts                     = newblock.block.ts;
  let prevhash               = newblock.block.prevhash;
  let bid                    = newblock.block.id;

  console.log(`START TIME: adding ${bid} -> ${hash} ${ts}`);

  //
  // genesis_ts does not yet exist
  //
  // this is stored by lite-clients, and it gets set when they
  // stary up. So what we are doing is checking to see if the
  // block is BEFORE the block that we care about. And how we
  // decide this.genesis_ts is a good question. Normally it is
  // stored in options.conf
  //
  //  if (ts < this.genesis_ts) {
  //    this.indexing_active = false;
  //    return;
  //  }
  //
  if (this.isHashIndexed(hash)) {
    this.indexing_active = false;
    return;
  }


  ////////////////////
  // missing blocks //
  ////////////////////



  /////////////////////////
  // add values to index //
  /////////////////////////
  var pos = 0;
  if (newblock == null) { this.binaryInsert(this.index.ts, ts, (a,b) => { return a - b; }); }
  this.index.hash.splice(pos, 0, hash);
  this.index.prevhash.splice(pos, 0, prevhash);
  this.index.bid.splice(pos, 0, bid);
  this.index.maxtid.splice(pos, 0, newblock.returnMaxTxId());
  this.index.mintid.splice(pos, 0, newblock.returnMinTxId());
  this.index.lc.splice(pos, 0, i_am_the_longest_chain);
  this.index.bf.splice(pos, 0, newblock.returnBurnFeeValue());
  this.blocks.splice(pos, 0, newblock);

  this.block_hash_hmap[hash] = bid;


  ///////////////////
  // set index pos //
  ///////////////////
  //
  // if the block fails to add successfully, we need to revert
  // to our previous lc index, which is why we save the prevblock
  // version of the longest-chain.
  //
  this.lc_pos_prevblock = this.lc_pos_newblock;
  this.lc_pos_newblock  = pos;

  //////////////////////////////////////////////////////////
  // if this is our first block, it is longest by default //
  //////////////////////////////////////////////////////////
  if (this.lc_pos_newblock == -1) { this.lc_pos_newblock = 0; }


  //////////////////////////////////////////////
  // decrypt any transactions intended for us //
  //////////////////////////////////////////////
  //
  // we handle during indexing to so that
  // modules can execute properly, i.e.
  // modules ask for either the decrypted
  // or original message using the
  // returnMessage function.
  //
  // newblock.decryptTransactions();


  ///////////////////////////
  // calculate average fee //
  ///////////////////////////
  // newblock.returnAverageFee();

  /////////////////////
  // affix callbacks //
  /////////////////////
  // this.blocks[pos].affixCallbacks();

  /////////////////////////////
  // track the longest chain //
  /////////////////////////////
  var i_am_the_longest_chain    = 0;
  var shared_ancestor_index_pos = -1;
  var validate_transactions     = -1;
  var rewrite_longest_chain     = 0;
  var rewrite_nchain_len        = 0;
  var rewrite_lchain_len        = 0;
  var rewrite_force_add         = "";
  var rewrite_from_start        = 1; // see below

  //
  // possibly adjust lc_pos_newblock forward
  // if we stuck our block earlier in a
  // position earlier in the chain
  //
  if (pos <= this.lc_pos_newblock) {
    this.lc_pos_newblock++;
    if (this.lc_pos_newblock >= this.index.hash.length) {
      this.lc_pos_newblock--;
    }
  }

  //
  // if we are the genesis block, we are the longest chain
  //
  if (prevhash == "" && this.index.prevhash.length == 1) {
    this.lc_pos_newblock = 0;
    i_am_the_longest_chain = 1;
  }

  //
  // first block from reset blockchains
  //
  if (this.lc_pos_prevblock != null) {
    if (this.index.hash.length == 1 && this.lc_pos_prevblock == newblock.block.bid - 1) {
      this.lc_pos_newblock = 0;
      i_am_the_longest_chain = 1;
    }
  }

  ////////////////////////////
  // IDENTIFY LONGEST CHAIN //
  ////////////////////////////
  //
  // we go through our index and figure out if the block
  // we are adding is part of the longest chain, and whether
  // making it the longest chain will require re-writing the
  // chain. this will set the variable
  //
  //   i_am_the_longest_chain
  //
  // to 1 if we think we are on the longest chain or to 0
  // if we are not. The rest of our block-addition code
  // needs to know whether we are longest-chain, so we do
  // it here first.
  //

  //
  // genesis block test
  //
  if (bid == 1 && this.lc_pos_prevblock == null) {

    //
    // i am the genesis block
    //
    i_am_the_longest_chain = 1;
    this.lc_pos_newblock = pos;


  //
  // i am not the genesis block
  //
  } else {

	if (bid >= this.index.bid[this.lc_pos_prevblock]) {
	  if (prevhash == this.index.hash[this.lc_pos_newblock]) {

        // if prev is longest
        this.lc_pos_newblock = pos;
        i_am_the_longest_chain = 1;
        // validate_transactions = 1;

      } else {

        //
        // otherwise, we find the last shared ancestor and
        // calculate the length and aggregate burn fee of
        // the two competing chains to determine which is
        // preferred
        //

        var lchain_pos = this.lc_pos_newblock;
        var nchain_pos = pos;

        var lchain_len = 0;
        var nchain_len = 0;

        var lchain_bf = this.index.bf[lchain_pos];
        var nchain_bf = this.index.bf[nchain_pos];

        var lchain_ts  = this.index.ts[lchain_pos];
        var nchain_ts  = this.index.ts[nchain_pos];

        var lchain_prevhash  = this.index.prevhash[lchain_pos];
        var nchain_prevhash  = this.index.prevhash[nchain_pos];

        var search_pos       = null;
        var search_ts        = null;
        var search_hash      = null;
        var search_prevhash  = null;
        var search_bf        = null;

        var ancestor_precedes_current = 0;

        if (nchain_ts >= lchain_ts) {
          search_pos = nchain_pos - 1;
        } else {
          ancestor_precedes_current = 1;
          search_pos = lchain_pos - 1;
        }

        while (search_pos >= 0) {

          search_ts         = this.index.ts[search_pos];
          search_hash       = this.index.hash[search_pos];
          search_prevhash   = this.index.prevhash[search_pos];
          search_bf         = this.index.bf[search_pos];

          if (search_hash == lchain_prevhash && search_hash == nchain_prevhash) {
            shared_ancestor_index_pos = search_pos;
            search_pos = -1;
          } else {
            if (search_hash == lchain_prevhash) {
              lchain_len++;
              lchain_prevhash = this.index.prevhash[search_pos];
              lchain_bf  = parseFloat(lchain_bf) + parseFloat(this.index.bf[search_pos]);
            }
            if (search_hash == nchain_prevhash) {
              nchain_prevhash = this.index.prevhash[search_pos];
              nchain_len++;
              // this may be inexact, but as long as javascript errors
              // work the same way on all machines... i.e. hack but
              // good enough for now
              nchain_bf  = parseFloat(nchain_bf) + parseFloat(this.index.bf[search_pos]);
            }
            shared_ancestor_index_pos = search_pos;
            search_pos--;
          }
        }


        if (nchain_len > lchain_len && nchain_bf >= lchain_bf) {

          //
          // to prevent our system from being gamed, we
          // require the attacking chain to have equivalent
          // or greater aggregate burn fees. This ensures that
          // an attacker cannot lower difficulty, pump out a
          // ton of blocks, and then hike the difficulty only
          // at the last moment.
          //

          console.log(`UPDATING LONGEST CHAIN: ${nchain_len} new |||||| ${lchain_len} old 1`);
          this.app.logger.logInfo(`UPDATING LONGEST CHAIN: ${nchain_len} new |||||| ${lchain_len} old 1`);

          i_am_the_longest_chain = 1;

        } else {

          //
          // we have a choice of which chain to support, and we
          // support whatever chain matches our preferences
          //
          if (nchain_len == lchain_len && nchain_bf >= lchain_bf) {

            latest_block = this.returnLatestBlock();
            if (latest_block != null) {
              if (this.app.voter.prefersBlock(newblock, latest_block)) {

                console.log(`UPDATING LONGEST CHAIN W/ PREFERENCE: ${nchain_len} new |||||| ${lchain_len} old 2`);
                this.app.logger.logInfo(`UPDATING LONGEST CHAIN W/ PREFERENCE: ${nchain_len} new |||||| ${lchain_len} old 2`);

                i_am_the_longest_chain = 1;

              }
            }
          }
        }
      }
    } else {

      //
      // this catches an edge case that happens if we ask for blocks starting from
      // id = 132, but the first block we RECEIVE is a later block in that chain,
      // such as 135 or so.
      //
      // in this case our blockchain class will treat the first block as the starting
      // point and we run into issues unless we explicitly reset the blockchain to
      // treat block 132 as the proper first block.
      //
      // so we reset this to our first block and mark it as part of the longest chain
      // the network will figure this out in time as further blocks build on it.
      //
      if (newblock.block.prevhash == prevhash && newblock.block.prevhash != "") {

        // reset later blocks to non-longest chain
        for (let h = pos+1; h < this.index.lc.length; h++) {
          this.index.lc[h] = 0;
          this.app.storage.onChainReorganization(this.index.block_id[h], this.index.hash[h], 0);
          this.app.wallet.onChainReorganization(this.index.block_id[h], this.index.hash[h], 0);
          this.app.modules.onChainReorganization(this.index.block_id[h], this.index.hash[h], 0);
        }

        // insist that I am the longest chain
        i_am_the_longest_chain = 1;
        //   this.previous_block_hash = hash;
        //   this.lc_pos_newblock = pos;
        //   this.app.modules.updateBalance();

        //
        // we do not need to worry about updating the slips
        //
        // the blocks we reset will be reset as lc = 1 when
        // the next block comes in that has a full chain
        // starting from this block
        //

      }
    }

  } // genesis block test


  if (i_am_the_longest_chain == 1){
    //
    // we are the longest chain !!!
    //
    this.index.lc[pos] = 1;
    this.lc_pos_newblock = pos;


    //
    // start mining
    //
    this.app.miner.stopMining();
    this.app.miner.startMining(newblock);
  }

  this.indexing_active = false;

}


/**
 * Checks if the hash has previosly been indexed
 * @param {*} hash
 */
Blockchain.prototype.isHashIndexed = function isHashIndexed(hash) {
  if (this.block_hash_hmap[hash] > 0) { return true; }
  return false;
};

/**
 * Binary Insert algorithm
 * @param {*} list
 * @param {*} item
 * @param {*} compare
 * @param {*} search
 */
Blockchain.prototype.binaryInsert = function binaryInsert(list, item, compare, search) {

  var start = 0;
  var end = list.length;

  while (start < end) {

    var pos = (start + end) >> 1;
    var cmp = compare(item, list[pos]);

    if (cmp === 0) {
      start = pos;
      end = pos;
      break;
    } else if (cmp < 0) {
      end = pos;
    } else {
      start = pos + 1;
    }
  }

  if (!search) { list.splice(start, 0, item); }

  return start;
}

/**
 * Returns the latest block on the blockchain based on the lc_value
 */
Blockchain.prototype.returnLatestBlock = function returnLatestBlock() {
	if (this.blocks.length == 0) { return null; }
	for (let i = this.blocks.length-1; i >= 0; i--) {
	  if (this.blocks[i].hash == this.index.hash[this.lc_pos_newblock]) {
		return this.blocks[i];
	  }
	}
	return null;
  }

/**
 * Returns indexed min tx id
 * @returns {int} mintxid
 */
Blockchain.prototype.returnMinTxId = function returnMinTxId() {
  if (this.lc_pos == null) { return 0; }
  return this.index.mintid[this.lc_pos];
}


/**
 * Returns indexed max tx id
 * @returns {int} maxtxid
 */
Blockchain.prototype.returnMaxTxId = function returnMaxTxId() {
  if (this.lc_pos == null) { return 0; }
  return this.index.maxtid[this.lc_pos];
}
