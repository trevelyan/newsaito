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
  this.blocks               = [];
  this.block_hash_hmap      = [];

  this.last_hash    	    = "";
  this.last_bid     	    = 0;
  this.last_ts      	    = 0;

  this.lowest_acceptable_ts = 0;

  this.genesis_bid  	    = 0;
  this.genesis_ts   	    = 0;
  this.genesis_period       = 2;
  this.fork_guard           = 2;
  this.fork_id              = "";
  this.fork_id_mod	    = 10; 

  this.callback_limit       = 100;  // run callbacks on 100 blocks

  this.lc                   = 0;


  this.indexing_active      = false;

  return this;

}
module.exports = Blockchain;


/**
 * loads blocks from disk if they exist, and handles
 * lite-client initialization functions.
 **/
Blockchain.prototype.initialize = async function initialize() {
  try {
    await this.app.storage.loadBlocksFromDisk(this.genesis_period);

    this.app.options.blockchain = Object.assign({}, this.app.options.blockchain);

    let { last_hash, last_bid, last_ts, genesis_bid, genesis_ts } = this.app.options.blockchain;

    if (last_hash != undefined)   { this.last_hash = last_hash;}
    if (last_bid != undefined)    { this.last_bid = last_bid;}
    if (last_ts != undefined)     { this.last_ts = last_ts;}
    if (genesis_bid != undefined) { this.genesis_bid = genesis_bid;}
    if (genesis_ts != undefined)  { this.genesis_ts = genesis_ts;}
  } catch (err) {
    console.log(err);
  }
}

/**
 * Saves the blockchain meta-data for the options file
 **/
Blockchain.prototype.saveBlockchain = function saveBlockchain() {

  this.app.options.blockchain = Object.assign({}, this.app.options.blockchain);

  let blk = this.returnLatestBlock();

  if (blk == null) { return; }

  this.app.options.blockchain.last_hash    = blk.returnHash();
  this.app.options.blockchain.last_bid     = blk.block.id;
  this.app.options.blockchain.last_ts      = blk.block.ts;
  this.app.options.blockchain.genesis_bid  = this.genesis_bid;
  this.app.options.blockchain.genesis_ts   = this.genesis_ts;

  this.app.storage.saveOptions();

}


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
 * Returns our reference Genesis Timestamp
 */
Blockchain.prototype.returnGenesisTimestamp = function returnGenesisTimestamp() {
  return this.genesis_ts;
}


/**
 * Returns the latest block id from the longest chain
 * @returns {integer} latest_block_id
 */
Blockchain.prototype.returnLatestBlockId = function returnLatestBlockId() {
  if (this.blocks.length == 0) { return 0; }
  return this.index.bid[this.lc];
}


/**
 * Returns the Genesis Period of this Blockchain
 * @returns {integer} latest_block_id
 */
Blockchain.prototype.returnGenesisPeriod = function returnGenesisPeriod() {
  return this.genesis_period;
}


/**
 * Returns the latest block hash from the longest chain
 * @returns {string} latest_block_hash
 */
Blockchain.prototype.returnLatestBlockHash = function returnLatestBlockHash() {
  if (this.blocks.length == 0) { return ""; }
  return this.index.hash[this.lc];
}


/**
 * Returns the latest block on the longest chain
 * @param {integer} lc
 * @returns {saito.block} latest_block
 */
Blockchain.prototype.returnLatestBlock = function returnLatestBlock(lc=1) {
  if (this.blocks.length == 0) { return null; }
  if (lc == 1) {
    return this.blocks[this.lc];
  } else {
    return this.blocks[this.blocks.length-1];
  }
}


/**
 * Adds block to blockchain
 *
 * @param {saito.block} newblock
 * @param {boolean} force
 */
