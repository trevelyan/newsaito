const assert  = require('chai').assert;
const fs      = require('fs-extra');

const test    = require('./helpers/test');
const saito   = require('../lib/saito');

// This file should be used for testing forking of the blockchain
// the functions responsible for this are windChain and unwindChain
describe('FORK', () => {
  var app = {};

  const config = {
    storage: { folder: "test/env", src: "test/fork_test_1" },
    setup: async () => {
      await fs.remove(`../lib/data/${config.storage.folder}`);
      await fs.copy(
        `../lib/data/${config.storage.src}`, 
        `../lib/data/${config.storage.folder}`, 
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
      // console.log(app);
      assert.equal(app.blockchain.blocks.length, 9);
    });
  });



});