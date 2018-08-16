const fs    = require('fs-extra');
const saito = require('../../lib/saito');

module.exports = {
  async initSaito() {
    // Variables
    var app             = {};
        app.BROWSER     = 0;
        app.SPVMODE     = 0;

    app.crypto          = new saito.crypto();
    app.storage         = new saito.storage(app);
    app.mempool         = new saito.mempool(app);
    app.voter           = new saito.voter(app);
    app.wallet          = new saito.wallet(app);
    app.miner           = new saito.miner(app);
    app.monitor         = new saito.monitor(app);
    app.keychain        = new saito.keychain(app);
    app.network         = new saito.network(app);
    app.burnfee         = new saito.burnfee(app);
    app.blockchain      = new saito.blockchain(app);
    app.server          = new saito.server(app);

    // Initialize
    await app.storage.initialize();
    // app.voter.initialize();
    // app.wallet.initialize();
    // app.mempool.initialize();
    // app.blockchain.initialize();
    // app.keys.initialize();
    // app.network.initialize();
    //
    // archives before modules
    //
    // app.archives.initialize();
    //
    // dns before browser so modules can
    // initialize with dns support
    //
    // app.dns.initialize();
    //
    // modules pre-initialized before
    // browser, so that the browser
    // can check which application we
    // are viewing.
    //
    // app.modules.pre_initialize();
    // app.browser.initialize();
    // app.modules.initialize();
    //
    // server initialized after modules
    // so that the modules can use the
    // server to feed their own subpages
    // as necessary
    //
    // app.server.initialize();

    return app
  },
  async tearDown() {
    await fs.unlink(`${__dirname}/../../lib/options`);
    return;
  }
};