Blockchain.prototype.addBlockToBlockchain = async function addBlockToBlockchain(newblock=null, force=false) {

  this.indexing_active = true;

  //
  // sanity check
  //
  if (newblock == null || !newblock.is_valid) {
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
  // ignore pre-genesis blocks
  //
  if (ts < this.genesis_ts || bid < this.genesis_bid) {
    if (force) {
      this.indexing_active = false;
      return;
    }
  }


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
  if (ts < this.lowest_acceptable_ts) {
    if (force) {
      this.lowest_acceptable_ts = ts;
    }
  }
  //
  // do not fetch missing blocks if they preceded our earliest
  // block by timestamp, or have too low a BID to be relevant
  // on the current blockchain.
  //
  if (prevhash != "") {
    if (ts > this.lowest_acceptable_ts) {
      if (!this.isHashIndexed(prevhash))  {
        if ( bid > (this.index.bid[this.lc]-this.genesis_period)) {
          var response            = {};
          response.request        = "missing block";
          response.data           = {};
          response.data.hash      = prevhash;
          response.data.last_hash = this.returnLatestBlockHash();
          this.app.network.sendRequest(response.request, JSON.stringify(response.data));
        }
      }
    }
  }

  ////////////////////
  // insert indexes //
  ////////////////////
  var pos = this.binaryInsert(this.index.ts, ts, (a,b) => { return a - b; });

  if (pos <= this.lc && this.index.lc.length > 1) { this.lc++; }
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


  ////////////////////////////
  // IDENTIFY LONGEST CHAIN //
  ////////////////////////////
  //
  // use indexes to figure out if this block is potentially the head
  // of a chain of blocks that would be a contender to replace the
  // current chain as the longest chain.
  //
  //
  // if our first block
  //
  if (this.lc == 0 && old_lc == 0) {

    //
    // if we have a starting point, we
    // can only start our LC continuing
    // from it.
    //
    // otherwise, we treat this as our
    // starting point for syncing the
    // blockchain.
    //
    if (this.last_bid > 0) {
      if (prevhash == this.last_hash) {
        i_am_the_longest_chain = 1;
      }
    } else {
      i_am_the_longest_chain = 1;
    }

  //
  // everything else
  //
  } else {
    if (bid >= this.index.bid[this.lc]) {
      if (prevhash == this.index.hash[this.lc]) {
        i_am_the_longest_chain = 1;
      } else {

        //
        // find the last shared ancestor
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
            shared_ancestor_pos = search_pos;
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

            shared_ancestor_pos = search_pos;
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
    }
  } // genesis block test


  /////////////////////////////////
  // potential new longest chain //
  /////////////////////////////////
  if (i_am_the_longest_chain == 1) {

    this.lc = pos;
    this.index.lc[pos] = 1;
    this.block_hash_hmap[pos] = newblock.block.id;

    //
    // start mining
    //
    this.app.miner.stopMining();
    this.app.miner.startMining(newblock);


    //
    // old and new chains
    //
    var shared_ancestor_hash = this.index.hash[shared_ancestor_pos];
    var new_hash_to_hunt_for = newblock.returnHash('hex');
    var new_block_hashes     = [];
    var new_block_idxs       = [];
    var new_block_ids        = [];
    var old_hash_to_hunt_for = this.index.hash[old_lc];
    var old_block_hashes     = [];
    var old_block_idxs       = [];
    var old_block_ids        = [];
    var rewrite_from_start   = 1;

    //
    // edge case
    //
    if (shared_ancestor_pos == -1 && this.index.lc[0] == 0) {

      //
      // we are probably in a bad browser sync
      //
      for (let g = pos-1, h = 1; g >= 0, h <= 10; h++, g--) {
        if (this.index.lc[g] == 1) {
          rewrite_from_start = 0;
        }
      }

      //
      // quick fix
      //
      if (rewrite_from_start == 1 && this.blocks.length > 0) {

        //
        // once chain reorganization is working we should add
        // back the code that handles this edge-case. we are
        // checking to make sure that the longest chain will
        // work.
        //

      }
    }

    //
    // our block builds on the longest chain
    //
    if (newblock.block.prevhash == old_hash_to_hunt_for) {
      new_block_hashes.push(this.index.hash[pos]);
      new_block_idxs.push(pos);
      new_block_ids.push(this.index.bid[pos]);
    }

    //
    // this is a chain reorganization
    //
    else {

      for (let j = this.index.hash.length-1; j > shared_ancestor_pos; j--) {
        if (this.index.hash[j] == old_hash_to_hunt_for) {
          old_hash_to_hunt_for = this.index.prevhash[j];
          old_block_hashes.push(this.index.hash[j]);
          old_block_idxs.push(j);
          old_block_ids.push(this.index.bid[j]);
        }
      }
      old_block_hashes.reverse();
      old_block_idxs.reverse();

      for (let j = this.index.hash.length-1; j > shared_ancestor_pos; j--) {
        if (this.index.hash[j] == new_hash_to_hunt_for) {
          new_hash_to_hunt_for = this.index.prevhash[j];
          new_block_hashes.push(this.index.hash[j]);
          new_block_idxs.push(j);
          new_block_ids.push(this.index.bid[j]);
        }
      }
      new_block_hashes.reverse();
      new_block_idxs.reverse();

    }


    //
    // we are the longest chain, so we have to unwind the old chain
    // and wind the new chain. If there is no old chain we will just
    // wind the new chain directly.
    //
    await this.validateLongestChain(newblock, pos, shared_ancestor_pos, new_block_idxs, new_block_hashes, new_block_ids, old_block_idxs, old_block_hashes, old_block_idxs, i_am_the_longest_chain, force);

  } else {
    // await
    await this.addBlockToBlockchainSuccess(newlock, pos, i_am_the_longest_chain);
  }

}


/**
 * Nothing wrong with this block, continue to add it to the ledger
 *
 * @param {saito.block} newblock block to be added
 * @param {integer} pos position of block in indexes
 * @param {integer} i_am_the_longest_chain is block in longest chain
 * @param {boolean} force true if added from disk
 */
Blockchain.prototype.addBlockToBlockchainSuccess = async function addBlockToBlockchainSuccess(newblock, pos, i_am_the_longest_chain, force) {

  //
  // update newblock
  //
  if (i_am_the_longest_chain == 1) {
    this.app.wallet.onChainReorganization(newblock.block.id, newblock.returnHash(), i_am_the_longest_chain);
  }

  //
  // add slips to wallet
  //
  let updated_wallet = false;
  let publickey = this.app.wallet.returnPublicKey();
  for (let ti = 0; ti < newblock.transactions.length; ti++) {
    let slips = newblock.transactions[ti].returnSlipsToAndFrom(publickey);
    if (slips.to.length > 0 || slips.from.length > 0) {
      updated_wallet = true;
      this.app.wallet.processPayment(newblock, newblock.transactions[ti], slips.to, slips.from, i_am_the_longest_chain);
    }
  }
  if (updated_wallet) {
    if (i_am_the_longest_chain == 1) {
      this.app.wallet.calculateBalance();
      this.app.wallet.updateBalance();
    }
    this.app.modules.updateBalance();
    this.app.wallet.saveWallet();
    this.app.storage.saveOptions();
  }



  //
  // save block to disk
  //
  await this.app.storage.saveBlock(newblock, i_am_the_longest_chain);


  //
  // cleanup
  //
  this.app.mempool.removeBlockAndTransactions(newblock);

  //
  // delete transactions
  //
  //
  // we delete transaction data once blocks are old enough that
  // we no longer need their data for callbacks.
  //
  // note that block propagation to lite nodes fails if the callback
  // limit is too short and we don't have the block data actively
  // stored in memory.
  //
  if (this.blocks.length > this.callback_limit) {
    let blk2clear = this.blocks.length - this.callback_limit-1;
    if (blk2clear >= 0) {
      this.blocks[blk2clear].transactions = [];
      this.blocks[blk2clear].block.txsjson = [];
      // sanity check for blocks added earlier
      if (pos < blk2clear) {
        this.blocks[pos].transactions = [];
        this.blocks[pos].block.txsjson = [];
      }
    }
  }

  //
  // even if we are still running callbacks, we
  // don't need the JSON copies, just the objs
  //
  this.blocks[pos].block.txsjson = [];



  //
  // update transient chain
  //
  if (i_am_the_longest_chain == 1) {
    this.updateGenesisBlock(newblock, pos);
    if (newblock.block.id%this.fork_id_mod==0) { this.updateForkId(this.returnLatestBlock()); }
  }


  //
  // in storage.js we push any transactions from blocks we
  // created that are being undone back into the mempool
  // which is why we put it here -- we need to validate them
  // again.
  //
  this.app.mempool.reinsertRecoveredTransactions();


  //
  // module callback
  //
  if (!force) { this.app.modules.onNewBlock(newblock); }

  this.indexing_active = false;
  return 1;

};


/**
 * Something went wrong validating or adding our block, reverting
 *
 * @param {saito.block} newblock block
 * @param {integer} pos position of block in indexes
 * @param {integer} i_am_the_longest_chain is block in longest chain
 * @param {boolean} force true if added from disk
 */
Blockchain.prototype.addBlockToBlockchainFailure = function addBlockToBlockchainFailure(newblock, pos, i_am_the_longest_chain, force) {



this.app.logger.logInfo("about to update peer as failure: " + newblock.originating_peer + " for block: " + newblock.returnHash());

  console.log(" ... blockchain failure " + (new Date().getTime()));
//  this.app.logger.logInfo("Failed to validate LongestChain, blockchain failure");

  // restore longest chain
  this.index.lc[this.lc] = 0;
  delete this.block_hash_hmap[newblock.returnHash()];
  this.lc = this.old_lc;


  // reset miner
  this.app.miner.stopMining();
  let blk = this.returnLatestBlock();
  if (blk != null) { 
    this.app.miner.startMining(blk); 
  }


  //
  // save state
  //
  this.updateForkId(this.returnLatestBlock());
  this.app.storage.saveOptions();


  // remove bad everything
  this.app.mempool.removeBlockAndTransactions(newblock);

  // empty recovered array because we are not
  // removing anything after all...
  this.app.mempool.recovered = [];

  // resume normal operations
  this.indexing_active = false;
  return 1;

};




/**
 * Starts the process of unwinding the old longest chain and winding out
 * the new longest chain. This will lead to our blockchain either calling
 *
 * addBlockToBlockchainSuccess
 * addBlockToBlockchainFailure
 *
 * @param {saito.block} newblock
 * @param {pos} pos position in index
 * @param {int} shared_ancestor_pos position of shared ancestor
 * @param {array of integers} new_block_idxs array of new chain idxs
 * @param {array of strings} new_block_hashes array of new chain hashes
 * @param {array of integers} new_block_ids array of new chain ids
 * @param {array of integers} old_block_idxs array of old chain idxs
 * @param {array of strings} old_block_hashes array of old chain hashes
 * @param {array of integers} old_block_ids array of old chain ids
 * @param {integer} i_am_the_longest_chain is this block considered longest chain?
 * @param {boolean} force are we forcibly adding this block?
 */
Blockchain.prototype.validateLongestChain = async function validateLongestChain(
  newblock,
  pos,
  shared_ancestor_pos,
  new_block_idxs,
  new_block_hashes,
  new_block_ids,
  old_block_idxs,
  old_block_hashes,
  old_block_ids,
  i_am_the_longest_chain,
  force
) {

  //////////////////
  // lite-clients //
  //////////////////
  if (this.app.BROWSER == 1 || this.app.SPVMODE == 1) {

    //
    // unwind old chain
    //
    for (let x = 0; x < old_block_ids.length; x++) {
      this.app.storage.onChainReorganization(old_block_ids[x], old_block_hashes[x], 0);
      this.app.wallet.onChainReorganization(old_block_ids[x], old_block_hashes[x], 0);
      this.app.modules.onChainReorganization(old_block_ids[x], old_block_hashes[x], 0);
      this.app.blockchain.index.lc[old_block_idxs[x]] = 0;
    }

    //
    // -1 as we handle newblock in addBlockToBlockchainSuccess
    //
    for (let x = 0; x < new_block_ids.length-1; x++) {
      this.app.storage.onChainReorganization(new_block_ids[x], new_block_hashes[x], 1);
      this.app.wallet.onChainReorganization(new_block_ids[x], new_block_hashes[x], 1);
      this.app.modules.onChainReorganization(new_block_ids[x], new_block_hashes[x], 1);
      this.app.blockchain.index.lc[new_block_idxs[x]] = 1;
    }

    await this.app.blockchain.addBlockToBlockchainSuccess(newblock, pos, i_am_the_longest_chain, force);
    return;

  }

  ////////////////
  // full nodes //
  ////////////////
  try {
    if (old_block_hashes.length > 0) {
      await this.unwindChain(
        newblock,
        pos,
        shared_ancestor_pos,
        new_block_idxs,
        new_block_hashes,
        new_block_ids,
        old_block_idxs,
        old_block_hashes,
        old_block_ids,
        i_am_the_longest_chain,
        force,
        old_block_hashes.length-1,
        0
       );
    } else {
      await this.windChain(
        newblock,
        pos,
        shared_ancestor_pos,
        new_block_idxs,
        new_block_hashes,
        new_block_ids,
        old_block_idxs,
        old_block_hashes,
        old_block_ids,
        i_am_the_longest_chain,
        force,
        0,
        0
      );
    }

  } catch (err) {
    console.log(err);
  }
};



/**
 * Roll back the old longest chain and reset all of the slips in the
 * shashmap that were spent there to a fresh state so that our new
 * competing chain will have them available when it tries to roll
 * out (and validate) its proposed longest chain.
 *
 * once we have unwound the entire longest chain, we call the windChain
 * function which takes responsibility for rolling out, validating
 * and possibily restoring the oldest chain if there are issues.
 * @param {saito.block} newblock
 * @param {integer} pos
 * @param {integer} shared_ancestor_pos
 * @param {array} new_block_idxs
 * @param {array} new_block_hashes
 * @param {array} new_block_ids
 * @param {array} old_block_idxs
 * @param {array} old_block_hashes
 * @param {array} old_block_ids
 * @param {integer} i_am_the_longest_chain
 * @param {string} force
 * @param {integer} current_unwind_index
 * @param {integer} resetting_flag
 */
Blockchain.prototype.unwindChain = async function unwindChain(
  newblock,
  pos,
  shared_ancestor_pos,
  new_block_idxs,
  new_block_hashes,
  new_block_ids,
  old_block_idxs,
  old_block_hashes,
  old_block_ids,
  i_am_the_longest_chain,
  force,
  current_unwind_index,
  resetting_flag
) {

  if (old_block_hashes.length > 0) {

    let blk = await this.returnBlockByHash(old_block_hashes[current_unwind_index]);
    if (blk == null) {

      console.log("We cannot find a block on disk that should exist in unwindChain");

      //
      // we need to unwind some of our previously
      // added blocks from the new chain and wind
      // the old blocks back out....
      //
      var response           = {};
      response.request       = "missing block";
      response.data          = {};
      response.data.hash     = old_block_hashes[current_unwind_index];
      response.data.lasthash = "";
      storage_self.app.network.sendRequest(response.request, JSON.stringify(response.data));

      //
      // handle gracefully so as not to trigger errors
      //
      console.log("\n\n\n\n\nCRITICAL ERROR: " + current_unwind_index);
      console.log(JSON.stringify(response));
      console.log(JSON.stringify(old_block_hashes));
      this.addBlockToBlockchainFailure(newblock, pos, i_am_the_longest_chain, force);

      return;
    }


    this.app.storage.onChainReorganization(blk.block.id, blk.returnHash(), 0);
    this.app.wallet.onChainReorganization(blk.block.id, blk.returnHash(), 0);
    this.app.modules.onChainReorganization(blk.block.id, blk.returnHash(), 0);
    this.index.lc[old_block_idxs[current_unwind_index]] = 0;

    //
    // if we are the node that produced this block, we catch any transactions
    // that were added to it. we want to add these transactions back into our
    // mempool once the chain has been rewritten if their inputs are still
    // valid.
    //
    if (this.app.wallet.returnPublicKey() == blk.block.creator) {
      //
      // a block that we created is getting undone, so we push all of the
      // transactions into a special queue that exists in our mempool for
      // us to check once we have finished re-writing the chain.
      //
      if (blk.transactions != null) {
        for (let i = 0; i < blk.transactions.length; i++) {
          this.app.mempool.recoverTransaction(blk.transactions[i]);
        }
      }
    }

    blk.unspendInputs();

    //
    // we either move on to our next block, or we hit
    // the end of the chain of blocks to unspend and
    // move on to wind the proposed new chain
    //
    if (current_unwind_index == 0) {
      await this.windChain(newblock, pos, shared_ancestor_pos, new_block_idxs, new_block_hashes, new_block_ids, old_block_idxs, old_block_hashes, old_block_ids, i_am_the_longest_chain, force, 0, resetting_flag);
    } else {
      await this.unwindChain(newblock, pos, shared_ancestor_pos, new_block_idxs, new_block_hashes, new_block_ids, old_block_idxs, old_block_hashes, old_block_ids, i_am_the_longest_chain, force, current_unwind_index-1, resetting_flag);
    }
  } else {

    //
    // no more old_hashes blocks
    //
    await this.windChain(newblock, pos, shared_ancestor_pos, new_block_idxs, new_block_hashes, new_block_ids, old_block_idxs, old_block_hashes, old_block_ids, i_am_the_longest_chain, force, 0, resetting_flag);
  }

}



/**
 * Roll out a proposed longest chain and validate that the transaction
 * slips are all valid and unspent, and that other things like the
 * golden tickets and monetary policy.
 *
 * If we run into problems rolling out the new chain, we unroll it
 * and roll the old chain back out again, remembering to set the
 * resetting_flag to 1 so that we can report back that the chain
 * reorganization attempt failed once we are done.
 *
 * once all of the new blocks are rolled out, we send control back
 * to the blockchain class to finish either rolling out the new
 * block or to reset the chain condition so that it is ready to
 * process the next block.
 *
 * addBlockToBlockchainSuccess --> on success
 * addBlockToBlockchainFailure --> on failure
 *
 * @param {saito.block} newblock newest block
 * @param {interger} pos newest block index in blockchain.index
 * @param {integer} shared_ancestor_pos block index of last-common-ancestor blockchain.index
 * @param {array} new_block_idxs sarray of block indexes for new blocks becoming longest chain
 * @param {array} new_block_hashes array of block hashes for new blocks becoming longest chain
 * @param {array} new_block_ids array of block_ids for new blocks becoming longest chain
 * @param {array} old_block_idxs array of block indexes for existing blocks losing longest chain
 * @param {array} old_block_hashes array of block hashes for existing blocks losing longest chain
 * @param {array} old_block_ids array of block_ids for existing blocks losing longest chain
 * @param {integer} i_am_the_longest_chain is newest block longest chain (should be 1)
 * @param {string} force if block is loaded from disk
 * @param {integer} current_wind_index position in above old_block_* arrays of this block
 * @param {integer} resetting_flag 1 if we are unwinding a bad new chain
 **/
Blockchain.prototype.windChain = async function windChain(
  newblock,
  pos,
  shared_ancestor_pos,
  new_block_idxs,
  new_block_hashes,
  new_block_ids,
  old_block_idxs,
  old_block_hashes,
  old_block_ids,
  i_am_the_longest_chain,
  force,
  current_wind_index,
  resetting_flag
) {

  let this_block_hash = new_block_hashes[current_wind_index];

  //
  // we have not saved the latest block to disk yet, so
  // there's no need to go through the delay of opening
  // files from disk.
  //
  if (this_block_hash == newblock.returnHash()) {
    let block_validates = await newblock.validate();
    if (block_validates == 1) {

      //
      // we do not handle onChainReorganization for everything
      // here as we do for older blocks. the reason for this is
      // that the block is not yet saved to disk.
      //
      // onChainReorganization is run on addBlockToBlockchainSuccess
      //
      newblock.spendInputs();
      await this.addBlockToBlockchainSuccess(newblock, pos, i_am_the_longest_chain, force);
      return;

    } else {

      if (current_wind_index == 0) {

        // this is the first block we have tried to add
        // and so we can just roll out the older chain
        // again as it is known good.
        //
        // note that old and new hashes are swapped
        // and the old chain is set as null because
        // we won't move back to it. we also set the
        // resetting_flag to 1 so we know to fork
        // into addBlockToBlockchainFailure.
        //
        if (old_block_hashes.length > 0) {
          await this.windChain(newblock, pos, shared_ancestor_pos, old_block_idxs, old_block_hashes, old_block_ids, null, null, null, i_am_the_longest_chain, force, 0, 1);
          return;
        } else {
          await this.addBlockToBlockchainFailure(newblock, pos, i_am_the_longest_chain, force);
          return;
        }
      } else {

        //
        // we need to unwind some of our previously
        // added blocks from the new chain. so we
        // swap our hashes to wind/unwind.
        //
        var chain_to_unwind_hashes = new_block_hashes.splice(current_wind_index);
        var chain_to_unwind_idxs   = new_block_idxs.splice(current_wind_index);
        var chain_to_unwind_ids    = new_block_ids.splice(current_wind_index);

        //
        // unwind NEW and wind OLD
        //
        // note that we are setting the resetting_flag to 1
        //
        await this.unwindChain(newblock, pos, shared_ancestor_pos, old_block_idxs, old_block_hashes, old_block_ids, chain_to_unwind_idxs, chain_to_unwind_hashes, chain_to_unwind_ids, i_am_the_longest_chain, force, chain_to_unwind_hashes.length, 1);

      }
    }

  //
  // this is not the latest block, so we need to
  // fetch it from disk, and then do exactly the
  // same thing as above, essentially.
  //
  } else {

    var blk = await this.returnBlockByHash(new_block_hashes[current_wind_index]);
    if (blk == null) {
       console.log("Cannot open block that should exist in windChain");
       this.app.logger.logError("Cannot open block that should exist in windChain", { message: "", stack: "" });
       process.exit();
    }

    let block_validates = await blk.validate();
    if (block_validates == 1) {

      this.app.storage.onChainReorganization(blk.block.id, blk.returnHash(), 1);
      this.app.wallet.onChainReorganization(blk.block.id, blk.returnHash(), 1);
      this.app.modules.onChainReorganization(blk.block.id, blk.returnHash(), 1);
      this.app.blockchain.index.lc[new_block_idxs[current_wind_index]] = 1;

      blk.spendInputs();

      if (current_wind_index == new_block_idxs.length-1) {
        if (resetting_flag == 0) {
          await this.addBlockToBlockchainSuccess(newblock, pos, i_am_the_longest_chain, force);
        } else {
          await this.addBlockToBlockchainFailure(newblock, pos, i_am_the_longest_chain, force);
        }
      } else {
        this.windChain(newblock, pos, shared_ancestor_pos, new_block_idxs, new_block_hashes, new_block_ids, old_block_idxs, old_block_hashes, old_block_ids, i_am_the_longest_chain, force, current_wind_index+1, resetting_flag);
        return;
      }

      await this.addBlockToBlockchainSuccess(newblock, pos, i_am_the_longest_chain, force);



    } else {

      if (current_wind_index == 0) {
        await this.windChain(newblock, pos, shared_ancestor_pos, old_block_idxs, old_block_hashes, old_block_ids, null, null, null, i_am_the_longest_chain, force, 0, 1);
      } else {
        var chain_to_unwind_hashes = new_block_hashes.splice(current_wind_index);
        var chain_to_unwind_idxs   = new_block_idxs.splice(current_wind_index);
        var chain_to_unwind_ids    = new_block_ids.splice(current_wind_index);
        await this.unwindChain(newblock, pos, shared_ancestor_pos, old_block_idxs, old_block_hashes, old_block_ids, chain_to_unwind_idxs, chain_to_unwind_hashes, chain_to_unwind_ids, i_am_the_longest_chain, force, chain_to_unwind_hashes.length, 1);
      }
    }
  }
}




/**
 * Checks if the hash has previosly been indexed
 * @param {string} hash
 */
Blockchain.prototype.isHashIndexed = function isHashIndexed(hash) {
  if (this.block_hash_hmap[hash] > 0) { return true; }
  return false;
};

/**
 * Binary Insert algorithm
 * @param {array} list
 * @param {string} item
 * @param {string} compare
 * @param {string} search
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
 * @param {saito.block} newestblk
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
 * returns the block with the specified hash if exists
 * @param {string} hash
 * @returns {saito.block} block
 */
Blockchain.prototype.returnBlockByHash = async function returnBlockByHash(hash) {

  let block = null;

  //
  // first check our in-memory blocks
  //
  if (this.isHashIndexed(hash)) {
    for (let v = this.blocks.length-1; v >= 0; v-- ) {
      if (this.blocks[v].hash == hash) {
        return this.blocks[v];
      }
    }
  }

  //
  // or fetch from disk
  //
  block = await this.app.storage.loadSingleBlockFromDisk(hash);

  return block;

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




/**
 * when the blockchain hits a certain length we throw out all of our older blks
 * this is possible because block ids are incremental. We do check our last fork_guard
 * blocks to make sure there is not a block that might reference one of the
 * blocks we are throwing out before we purge ourselves of them.
 *
 * @params {saito.block} block
 * @params {integer} position in index
 */
Blockchain.prototype.updateGenesisBlock = function updateGenesisBlock(blk, pos) {

  //
  // we need to make sure this is not a random block that is disconnected
  // from our previous genesis_id. If there is no connection between it
  // and us, then we cannot delete anything as otherwise the provision of
  // the block may be an attack on us intended to force us to discard
  // actually useful data.
  //
  // we do this by checking that our block is the head of the
  // verified longest chain.
  //
  if (this.index.hash[this.lc] != blk.returnHash('hex')) { return pos; }
  if (this.index.hash.length < this.genesis_period) { return pos; }

  if (blk.returnId() >= (this.genesis_bid + this.genesis_period + this.fork_guard)) {

    //
    // check the fork guard period to see if there is a viable
    // competing chain. If there is we must assume there may be
    // a viable competing chain to preserve
    //
    let is_there_a_challenger = 0;
    let our_block_id    = blk.returnId();
    //
    // -1 accounts for the fact we reclaim the funds from unspent
    // golden tickets, and need to know for sure that those slips
    // have not been spent when we calculate getting them back
    // into circulation. So we keep an extra block on the tail
    // end, even if it is unspendable, for validation
    //
    let lowest_block_id = our_block_id - this.genesis_period - 1;

    //
    // do not delete if our new genesis block would be less than zero
    //
    if (lowest_block_id <= 0) { return; }

    //
    // otherwise, figure out what the lowest block ID is that would
    // be possible to grow into a viable fork. We do this by looking
    // at our recently produced blocks. The fork guard here is an
    // arbitrary constant.
    //
    for (let c = 2; c <= this.fork_guard && c < this.index.bid.length; c++) {
      if (this.index.bid[this.index.bid.length-c] < lowest_block_id) {
        lowest_block_id = this.index.bid[this.index.bid.length-2];
      }
    }

    //
    // this is needed before update genesis_block_id to ensure
    // wallet slips are updated properly (they are updated in
    // purgeArchivedData but require a new genesis_period to
    // calculate, so much udpate genesis_period and THEN purge,
    // meaning this calculation must be stored
    //
    let purge_id = lowest_block_id - this.genesis_period;

    //
    // finally, update our genesis block_id to the current_block minus
    // the genesis period. We will run this function again when the
    // fork guard has passed, and if any forks have not sufficiently
    // kept pace in that time, they will be discarded them.
    //
    this.genesis_block_id = blk.returnId() - this.genesis_period;

    //
    // in either case, we are OK to throw out everything below the
    // lowest_block_id that we have found, since even the lowest
    // fork in our guard_period will not need to access transactions
    // from before itself and the genesis period.
    //
    // we use the purge_id variable since our functions inside
    // need to delete from wallet slips, which requires genesis
    // block_id to be set properly.
    //
    return this.purgeArchivedData(purge_id, pos);

  }

  return pos;
}



/**
 * this is called whenever we add a block to our blockchain. it
 * calculates how many blocks we can discard and dumps them.
 *
 * @params {integer} id of lowest block to keep
 * @params {integer} position of lowest block in index
 * @returns {integer} new position of lowest block in index
 *
**/
Blockchain.prototype.purgeArchivedData = function purgeArchivedData(lowest_block_id, pos) {

  let items_before_needed = 0;

  //
  // find the number of items in our blockchain before
  // we run into the lowest_block_id. Remember that blocks
  // are going to be sequential so it is only forks that
  // we really worry about
  //
  for (let x = 0; x < this.index.bid.length; x++) {
    if (this.index.bid[x] < lowest_block_id) {
      items_before_needed++;
    }
    else { x = this.blocks.length; }
  }

  /////////////////////////
  // delete from storage //
  /////////////////////////
  //
  // slips / file / database
  //
  for (let b = 0; b < items_before_needed; b++) {
    this.app.storage.deleteBlock(this.index.bid[b], this.index.hash[b], this.index.lc[b]);
  }


  /////////////////////////
  // delete from hashmap //
  /////////////////////////
  for (let x = 0; x < items_before_needed; x++) {
    let bh = this.index.hash[x];
    delete this.block_hash_hmap[bh];
  }


  ////////////////////////////////////////////////
  // delete from fast-access indexes and blocks //
  ////////////////////////////////////////////////
  this.index.hash.splice(0, items_before_needed);
  this.index.prevhash.splice(0, items_before_needed);
  this.index.bid.splice(0, items_before_needed);
  this.index.mintid.splice(0, items_before_needed);
  this.index.maxtid.splice(0, items_before_needed);
  this.index.ts.splice(0, items_before_needed);
  this.index.bf.splice(0, items_before_needed);
  this.index.lc.splice(0, items_before_needed);
  this.blocks.splice(0, items_before_needed);

  var newpos = pos - items_before_needed;


  //////////////////
  // and clean up //
  //////////////////
  this.lc = this.lc - items_before_needed;
  this.app.wallet.purgeExpiredSlips();

  return newpos;

}



//////////////////
// updateForkId //
//////////////////
//
// @params {saito.block} new block
//
Blockchain.prototype.updateForkId = function updateForkId(blk) {

  if (blk == null) { return this.fork_id; }

  let baseblockid = blk.returnId();
  let fork_id     = "";
  let indexpos    = this.index.hash.length-1;

  // roll back to known fork ID measurement
  for (let x = baseblockid; x >= 0; x--) {
    if (x%this.fork_id_mod == 0) {
      baseblockid = x;
      x = -1;
    }
  }

  for (let i = 0, stop = 0; stop == 0 && i < this.genesis_period;) {

    let checkpointblkid = baseblockid-i;
    indexpos = this.returnLongestChainIndexArray(checkpointblkid, indexpos);

    if (indexpos == -1 || checkpointblkid < 0) { stop = 1; }
    else {
      let th = this.index.hash[indexpos];
      fork_id += th.substring(0,2);
    }


    // if this is edited, we have to
    // also change the function
    //
    // - returnLastSharedBlockId
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



