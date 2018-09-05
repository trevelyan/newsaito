const assert  = require('chai').assert;
const fs      = require('fs-extra');

const test    = require('./helpers/test');
const saito   = require('../lib/saito');

// This file should be used for testing forking of the blockchain
// the functions responsible for this are windChain and unwindChain
describe('FORK', () => {
  var app = {};

  const config = {
    storage: { dest: "test/env", src: "test/fork_test_1" },
    setup: async () => {
      await fs.remove(`../lib/data/${config.storage.dest}`);
      await fs.copy(
        `../lib/data/${config.storage.src}`, 
        `../lib/data/${config.storage.dest}`, 
        { preserveTimestamps: true }
      );
    }
  };

  before(async () => {
    app = await test.initSaito(config);
  });

  after(async () => {
    test.tearDown(app);
  });

  describe('should handle forked block files successfully', () => {
    it('Saves all available block files to blockchain', () => {
      console.log(app.blockchain);
      assert.equal(app.blockchain.blocks.length, 9);
    });

    it('lc values should be total the amount of valid blocks on chain minus 1', () => {
      assert.equal(app.blockchain.index.lc.reduce((tot, sum) => tot + sum), app.blockchain.index.bid.max() - 1);
    });
  });



});