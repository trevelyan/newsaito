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
    bid:         [],                 // block id
    mintid:      [],                 // min tid
    maxtid:      [],                 // max tid
    ts:          [],                 // timestamps
    lc:          [],                 // is longest chain (0 = no, 1 = yes)
    bf:          []                  // burnfee per block
  };
  this.blocks              = [];
  this.block_hash_hmap     = [];

  this.genesis_ts          = 0;
  this.genesis_bid         = 0;
  this.genesis_period      = 20160;
  this.indexing_active     = false;

  this.lc                  = 0;

  return this;

}
module.exports = Blockchain;






/**
 * Returns the forkid of our longest chain
 */
Blockchain.prototype.returnForkId = function returnForkId() {
  return this.fork_id;
}


/**
 * Returns our reference Genesis Block Id
 */
Blockchain.prototype.returnGenesisBlockId = function returnGenesisBlockId() {
  return this.genesis_bid;
}


/**
 * Returns the latest block id from the longest chain
 * @returns {saito.block} latest_block
 */
Blockchain.prototype.returnLatestBlockId = function returnLatestBlock() {
  if (this.blocks.length == 0) { return 0; }
  return this.index.bid[this.lc];
}


/**
 * Returns the latest block on the longest chain
 * @returns {saito.block} latest_block
 */
Blockchain.prototype.returnPreviousBlock = function returnPreviousBlock(lc=1) {
  if (this.blocks.length == 0) { return null; }
  if (lc == 1) {
    return this.blocks[this.lc];
  } else {
    return this.blocks[this.blocks.length-1];
  }
}



/**
 * loads blocks from disk if they exist, and handles
 * lite-client initialization functions.
 **/
Blockchain.prototype.initialize = function initialize() {
  //this.app.storage.loadBlocksFromDisk(this.genesis_period+this.fork_guard);
}




/**
 * Adds block to blockchain
 */
