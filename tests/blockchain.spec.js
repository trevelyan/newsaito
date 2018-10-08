const assert = require('chai').assert
const saito = require('../lib/saito')

describe('BLOCKCHAIN', () => {
  var app = {};
  app.mempool = new saito.mempool(app);
  const bchain = new saito.blockchain(app);

  describe('Constructor', () => {
    it('should have all necessary fields for a Blockchain object', () => {
      assert(bchain.app !== undefined);
    });
  });

  describe('saveBlockchain', () => {
    it('should save the blockchain object to options file', () => {});
  });

  describe('returnForkId', () => {
    it('should return the fork_id from the blockchain object', () => {});
  });

  describe('returnGenesisBlockId', () => {
    it('should return the genesis block id from the blockchain object', () => {});
  });

  describe('returnGenesisTimestamp', () => {
    it('should return the timestamp saved to the blockchain object', () => {});
  });

  describe('returnLatestBlockId', () => {
    it('should return the latest block id from the index array', () => {
      // assert.deepEqual(app.blockchain.returnLatestBlockId(), app.blockchain.index.bid[app.blockchain.lc]);
    });
  });

  describe('returnGenesisPeriod', () => {
    it('should return the genesis_period saved to the blockchain object', () => {
      // assert.deepEqual(app.blockchain.returnGenesisPeriod(), app.blockchain.genesis_period);
    });
  });

  describe('returnLatestBlockHash', () => {
    it('should return 0 if blockchain.blocks is empty', () => {
      // assert.equal(app.blockchain.blocks.length, 0);
      // assert.equal(app.blockchain.returnLatestBlockHash(), 0);
    });

    it('should save the blockchain object to options file', () => {
      // Need to add a block here in order for this to succeed
      // assert.deepEqual(app.blockchain.returnLatestBlockHash(), app.blockchain.hash[app.blockchain.lc]);
    });
  });

  describe('returnLatestBlock', () => {
    it('should return 0 if blockchain.blocks is empty', () => {
      // assert.equal(bchain.blocks.length, 0);
      // assert.equal(bchain.returnLatestBlock(), null);
    });

    it('should return the latest block based on the lc value if lc equals', () => {
      // assert.equal(bchain.returnLatestBlock(1), bchain.blocks[bchain.lc]);
    });

    it('should return the latest block based on the lc value if lc equals', () => {
      // assert.equal(bchain.returnLatestBlock(0), bchain.blocks[bchain.blocks.length-1]);
    });
  });


  describe('addBlockToBlockchain', () => {
    it('should return null if newblock is null', () => {});

    it('should return null if this block has already been indexed', () => {});

    it('should send a network request if block hash is not indexed', () => {});

    it('should insert block info in to index arrays', () => {});

    it('should call startMiner() to find solution for newblock', () => {});

    it('should run validateLongestChain if the blockchain index is greater than 1', () => {});

    it('should run addBlockToBlockchainSuccess if index is less than 0', () => {});
  });

  describe('addBlockToBlockchainSuccess', () => {
    it('should call onChainReorganization if i_am_the_longest_chain is 1', () => {});

    it('should add slips to wallet from transactions', () => {});

    it('should call removeBlockAndTransactions from mempool', () => {});

    it('should call removeBlockAndTransactions from mempool', () => {});

    it('should clear block txsjson data for all blocks', () => {});

    it('should call updateGenesisBlock if i_am_the_longest_chain is 1', () => {});

    it('should call reinsertRecoveredTransactions from mempool', () => {});

    it('should set this.indexing to false', () => {});

    it('should call onNewBlock() with newblock as arg if force is false', () => {});

    it('should return 1 if successful', () => {});

  });

  describe('addBlockToBlockchainFailure', () => {
    it('should call stopMining()', () => {});

    it('should startMining previous block', () => {});

    it('should delete newblocks hash from this.block_hash_hmap', () => {});

    it('should call updateForkId()', () => {});

    it('should set this.indexing_false', () => {});

    it('should return 1', () => {});

  });

  describe('validateLongestChain', () => {
    // lite clients
    it('should call addBlockToBlockchainSucess', () => {});

    it('should call onChainReorganization from storage', () => {});

    it('should call onChainReorganization from wallet', () => {});

    it('should call onChainReorganization from modules', () => {});

    // full nodes
    it('should call unwindChain if old_block_hashes.length > 0', () => {});

    it('should call windChain otherwise', () => {});

  });


  describe('unwindChain', () => {});
  describe('windChain', () => {});
  describe('unwindChain', () => {});
  describe('isHashIndexed', () => {});
  describe('binaryInsert', () => {});
  describe('returnMixTxId', () => {});
  describe('returnMaxTxId', () => {});
  describe('calculateForkId', () => {});
  describe('returnBlockbyHash', () => {});
  describe('returnBlockByHashWithCallback', () => {});
  describe('returnLastSharedBlockId', () => {});
  describe('returnHashByBlockById', () => {});
  describe('returnLongestChainIndexArray', () => {});
  describe('updateGenesisBlock', () => {});
  describe('purgeArchivedData', () => {});
  describe('updateForkId', () => {});
  describe('returnTargetBlockId', () => {});

});


