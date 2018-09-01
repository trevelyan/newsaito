var saito = require('./saito');

var app            = {};
    app.BROWSER    = 0;
    app.SPVMODE    = 0;





initSaito();






async function initSaito() {

  ////////////////////
  // Load Variables //
  ////////////////////
  try {
    app.crypto     = new saito.crypto();
    app.logger     = new saito.logger(app);
    app.storage    = new saito.storage(app);
    app.mempool    = new saito.mempool(app);
    app.voter      = new saito.voter(app);
    app.wallet     = new saito.wallet(app);
    app.miner      = new saito.miner(app);
    app.monitor    = new saito.monitor(app);
    app.browser    = new saito.browser(app);
    app.archives   = new saito.archives(app);
    app.dns        = new saito.dns(app);
    app.keys       = new saito.keychain(app);
    app.network    = new saito.network(app);
    app.burnfee    = new saito.burnfee(app);
    app.blockchain = new saito.blockchain(app);
    app.server     = new saito.server(app);
    app.modules    = require('./modules/mods')(app);

    ////////////////
    // Initialize //
    ////////////////
    app.logger.initialize();
    await app.storage.initialize();
    app.voter.initialize();
    app.wallet.initialize();
    app.mempool.initialize();
    await app.blockchain.initialize();
    app.keys.initialize();
    app.network.initialize();
    //
    // archives before modules
    //
    app.archives.initialize();
    //
    // dns before browser so modules can
    // initialize with dns support
    //
    app.dns.initialize();
    //
    // modules pre-initialized before
    // browser, so that the browser
    // can check which application we
    // are viewing.
    //
    app.modules.pre_initialize();
    app.browser.initialize();
    app.modules.initialize();
    //
    // server initialized after modules
    // so that the modules can use the
    // server to feed their own subpages
    // as necessary
    //
    app.server.initialize();


    console.log(`

    Welcome to Saito

    address: ${app.wallet.returnPublicKey()}
    balance: ${app.wallet.returnBalance()}

    Above is the address and balance of this computer on the Saito network. Once Saito
    is running it will generate tokens automatically over time. You can increase your
    likelihood of this by processing more transactions and creating services that attract
    clients. The more transactions you process the greater the chance that you will be
    rewarded for the work.

    Questions or comments? Please contact us anytime at: david@saito

    `);
  } catch (err) {

  }

} // init saito





function shutdownSaito() {
  console.log("Shutting down Saito");
  app.server.close();
  app.network.close();
}

/////////////////////
// Cntl-C to Close //
/////////////////////
process.on('SIGTERM', function () {
  shutdownSaito();
  console.log("Network Shutdown");
  process.exit(0)
});
process.on('SIGINT', function () {
  shutdownSaito();
  console.log("Network Shutdown");
  process.exit(0)
});




