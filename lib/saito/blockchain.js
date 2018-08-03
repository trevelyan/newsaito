//
// we do not 'use strict' in this class because
// we need to delete items from our hashmaps when
// purging blocks.
//
const saito    = require('../saito');
const Big      = require('big.js');

/////////////////
// Constructor //
/////////////////
function Blockchain(app) {

  if (!(this instanceof Blockchain)) { return new Blockchain(app); }

  this.app      = app || {};

  this.blocks   = [];

  return this;

}
module.exports = Blockchain;

Blockchain.prototype.returnLastBlockInChain = function returnLastBlockInChain() {
  // if (this.blocks.length == 0) {
  //   return new saito.block(this.app);
  // } else {
  // }
  return this.blocks[this.blocks.length - 1]
}

Blockchain.prototype.validateBlockAndQueueInMempool = function validateBlockAndQueueInMempool(blk, relay_on_validate=1) {

  var blockchain_self = this;

  //////////////////////
  // check if indexed //
  //////////////////////
  if ( this.isHashIndexed( blk.returnHash() ) == 1 ) {
    this.app.logger.logError(`Hash is already indexed: ${blk.returnHash()}`,
      {message:"",err:""});
    return 0;
  }


  ////////////////////
  // validate block //
  ////////////////////
  if (! blk.validate() ) {
    this.app.logger.logInfo(`Block does not validate!!!`)
    blockchain_self.app.mempool.removeBlock(blk);

    this.app.logger.logInfo(`INVALID BLOCK HASH: ${blk.returnHash()}`)
    blk.block.transactions = [];
    blk.transactions = [];

    this.app.logger.logInfo(JSON.stringify(blk.block, null, 4))
    return 0;
  }


  //////////////////////////////
  // validate reclaimed funds //
  //////////////////////////////
  blockchain_self.currently_reclaiming = 1;
  blk.validateReclaimedFunds(function(reclaimFundsValidated) {

    if (!reclaimFundsValidated) {
      console.log("Reclaimed Funds found invalid");
      blockchain_self.app.logger.logError("Reclaimed Funds found invalid",
        {message:"",err:""});

      blockchain_self.app.mempool.removeBlock(blk);
      blockchain_self.currently_reclaiming = false;
      return false;
    }

    ///////////////////////////////
    // add to FIFI mempool queue //
    ///////////////////////////////
    if ( !blockchain_self.app.mempool.addBlock(blk) ) {
      blockchain_self.currently_reclaiming = false;
      return false;
    }

    ///////////////
    // propagate //
    ///////////////

    /////////////
    // process //
    /////////////
    blockchain_self.currently_reclaiming = 0;
    blockchain_self.app.mempool.processBlocks();

  });

}