Blockchain.prototype.addBlockToBlockchain = function addBlockToBlockchain(newblock=null) {

  this.indexing_active = true;

  //
  // sanity check
  //
  if (newblock == null) {
    this.app.logger.logError("BLOCK IS INVALID", {message:"",err:""});
    this.indexing_active = false;
    return;
  }

  //
  // if block not null
  //
  let hash                   = newblock.returnHash();
  let ts                     = newblock.block.ts;
  let prevhash               = newblock.block.prevhash;
  let bid                    = newblock.block.id;
  let old_lc                 = this.lc;

  console.log(`START TIME: adding ${bid} -> ${hash} ${ts}`);

  //
  // we need to handle initialization for lite-clients
  // or for nodes that have just started and read their
  // data in from an options file.
  //
  // check block does not precede GENESIS BID and
  // GENESIS TS as in that case we do not want to
  // add it.
  //
  //  if (ts < GENESIS_TIMESTAMP) {
  //    this.indexing_active = false;
  //    return;
  //  }
  //


  //
  // check hash not already indexed
  //
  if (this.isHashIndexed(hash)) {
    this.indexing_active = false;
    return;
  }


  ////////////////////
  // missing blocks //
  ////////////////////
  //
  // If the previous block hash was not indexed, we want to 
  // fetch it. This block will not be part of the longest
  // chain.
  //
  // if ( THIS_IS_OUR_FIRST_BLOCK ) {
  // 
  //   // when implementing, pay attention to the edge
  //   // case of receiving later blocks first and needing 
  //   // to receive earlier ones later.
  //
  // } else {
  //
  //   // fetch our missing block
  //
  // }
  //


  ////////////////////
  // insert indexes //
  ////////////////////
  var pos = this.binaryInsert(this.index.ts, ts, (a,b) => { return a - b; });
  this.index.hash.splice(pos, 0, hash);
  this.index.prevhash.splice(pos, 0, prevhash);
  this.index.bid.splice(pos, 0, bid);
  this.index.maxtid.splice(pos, 0, newblock.returnMaxTxId());
  this.index.mintid.splice(pos, 0, newblock.returnMinTxId());
  this.index.lc.splice(pos, 0, 0);
  this.index.bf.splice(pos, 0, newblock.returnBurnFeeValue());
  this.blocks.splice(pos, 0, newblock);

  this.block_hash_hmap[hash] = bid;



  /////////////////////////////
  // track the longest chain //
  /////////////////////////////
  var i_am_the_longest_chain  = 0;
  var shared_ancestor_pos     = -1;


  //
  // we need to adjust the longest-chain pos
  // forward if we inserted an element behind
  // it in the chain.
  //
  if (pos <= this.lc) { this.lc++; }



  ////////////////////////////
  // IDENTIFY LONGEST CHAIN //
  ////////////////////////////

  //
  // our first block
  //
  if (this.lc == 0 && this.old_lc == 0) {

    i_am_the_longest_chain = 1;

  //
  // everything else
  //
  } else {
    if (bid >= this.index.bid[this.lc]) {
      if (prevhash == this.index.hash[this.lc]) {

        i_am_the_longest_chain = 1;

      } else {

        //
        // find the last shared ancestor and calculate the 
        // length and aggregate burn fee of the two 
        // competing chains.
        //

        let lchain_pos = this.lc;
        let nchain_pos = pos;

        let lchain_len = 0;
        let nchain_len = 0;

        let lchain_bf  = this.index.bf[lchain_pos];
        let nchain_bf  = this.index.bf[nchain_pos];

        let lchain_ts  = this.index.ts[lchain_pos];
        let nchain_ts  = this.index.ts[nchain_pos];

        let lchain_prevhash  = this.index.prevhash[lchain_pos];
        let nchain_prevhash  = this.index.prevhash[nchain_pos];

        let search_pos       = null;
        let search_bf        = null;
        let search_ts        = null;
        let search_hash      = null;
        let search_prevhash  = null;

        if (nchain_ts >= lchain_ts) {
          search_pos = nchain_pos - 1;
        } else {
          search_pos = lchain_pos - 1;
        }

        while (search_pos >= 0) {

          search_ts         = this.index.ts[search_pos];
          search_bf         = this.index.bf[search_pos];
          search_hash       = this.index.hash[search_pos];
          search_prevhash   = this.index.prevhash[search_pos];

      //
      // hey look, it's the common ancestor!
      //
          if (search_hash == lchain_prevhash && search_hash == nchain_prevhash) {
            shared_ancestor_index_pos = search_pos;
            search_pos = -1;

      //
      // keep looking
      //
          } else {

            if (search_hash == lchain_prevhash) {
              lchain_len++;
              lchain_prevhash = this.index.prevhash[search_pos];
              lchain_bf = parseFloat(lchain_bf) + parseFloat(this.index.bf[search_pos]);
            }

            if (search_hash == nchain_prevhash) {
              nchain_prevhash = this.index.prevhash[search_pos];
              nchain_len++;
              nchain_bf = parseFloat(nchain_bf) + parseFloat(this.index.bf[search_pos]);
            }

            shared_ancestor_index_pos = search_pos;
            search_pos--;
          }
        }

    //
    // at this point, we have a shared ancestor position for
    // our two possible chains, and we need to decide which 
    // we are treating as the longest chain.
    //
        if (nchain_len > lchain_len && nchain_bf >= lchain_bf) {

          //
          // to prevent our system from being gamed, we
          // require the attacking chain to have equivalent
          // or greater aggregate burn fee. This ensures that
          // an attacker cannot lower difficulty, pump out a
          // ton of blocks, and then hike the difficulty only
          // at the last moment to claim the longest chain.
          //
          this.app.logger.logInfo(`UPDATING LONGEST CHAIN: ${nchain_len} new |||||| ${lchain_len} old 1`);
          i_am_the_longest_chain = 1;

        } else {

          //
          // to prevent our system from being gamed, we
          // require the attacking chain to have equivalent
          // or greater aggregate burn fee. This ensures that
          // an attacker cannot lower difficulty, pump out a
          // ton of blocks, and then hike the difficulty only
          // at the last moment to claim the longest chain.
          //
          // this is like the option above, except that we 
          // have a choice of which block to support.
          //
          if (nchain_len == lchain_len && nchain_bf >= lchain_bf) {
            if (this.app.voter.prefersBlock(newblock, this.returnLatestBlock())) {
              this.app.logger.logInfo(`UPDATING LONGEST CHAIN W/ PREFERENCE: ${nchain_len} new |||||| ${lchain_len} old 2`);
              i_am_the_longest_chain = 1;
            }
          }
        }
      }
    } else {

/********
      //
      // this triggers if:
      //
      //   bid < this.index.bid[this.lc]
      //
      // IF the prevhash is the same as the longest chain we have saved in our
      // options file, we want to treat this as the longest chain, even if the 
      // BID is less than what our software currently thinks is the longest chain
      //
      // this requires resetting the ENTIRE blockchain, and starting again from this
      // point. The remaining blocks that follow this will be readded to the longest
      // chain once the next block comes in (because there will be a common ancestor
      // now).
      //
      if (newblock.block.prevhash == prevhash && newblock.block.prevhash != "") {

        for (let h = pos+1; h < this.index.lc.length; h++) {
          this.index.lc[h] = 0;
          this.app.storage.onChainReorganization(this.index.block_id[h], this.index.hash[h], 0);
          this.app.wallet.onChainReorganization(this.index.block_id[h], this.index.hash[h], 0);
          this.app.modules.onChainReorganization(this.index.block_id[h], this.index.hash[h], 0);
        }

        i_am_the_longest_chain = 1;

      }
*********/
    } // bid >= longest chain bid
  } // genesis block test


  if (i_am_the_longest_chain == 1){

    //
    // we are the longest chain !!!
    //
    this.lc = pos;
    this.index.lc[pos] = 1;


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
      if (this.blocks[i].hash == this.index.hash[this.lc]) {
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
  if (this.lc == null) { return 0; }
  return this.index.mintid[this.lc];
}


/**
 * Returns indexed max tx id
 * @returns {int} maxtxid
 */
Blockchain.prototype.returnMaxTxId = function returnMaxTxId() {
  if (this.lc == null) { return 0; }
  return this.index.maxtid[this.lc];
}

/**
 * Calculates the ForkID for our current longest chain
 *
 * @params {saito.block} newestblk
 *
 **/
Blockchain.prototype.calculateForkId = function calculateForkId(blk) {

  if (blk == null) { return this.fork_id; }

  let baseblockid = blk.returnId();
  let fork_id     = "";
  let indexpos    = this.index.hash.length-1;

  for (let i = 0, stop = 0; stop == 0 && i < this.genesis_period;) {

    let checkpointblkid = baseblockid-i;
    indexpos = this.returnLongestChainIndexArray(checkpointblkid, indexpos);

    if (indexpos == -1 || checkpointblkid < 0) { stop = 1; }
    else {
      // get the hash
      let th = this.index.hash[indexpos];
      fork_id += th.substring(0,2);
    }

    //
    // if edited, also change:
    //
    // returnLastSharedBlockId()
    //
    if (i == 10000) { i = 50000; }
    if (i == 5000)  { i = 10000; }
    if (i == 1000)  { i = 5000; }
    if (i == 500)   { i = 1000; }
    if (i == 200)   { i = 500; }
    if (i == 100)   { i = 200; }
    if (i == 75)    { i = 100; }
    if (i == 50)    { i = 75; }
    if (i == 40)    { i = 50; }
    if (i == 30)    { i = 40; }
    if (i == 20)    { i = 30; }
    if (i == 10)    { i = 20; }
    if (i == 0)     { i = 10; }

    if (i > this.genesis_period || i == 50000) { stop = 1; }

  }

  this.fork_id = fork_id;

}



/**
 * Given a forkid and the last known shared block id, it
 * returns the last shared ancestry block. This is used to
 * help peers determine from which point to sync.
 *
 * @params {string} fork_id
 * @params {integer} last known block_id
 * @returns {integer} last shared block_id
 *
 **/
Blockchain.prototype.returnLastSharedBlockId = function returnLastSharedBlockId(fork_id, latest_known_block_id) {

  // if there is no fork_id submitted, we backpedal 1 block to be safe
  if (fork_id == null || fork_id == "") { return 0; }
  if (fork_id.length < 2) { if (latest_known_block_id > 0) { latest_known_block_id - 1; } else { return 0; } }

  // roll back latest known block id to known fork ID measurement point
  for (let x = latest_known_block_id; x >= 0; x--) {
    if (x%this.fork_id_mod == 0) {
      latest_known_block_id = x;
      x = -1;
    }
  }

  // roll back until we have a match
  for (let fii = 0; fii < (fork_id.length/2); fii++) {

    var peer_fork_id_pair = fork_id.substring((2*fii),2);
    var our_fork_id_pair_blockid = latest_known_block_id;

    if (fii == 0)  { our_fork_id_pair_blockid = latest_known_block_id - 0; }
    if (fii == 1)  { our_fork_id_pair_blockid = latest_known_block_id - 10; }
    if (fii == 2)  { our_fork_id_pair_blockid = latest_known_block_id - 20; }
    if (fii == 3)  { our_fork_id_pair_blockid = latest_known_block_id - 30; }
    if (fii == 4)  { our_fork_id_pair_blockid = latest_known_block_id - 40; }
    if (fii == 5)  { our_fork_id_pair_blockid = latest_known_block_id - 50; }
    if (fii == 6)  { our_fork_id_pair_blockid = latest_known_block_id - 75; }
    if (fii == 7)  { our_fork_id_pair_blockid = latest_known_block_id - 100; }
    if (fii == 8)  { our_fork_id_pair_blockid = latest_known_block_id - 200; }
    if (fii == 9)  { our_fork_id_pair_blockid = latest_known_block_id - 500; }
    if (fii == 10) { our_fork_id_pair_blockid = latest_known_block_id - 1000; }
    if (fii == 11) { our_fork_id_pair_blockid = latest_known_block_id - 5000; }
    if (fii == 12) { our_fork_id_pair_blockid = latest_known_block_id - 10000; }
    if (fii == 13) { our_fork_id_pair_blockid = latest_known_block_id - 50000; }


    // return hash by blockid
    var tmpklr = this.returnHashByBlockId(our_fork_id_pair_blockid);

    // if we have not found a match, return 0 since we have
    // irreconciliable forks, so we just give them everything
    // in the expectation that one of our forks will eventually
    // become the longest chain
    if (tmpklr == "") { return 0; }

    var our_fork_id_pair = tmpklr.substring(0, 2);

    // if we have a match in fork ID at a position, treat this
    // as the shared forkID
    if (our_fork_id_pair == peer_fork_id_pair) {
      return our_fork_id_pair_blockid;
    }

  }
  return 0;
}



/**
 * Given a block id, we return the hash of the block
 * in the longest-chain that has that ID, if exists
 *
 * @params {integer} block id
 * @returns {string} hash
 **/
Blockchain.prototype.returnHashByBlockId = function returnHashByBlockId(bid) {
  for (let n = this.index.bid.length-1; n >= 0; n--) {
    if (this.index.bid[n] == bid && this.index.lc[n] == 1) {
      return this.index.hash[n];
    }
    if (this.index.bid[n] < bid) {
      return "";
    }

    //
    // TODO - optimize
    //
    if (n-50 >= 1) {
      if (this.index.bid[n-50] > bid) {
        n -= 50;
      }
    }

  }
  return "";
}









/**
 * Returns an array with the index positions of the blocks
 * that form the longest-chain, stretching back from the 
 * latest block until the bid provided.
 *
 * @params {integer} block_id
 * @params {integer} index position
 * @returns {array} of integers/index positions
 */
Blockchain.prototype.returnLongestChainIndexArray = function returnLongestChainIndexArray(bid, spos=-1) {
  if (this.index.hash.length == 0) { return null; }
  var start_pos = this.index.hash.length-1;
  if (spos != -1) { start_pos = spos; }
  for (let c = start_pos; c >= 0; c--) {
    if (this.index.bid[c] == bid) {
      if (this.index.lc[c] == 1) {
        return c;
      }	
    }   
  }
  return -1;
}


