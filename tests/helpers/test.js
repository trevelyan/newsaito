const fs    = require('fs-extra');
const path  = require('path');
const saito = require('../../lib/saito');


module.exports = {

  // Creates a new instance of Saito to use for testing
  async initSaito(config) {

    if (config !== undefined) {
      await config.setup();
    } else {
      config = {
        type: "lite",
        storage: {
          dest: null
        }
      }
    }

    var dir = path.join(__dirname, '../data');

    var app             = {};
        app.BROWSER     = 0;
        app.SPVMODE     = 0;

    app.crypto          = new saito.crypto();
    app.logger          = new saito.logger(app);
    app.storage         = new saito.storage(app, dir, config.storage.dest);
    app.mempool         = new saito.mempool(app);
    app.voter           = new saito.voter(app);
    app.wallet          = new saito.wallet(app);
    app.miner           = new saito.miner(app);
    app.monitor         = new saito.monitor(app);
    app.browser         = new saito.browser(app);
    app.archives        = new saito.archives(app);
    app.dns             = new saito.dns(app);
    app.keys            = new saito.keychain(app);
    app.network         = new saito.network(app);
    app.burnfee         = new saito.burnfee(app);
    app.blockchain      = new saito.blockchain(app);
    app.server          = new saito.server(app);
    app.modules         = require('../../lib/modules/mods')(app);

    // Initialize
    if (config.type == "lite") {
      await app.storage.initialize();
    } else {
      await app.storage.initialize();
      app.voter.initialize();
      app.wallet.initialize();
      app.mempool.initialize();
      await app.blockchain.initialize();
      app.keys.initialize();
      app.network.initialize();
      app.archives.initialize();
      app.dns.initialize();
      app.modules.pre_initialize();
      app.browser.initialize();
      app.modules.initialize();
      app.server.initialize();
    }

    return app
  },

  async tearDown(app) {
    await fs.unlink(`${__dirname}/../../lib/options`);
    await fs.unlink(`${__dirname}/../data/appstore.sq3`);
    await fs.unlink(`${__dirname}/../data/bank.sq3`);
    await fs.unlink(`${__dirname}/../data/database.sq3`);
    await fs.remove(`${__dirname}/../data/env`);
    await fs.remove(`../logs`);

    app.server.close();
    app.network.close();
    app.mempool.stop();
    process.exit(0);
  }
};