Blockchain.prototype.addBlockToBlockchain = function addBlockToBlockchain(newblock, forceAdd="no") {

  var blockchain_self = this;

  //
  // are we ready to add another block?
  //
  if (this.app.monitor.readyToAddBlockToBlockchain()) {
    this.app.logger.logInfo(`waiting to addBlockToBlockchain for: ${newblock.returnHash()}`)
    return false;
  } else {
    this.currently_indexing = true;
  }


  //
  // sanity check
  //
  if (newblock == null || newblock.is_valid == 0) {
    console.log("BLOCK IS INVALID");
    this.app.logger.logError("BLOCK IS INVALID",{message:"",err:""});
    this.currently_indexing = false;
    return true;
  }

  //
  // another sanity check
  //
  // TODO - hunt this down
  //
  // there is some edge case where we will produce a block #1
  // from OUR mempool and set it as the longest chain even if
  // we already have a longest chain. So we refuse to add a
  // block #1 if we already have any blocks in our queue.
  //
  // worst case is that some other blocks now need to start from
  // block 2 when syncing if they receive block #1 later than
  // a subsequent block;
  //
  //if (newblock.block.id == 1 && this.index.hash.length > 0) {
  //  console.log("ERROR: caught block #1 being produced!");
  //  console.log(JSON.stringify(newblock.block));
  //  process.exit();
  //  return 1;
  //}


  var blockchain_self = this;

  let hash                  = newblock.returnHash('hex');
  let ts                    = newblock.block.unixtime;
  let prevhash              = newblock.block.prevhash;
  let block_id              = newblock.block.id;
  let old_longestChain      = this.longestChain;
  this.old_lc               = this.longestChain;


  //
  // we can delete this, just using it to get a sense
  // of how long various parts of block processing take
  // for optimization purposes
  //
  var startTime = new Date().getTime();
  blockchain_self.app.logger.logInfo(`START TIME: ${startTime}`);
  blockchain_self.app.logger.logInfo(`Adding block ${block_id} -> ${hash} ${newblock.block.unixtime}`)

  //
  // if the timestamp for this block is BEFORE our genesis block, we
  // refuse to process it out of principle. Our sorting algorithm will
  // still accept orphan chains that post-date our genesis block, but
  // will not try to connect them with the chain. it is a requirement
  // that the first block we receive is part of the valid longest chain
  //
  // we should implement something in the future that allows us to be
  // notified in the rare case there is a reorganization that pushes
  // our initial block out-of-sync. This will not happen to a node that
  // has a fully genesis period of blocks though, and has checked that
  // it is valid, so it is not a priority.
  //
  // this prevents us trying to load blocks endlessly into the past as
  // we find references to previous block hashes that we do not have
  // indexed in the historical blocks we are onboarding.
  //
  if (ts < this.genesis_ts) {
    if (forceAdd != "force") {
      this.currently_indexing = false;
      return true;
    }
  }
  if (this.isHashIndexed(hash) == 1) {
    this.currently_indexing = false;
    return true;
  }


  ////////////////////
  // missing blocks //
  ////////////////////
  //
  // if we are adding our first block, we set this as
  // the ts_limit to avoid requesting missing blocks
  // ad infinitum into the past. we update the blk_limit
  // variable so the storage class can check what our
  // earliest block_id is.
  //
  if (this.ts_limit == -1) {
    this.blk_limit = block_id;
    if (this.app.options.blockchain != null) {
      this.ts_limit = this.previous_ts_limit;
    }
    if (this.ts_limit == -1) {
      this.ts_limit = newblock.block.unixtime;
    }
  } else {
    if (this.ts_limit > newblock.block.unixtime && forceAdd != "no") {
      this.ts_limit = newblock.block.unixtime;
    }
  }

  //
  // if our previous block hash was not indexed we request the missing
  // block unless its timestamp is going to precede our first block
  // and genesis block, in which case we don't need it.
  //
  // if (prevhash != "") {
  //   if (this.ts_limit <= newblock.block.unixtime) {
  //     if (this.isHashIndexed(prevhash) == -1) {

  //       // update peer reliability
  //       this.app.network.updatePeerReliability(newblock.originating_peer, "last_block_connected", -1);

  //       var response           = {};
  //       response.request       = "missing block";
  //       response.data          = {};
  //       response.data.hash     = prevhash;
  //       response.data.lasthash = this.returnLatestBlockHash();
  //       this.app.network.sendRequest(response.request, JSON.stringify(response.data));
  //     }
  //   }
  // }
  // else {
  this.app.logger.logInfo(`1 -- TRIGGERING UPDATE HERE`)

  // if (this.isHashIndexed(prevhash) == -1) {
  //   // update peer reliability
  //   this.app.network.updatePeerReliability(newblock.originating_peer, "last_block_connected", 1);
  // }
  // }



  ////////////////////
  // insert indexes //
  ////////////////////
  var pos = this.binaryInsert(this.index.ts, ts, function(a,b) { return a -b;});
  this.index.hash.splice(pos, 0, hash);
  this.index.prevhash.splice(pos, 0, prevhash);
  this.index.block_id.splice(pos, 0, block_id);
  this.index.maxtid.splice(pos, 0, newblock.returnMaxTxId());
  this.index.mintid.splice(pos, 0, newblock.returnMinTxId());
  this.index.lc.splice(pos, 0, 0);              // set longest chain to 0 until we know it is longest chain
  this.index.burnfee.splice(pos, 0, newblock.returnBurnFee());
  this.index.feestep.splice(pos, 0, newblock.returnFeeStep());
  this.block_hashmap[hash] = block_id;
  this.blocks.splice(pos, 0, newblock);



  //////////////////////////////////////////////////////////
  // if this is our first block, it is longest by default //
  //////////////////////////////////////////////////////////
  if (this.longestChain == -1) { this.longestChain = 0; }


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
  newblock.decryptTransactions();



  ///////////////////////////
  // calculate average fee //
  ///////////////////////////
  newblock.returnAverageFee();


  /////////////////////
  // affix callbacks //
  /////////////////////
  this.blocks[pos].affixCallbacks();


  /////////////////////////////
  // track the longest chain //
  /////////////////////////////
  var i_am_the_longest_chain    = false;
  var shared_ancestor_index_pos = -1;
  var validate_transactions     = -1;
  var rewrite_longest_chain     = 0;
  var rewrite_nchain_len        = 0;
  var rewrite_lchain_len        = 0;
  var rewrite_forceAdd          = "";
  var rewrite_from_start        = 1; // see below
  //
  // possibly adjust longestChain forward
  // if we stuck our block earlier in a
  // position earlier in the chain
  //
  if (pos <= this.longestChain) {
    this.longestChain++;
    if (this.longestChain >= this.index.hash.length) {
      this.longestChain--;
    }
  }

  //
  // if we are the genesis block, we are the longest chain
  //
  if (prevhash == "" && this.index.prevhash.length == 1) {
    this.longestChain = 0;
    i_am_the_longest_chain = true;
  }

  //
  // first block from reset blockchains
  //
  if (this.previous_block_id != null) {
    if (this.index.hash.length == 1 && this.previous_block_id == newblock.returnId()-1) {
      this.longestChain = 0;
      i_am_the_longest_chain = true;
    }
  }



  // TESTING
  //
  // this is a workaround for lite-clients just joining the 
  // network that rejoin and resync the blockchain out-of-order
  // and consequently lose tokens they have already received. 
  //
  // we need to get this all polished in a re-write but for now
  // this should be less frustrating to lite-clients
  //
  if (hash == this.returnLatestBlockHash()) {
    i_am_the_longest_chain = true;
    this.longestChain = pos;
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

  if (block_id >= this.index.block_id[this.longestChain]) {
    if (prevhash == this.index.hash[this.longestChain] || prevhash == this.previous_block_hash) {

      // if prev is longest
      this.longestChain = pos;
      i_am_the_longest_chain = true;
      validate_transactions = 1;

    } else {

      //
      // otherwise, we find the last shared ancestor and
      // calculate the length and aggregate burn fee of
      // the two competing chains to determine which is
      // preferred
      //

      var lchain_pos = this.longestChain;
      var nchain_pos = pos;
      var lchain_len = 0;
      var nchain_len = 0;
      var lchain_brn = this.index.burnfee[lchain_pos];
      var nchain_brn = this.index.burnfee[nchain_pos];
      var lchain_ts  = this.index.ts[lchain_pos];
      var nchain_ts  = this.index.ts[nchain_pos];
      var lchain_ph  = this.index.prevhash[lchain_pos];
      var nchain_ph  = this.index.prevhash[nchain_pos];

      var search_pos = null;
      var search_ts  = null;
      var search_hash= null;
      var search_ph  = null;
      var search_brn = null;

      var ancestor_precedes_current = 0;

      if (nchain_ts >= lchain_ts) {
        search_pos = nchain_pos-1;
      } else {
        ancestor_precedes_current = 1;
        search_pos = lchain_pos-1;
      }

      while (search_pos >= 0) {

        search_ts    = this.index.ts[search_pos];
        search_hash  = this.index.hash[search_pos];
        search_ph    = this.index.prevhash[search_pos];
        search_brn   = this.index.burnfee[search_pos];

        if (search_hash == lchain_ph && search_hash == nchain_ph) {
          shared_ancestor_index_pos = search_pos;
          search_pos = -1;
        } else {
          if (search_hash == lchain_ph) {
            lchain_len++;
            lchain_ph   = this.index.prevhash[search_pos];
  	        lchain_brn  = parseFloat(lchain_brn) + parseFloat(this.index.burnfee[search_pos]);
          }
          if (search_hash == nchain_ph) {
            nchain_ph    = this.index.prevhash[search_pos];
            nchain_len++;
            // this may be inexact, but as long as javascript errors
            // work the same way on all machines... i.e. hack but
            // good enough for now
            nchain_brn  = parseFloat(nchain_brn) + parseFloat(this.index.burnfee[search_pos]);
          }
          shared_ancestor_index_pos = search_pos;
          search_pos--;
        }
      }


      if (nchain_len > lchain_len && nchain_brn >= lchain_brn) {

        //
        // to prevent our system from being gamed, we
        // require the attacking chain to have equivalent
        // or greater aggregate burn fees. This ensures that
        // an attacker cannot lower difficulty, pump out a
        // ton of blocks, and then hike the difficulty only
        // at the last moment.
        //

        this.app.logger.logInfo(`UPDATING LONGEST CHAIN: ${nchain_len} new |||||| ${lchain_len} old 1`);

        i_am_the_longest_chain = true;
        rewrite_longest_chain  = 1;
        rewrite_nchain_len     = nchain_len;
        rewrite_lchain_len     = lchain_len;
        rewrite_forceAdd       = forceAdd;
        validate_transactions  = nchain_len;

      } else {

        //
        // we have a choice of which chain to support, and we
       	// support whatever chain matches our preferences
        //
        if (nchain_len == lchain_len && nchain_brn >= lchain_brn) {

          latestBlock = this.returnLatestBlock();
          if (latestBlock != null) {
            if (this.app.voter.prefers(newblock, latestBlock)) {

              this.app.logger.logInfo(`UPDATING LONGEST CHAIN W/ PREFERENCE: ${nchain_len} new |||||| ${lchain_len} old 2`);

              i_am_the_longest_chain = true;
              rewrite_longest_chain  = true;
              rewrite_nchain_len     = nchain_len;
              rewrite_lchain_len     = lchain_len;
              rewrite_forceAdd       = forceAdd;
              validate_transactions  = nchain_len;

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
    if (newblock.block.prevhash == this.previous_block_hash && newblock.block.prevhash != "") {

      // reset later blocks to non-longest chain
      for (let h = pos+1; h < this.index.lc.length; h++) {
        this.index.lc[h] = 0;
        this.app.storage.onChainReorganization(this.index.block_id[h], this.index.hash[h], 0);
        this.app.wallet.onChainReorganization(this.index.block_id[h], this.index.hash[h], 0);
        this.app.modules.onChainReorganization(this.index.block_id[h], this.index.hash[h], 0);
      }

      // insist that I am the longest chain
      i_am_the_longest_chain = true;
      this.previous_block_hash = hash;
      this.longestChain = pos;
      this.app.modules.updateBalance();

      //
      // we do not need to worry about updating the slips
      //
      // the blocks we reset will be reset as lc = 1 when
      // the next block comes in that has a full chain
      // starting from this block
      //

    }
  }


  ////////////////////////////////
  // validate the longest chain //
  ////////////////////////////////

  //
  // if we are on the longest chain we have to validate our transaction
  // slips. In order to do this, we creep through the number of blocks
  // on the new_chain and validate them one-by-one. We must revalidate
  // starting from the oldest block in order to be sure that our sliips
  // are all valid.
  //
  // if there is a problem validating a block, we reset ourselves
  // to the previous longest chain and abort the entire process,
  // so that we never even hit the block purge and/or callback stage
  //
  // if a block is not on the longest chain, we skip the validation
  // and move on to adding inputs to wallets, etc.
  //

  if (i_am_the_longest_chain) {

    //////////////////
    // reset miners //
    //////////////////
    this.longestChain = pos;
    this.index.lc[pos] = 1;
    this.app.miner.stopMining();

    this.app.miner.startMining(newblock);
    this.app.options.blockchain = this.returnBlockchain();

    // update blockchain sync for modules
    this.app.modules.updateBlockchainSync(newblock.block.id, this.returnTargetBlockId());

    this.app.storage.saveOptions();


    //////////////////////////////////////////
    // get hashes and indexes of two chains //
    //////////////////////////////////////////
    var shared_ancestor_hash = this.index.hash[shared_ancestor_index_pos];

    //
    // we are trying to catch an eddge-case for browsers that
    // receive blocks in the wrong order, and only start marking
    // blocks as part of the longest chain once they have
    //
    // in this case LC should be set at ZERO from this (our first)
    // LC-identified block back to the -1 point of origin
    //
    if (shared_ancestor_index_pos == -1 && this.index.lc[0] == 0) {
      //
      // if last 10 LC are all zero....
      // we are probably in a bad browser
      // sync which may affect some UTXI
      // inputs....
      //
      for (let g = pos-1, h = 1; g >= 0, h <= 10; h++, g--) {
        if (this.index.lc[g] == 1) {
	        rewrite_from_start = 0;
        }
      }

      //
      // quick fix - we should check and only do this to nodes in the
      // longest chain, but for now since this affects lite-clients
      // only we just approve anything before the longest chain
      //
      if (rewrite_from_start == 1 && this.blocks.length > 0) {

        var thisprevblk = null;
        var thisnewblk  = this.blocks[0];
	      if (blockchain_self.app.storage.validateBlockInputs(thisnewblk, null, 1) == 1) {

          blockchain_self.app.storage.spendBlockInputs(thisnewblk);
          blockchain_self.app.storage.onChainReorganization(thisnewblk.block.id, thisnewblk.returnHash(), 1);
          blockchain_self.app.wallet.onChainReorganization(thisnewblk.block.id, thisnewblk.returnHash(), 1);
          blockchain_self.app.modules.onChainReorganization(thisnewblk.block.id, thisnewblk.returnHash(), 1);
          this.index.lc[0] = 1;
          this.lc_hashmap[thisnewblk.returnHash()] = 1;


          for (let d = 1; d <= pos; d++) {

            thisprevblk = thisnewblk;
            thisnewblk  = this.blocks[d];

	          if (blockchain_self.app.storage.validateBlockInputs(thisnewblk, null, 1) == 1) {
              blockchain_self.app.storage.spendBlockInputs(thisnewblk);
              blockchain_self.app.storage.onChainReorganization(thisnewblk.block.id, thisnewblk.returnHash(), 1);
              blockchain_self.app.wallet.onChainReorganization(thisnewblk.block.id, thisnewblk.returnHash(), 1);
              blockchain_self.app.modules.onChainReorganization(thisnewblk.block.id, thisnewblk.returnHash(), 1);
              this.index.lc[d] = 1;
              this.lc_hashmap[thisnewblk.returnHash()] = 1;
              old_longestChain = d;
            } else {
            }
          }
        }
      }
    }


    var new_hash_to_hunt_for = newblock.returnHash('hex');
    var new_block_hashes     = [];
    var new_block_idxs       = [];
    var new_block_ids        = [];
    var old_hash_to_hunt_for = this.index.hash[old_longestChain];
    var old_block_hashes     = [];
    var old_block_idxs       = [];
    var old_block_ids        = [];


    if (newblock.block.prevhash == old_hash_to_hunt_for) {

      // we have no competing chain, just the
      // new block claiming to be building on
      // the existing chain
      new_block_hashes.push(this.index.hash[pos]);
      new_block_idxs.push(pos);
      new_block_ids.push(this.index.block_id[pos]);

    } else {

      ///////////////////////
      // old longest chain //
      ///////////////////////
      for (let j = this.index.hash.length-1; j > shared_ancestor_index_pos; j--) {
        if (this.index.hash[j] == old_hash_to_hunt_for) {
          old_hash_to_hunt_for = this.index.prevhash[j];
          old_block_hashes.push(this.index.hash[j]);
          old_block_idxs.push(j);
          old_block_ids.push(this.index.block_id[j]);
        }
      }
      old_block_hashes.reverse();
      old_block_idxs.reverse();

      ///////////////////////
      // new longest chain //
      ///////////////////////
      for (let j = this.index.hash.length-1; j > shared_ancestor_index_pos; j--) {
        if (this.index.hash[j] == new_hash_to_hunt_for) {
          new_hash_to_hunt_for = this.index.prevhash[j];
          new_block_hashes.push(this.index.hash[j]);
          new_block_idxs.push(j);
          new_block_ids.push(this.index.block_id[j]);
        }
      }
      new_block_hashes.reverse();
      new_block_idxs.reverse();

    }

    //
    // we are longest chain, so we have to unwind the old chain
    // and wind the new chain. If there is no old chain we will
    // just wind the new chain directly.
    //
    // LOG INFO
    this.app.storage.validateLongestChain(newblock, pos, shared_ancestor_index_pos, new_block_idxs, new_block_hashes, new_block_ids, old_block_idxs, old_block_hashes, old_block_idxs, i_am_the_longest_chain, forceAdd);

  } else {

    //
    // we are not longest-chain, so we jump directly
    // to the second part of the block addition
    //
    this.app.logger.logInfo(` ... direct to part II...`);
    // LOG INFO
    this.addBlockToBlockchainPartTwo(newblock, pos, i_am_the_longest_chain, forceAdd);
  }

  // delete from mempool
  return true;

}

Blockchain.prototype.addBlockToBlockchainFailure = function addBlockToBlockchainFailure(newblock, pos, i_am_the_longest_chain, forceAdd) {

  this.app.logger.logInfo(`about to update peer as failure: ${newblock.originating_peer} for block: ${newblock.returnHash()}`);

  // update peer reliability
  this.app.network.updatePeerReliability(newblock.originating_peer, "last_block_valid", -1);


  this.app.logger.logInfo(` ... blockchain failure ${new Date().getTime()}`);
  this.app.logger.logInfo("Failed to validate LongestChain, blockchain failure");

  // restore longest chain
  this.index.lc[this.longestChain] = 0;
  this.lc_hashmap[newblock.returnHash()] = 0;
  this.longestChain = this.old_lc;

  // reset miner
  this.app.miner.stopMining();
  var latestBlk = this.returnLatestBlock();
  if (latestBlk != null) { this.app.miner.startMining(latestBlk); }

  // update blockchain info
  this.updateForkId(this.returnLatestBlock());
  this.app.options.blockchain = this.returnBlockchain();
  this.app.storage.saveOptions();

  // remove bad everything
  this.app.mempool.removeBlockAndTransactions(newblock);

  // empty recovered array because we are not
  // removing anything after all...
  this.app.mempool.recovered = [];

  // allow indexing to continue
  newblock.app.blockchain.currently_indexing = false;
  newblock.app.blockchain.app.mempool.processing_bundle = false;

  this.app.logger.logInfo(`values reset...\n\n`);

}

/////////////////////////////////
// addBlockToBlockchainPartTwo //
/////////////////////////////////
//
// this function is called when the longest chain has been validated. now
// we save the block to disk and perform the second step of updating our
// wallet, invoking callbacks, etc.
//
// @params {saito.block} block
// @params {integer} position of block in indexes
// @params {integer} is block in longest chain
// @params {string} "force" if added from disk
//
Blockchain.prototype.addBlockToBlockchainPartTwo = async function addBlockToBlockchainPartTwo(newblock, pos, i_am_the_longest_chain, forceAdd) {

  this.app.logger.logInfo(` ... blockchain pt 2     ${new Date().getTime()}`);

  var blockchain_self = this;


  ///////////////////////////
  // when recovering chain //
  ///////////////////////////
  //
  // needed when our first block is a payment to us and it gets
  // kicked to the longest chain = 0 because we have no supporting
  // data. See how storage tells us we do this here, anyway.
  //
  // we also want to make sure any other transactions at this block
  // level are marked as non-LC, as there is an edge-case where a 
  // node can add the latest block in a fork on startup-up and think
  // it has two payments, because it received an incoming payment in 
  // a forked version of that block it loaded earlier.
  //
  if (i_am_the_longest_chain) {
    // not needed as not yet saved
    //blockchain_self.app.storage.onChainReorganization(newblock.block.id, newblock.returnHash(), i_am_the_longest_chain);
    blockchain_self.app.wallet.reorganizeTransactionsAtBlockId(newblock.block.id, 0);
    blockchain_self.app.wallet.onChainReorganization(newblock.block.id, newblock.returnHash(), i_am_the_longest_chain);
    // unsure if we need to run this -- must think through although it should not affect lite-clients to not do this
    //blockchain_self.app.modules.onChainReorganization(newblock.block.id, newblock.returnHash(), i_am_the_longest_chain);
    blockchain_self.app.blockchain.index.lc[pos] = i_am_the_longest_chain;
    this.app.logger.logInfo(`REORGing WALLET: ${newblock.returnHash()}`);
  }

  ////////////////
  // save block //
  ////////////////
  var save_block_promise = this.app.storage.saveBlock(newblock, i_am_the_longest_chain);


  ////////////////
  // lc hashmap //
  ////////////////
  //
  // we use the hashmap to find the longest chain
  // in PartOne, so defer setting it to the longest
  // chain until we know we should.
  //
  this.lc_hashmap[newblock.returnHash()] = i_am_the_longest_chain;


  var tmpgt2 = new Date().getTime();
  this.app.logger.logInfo(` ... updating wallet1:   ${tmpgt2}`)
  this.app.logger.logInfo(` ... is lc? ${i_am_the_longest_chain}`)

  ///////////////////
  // update wallet //
  ///////////////////
  var updated_wallet = 0;
  blockchain_self.app.wallet.purgeExpiredSlips();

  for (let ti = 0; ti < newblock.transactions.length; ti++) {
    var tx = newblock.transactions[ti];
    if (tx.isFrom(blockchain_self.app.wallet.returnPublicKey()) || tx.isTo(blockchain_self.app.wallet.returnPublicKey())) {
      updated_wallet = 1;
      blockchain_self.app.wallet.paymentConfirmation(newblock, tx, i_am_the_longest_chain);
    }
  }
  if (updated_wallet == 1) {
    if (i_am_the_longest_chain == 1) {
      blockchain_self.app.wallet.calculateBalance();
      blockchain_self.app.wallet.updateBalance();
    }
    blockchain_self.app.modules.updateBalance();
    blockchain_self.app.wallet.saveWallet();
    blockchain_self.app.storage.saveOptions();
  }
  blockchain_self.app.wallet.resetSpentInputs();



  var tmpgt3 = new Date().getTime();
  console.log(" ... updating wallet2:   " + tmpgt3);



  ///////////////////
  // run callbacks //
  ///////////////////
  if (blockchain_self.run_callbacks == 1) {
    if (forceAdd != "force") {
      var our_longest_chain = blockchain_self.returnLongestChainIndex(blockchain_self.callback_limit);
      for (let i = 0; i < our_longest_chain.length && i < blockchain_self.callback_limit; i++) {

        //
        // we may want to shift this to a callback, so that
        // returnBlockByHash can load locally if it exists or
        // fetch from disk through the storage class if it doesn't
        //
        // we do not handle this through the callback method as we
        // expect to keep all blocks needed for callbacks in memory
        //
        // TODO
        //
        // adjust this code so that we can still run callbacks on
        // blocks that are stored on disk.
        //
        var thisblk = blockchain_self.returnBlockByHash(this.index.hash[our_longest_chain[i]]);
        if (thisblk != null) {

          //
          // encoding issues can still screw us up
          //
          try {
	          thisblk.runCallbacks(i);
          } catch (err) {
            console.log(JSON.stringify(err));
            blockchain_self.app.logger.logError("Error thrown in addBlocktoBlockchainPart2", err);
          }
	        blockchain_self.app.storage.saveConfirmation(thisblk.returnHash(), i);
        } else {
  	      // ? error finding block ?
          blockchain_self.app.logger.logError("No block found in addBlocktoBlockchainPart2", {});
          process.exit();
        }
      }
    } else {

      //
      // we are forcing blocks in without callbacks, but we still
      // update their confirmation numbers.
      //
      var our_longest_chain = blockchain_self.returnLongestChainIndex(blockchain_self.callback_limit);

      for (let i = 0; i < our_longest_chain.length; i++) {
        let thisblk = blockchain_self.returnBlockByHash(blockchain_self.index.hash[our_longest_chain[i]]);
        thisblk.updateConfirmationNumberWithoutCallbacks(i);
      }
    }
  }



  //////////////////
  // confirm save //
  //////////////////
  //
  // the storage class can still be writing our block to disk, so
  // we start a timer to check when we are ready to continue. we
  // need to do this as subsequent / final steps in adding blocks
  // requires our local file to exist to avoid edge case errors.
  //

  console.log(" ... hitting timer1:     " + new Date().getTime());

  var saving_blocks_status = await save_block_promise
  if (!saving_blocks_status) {
    blockchain_self.addBlockToBlockchainSuccess(newblock, pos, i_am_the_longest_chain, forceAdd);
  }
}


/////////////////////////////////
// addBlockToBlockchainSuccess //
/////////////////////////////////
//
// this concludes adding a block to our blockchain, handles deletions and
// any other functions that may require the block to have already been
// saved to disk. finally, it resets our variables to permit the next
// block to be processed.
//
// @params {saito.block} block
// @params {integer} position of block in indexes
// @params {integer} is block in longest chain
// @params {string} "force" if added from disk
//
Blockchain.prototype.addBlockToBlockchainSuccess = function addBlockToBlockchainSuccess(newblock, pos, i_am_the_longest_chain, forceAdd) {

  // update peer reliability
  this.app.network.updatePeerReliability(newblock.originating_peer, "last_block_valid", 1);

  console.log(" ... blockchain success: " + (new Date().getTime()));

  var blockchain_self = this;

  /////////////////////////
  // delete transactions //
  /////////////////////////
  //
  // we delete transaction data once blocks are old enough that
  // we no longer need their data for callbacks.
  //
  // note that block propagation to lite nodes fails if the callback
  // limit is too short and we don't have the block data actively
  // stored in memory.
  //
  if (blockchain_self.blocks.length > blockchain_self.callback_limit) {
    var blk2clear = blockchain_self.blocks.length - blockchain_self.callback_limit-1;
    if (blk2clear >= 0) {
      blockchain_self.blocks[blk2clear].transactions = [];
      blockchain_self.blocks[blk2clear].block.transactions = [];
      // sanity check for blocks added earlier
      if (pos < blk2clear) {
        blockchain_self.blocks[pos].transactions = [];
        blockchain_self.blocks[pos].block.transactions = [];
      }
    }
  }

  //
  // even if we are still running callbacks, we
  // don't need the JSON copies, just the objs
  //
  // see server.js -- we don't want empty transaction
  // arrays int eh blocks we send ppl, so we check
  // if we fetch the block from out local data stores
  // before sending
  //
  blockchain_self.blocks[pos].block.transactions = [];


  /////////////////////
  // clear the timer //
  /////////////////////
  clearInterval(blockchain_self.block_saving_timer);


  ///////////////////////////////
  // process any recovered txs //
  ///////////////////////////////
  //
  // in storage.js we push any transactions from blocks we
  // created that are being undone back into the mempool
  // which is why we put it here -- we need to validate them
  // again.
  //
  blockchain_self.app.mempool.reinsertRecoveredTransactions();


  /////////////////////
  // module callback //
  /////////////////////
  console.log(" ... on new block");
  if (forceAdd != "force") { blockchain_self.app.modules.onNewBlock(newblock); }


  /////////////////////////
  // reset miner (again) //
  /////////////////////////
  //
  // if we find a solution too fast spammer module can hang
  //
  blockchain_self.app.miner.stopMining();
  var latestBlk = this.returnLatestBlock();
  if (latestBlk != null) { blockchain_self.app.miner.startMining(latestBlk); }



  ////////////////////
  // ok to continue //
  ////////////////////
  blockchain_self.app.mempool.currently_processing = false;
  blockchain_self.currently_indexing = false;

}