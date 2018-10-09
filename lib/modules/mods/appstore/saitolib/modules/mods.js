
//
// IF THIS FILE CHANGES, BE SURE TO UPDATE THE
// COPY OF THE FILE IN THE APPSTORE MODULE DIR
//
// it uses a copy of this file to generate the
// browser.js file needed by the chrome exts
//
function Mods(app) {

  if (!(this instanceof Mods)) {
    return new Mods(app);
  }

  this.app     = app;
  this.mods    = [];

  this.lowest_sync_bid = -1;

  return this;

}
module.exports = Mods



////////////////////////
// Initialize Modules //
////////////////////////
Mods.prototype.pre_initialize = function pre_initialize() {

  /////////////
  // Spammer //
  /////////////
  this.mods.push(require('./mods/spammer/spammer')(this.app));
  //this.mods.push(require('./mods/bundler/bundler')(this.app));
  //this.mods.push(require('./mods/init/init')(this.app));
  this.mods.push(require('./mods/welcome/welcome')(this.app));


  ////////////////////
  // Insert Modules //
  ////////////////////
  this.mods.push(require('./mods/settings/settings')(this.app));
  this.mods.push(require('./mods/raw/raw')(this.app));
  this.mods.push(require('./mods/advert/advert')(this.app));
  this.mods.push(require('./mods/appstore/appstore')(this.app));
  this.mods.push(require('./mods/auth/auth')(this.app));
  this.mods.push(require('./mods/bank/bank')(this.app));
  this.mods.push(require('./mods/chat/chat')(this.app));
  this.mods.push(require('./mods/email/email')(this.app));
  //this.mods.push(require('./mods/mailchat3/email')(this.app));
  this.mods.push(require('./mods/encrypt/encrypt')(this.app));
  this.mods.push(require('./mods/ethln/ethln')(this.app));
  //this.mods.push(require('./mods/explorer/explorer')(this.app));
  this.mods.push(require('./mods/facebook/facebook')(this.app));
  this.mods.push(require('./mods/faucet/faucet')(this.app));
  //this.mods.push(require('./mods/registry/registry')(this.app));
  this.mods.push(require('./mods/reddit/reddit')(this.app));
  this.mods.push(require('./mods/remix/remix')(this.app));
  this.mods.push(require('./mods/money/money')(this.app));
  this.mods.push(require('./mods/debug/debug')(this.app));







  if (this.app.options.modules == null) {
    this.app.options.modules = [];
    for (let i = 0; i < this.mods.length; i++) {
      mi = 0;
      for (let j = 0; j < this.app.options.modules.length; j++) { if (this.mods[i].name == this.app.options.modules[j]) { mi = 1; }}
      if (mi == 0) {
        this.mods[i].installModule(this.app);
        this.app.options.modules.push(this.mods[i].name);
      };
    }
    this.app.storage.saveOptions();
  }

}



Mods.prototype.affixCallbacks = function affixCallbacks(txindex, message, callbackArray, callbackIndexArray) {
  for (i = 0; i < this.mods.length; i++) {
    if (message.module != undefined) {
      if (this.mods[i].shouldAffixCallbackToModule(message.module) == 1) {
console.log("\n\nYES, WE SHOULD AFFIX CALLBACK TO MODULE!");

        callbackArray.push(this.mods[i].onConfirmation);
        callbackIndexArray.push(txindex);
      }
    }
  }
}
Mods.prototype.initialize = function initialize() {
  for (i = 0; i < this.mods.length; i++) {
    this.mods[i].initialize(this.app);
  }
}
Mods.prototype.displayEmailForm = function displayEmailForm(modname) {
  for (i = 0; i < this.mods.length; i++) {
    if (modname == this.mods[i].name) {
      if (this.mods[i].handlesEmail == 1) {
        this.mods[i].displayEmailForm(this.app);
        for (ii = 0; ii < this.mods.length; ii++) {
	  if (this.mods[ii].name == "Email") {
            this.mods[ii].active_module = modname;
	  }
	}
      }
    }
  }
  return null;
}
Mods.prototype.displayEmailMessage = function displayEmailMessage(message_id, modname) {
  for (i = 0; i < this.mods.length; i++) {
    if (modname == this.mods[i].name) {
      if (this.mods[i].handlesEmail == 1) {
        return this.mods[i].displayEmailMessage(message_id, this.app);
      }
    }
  }
  return null;
}
Mods.prototype.attachEvents = function attachEvents() {
  for (imp = 0; imp < this.mods.length; imp++) {
    if (this.mods[imp].browser_active == 1) {
      this.mods[imp].attachEvents(this.app);
    }
  }
  return null;
}
Mods.prototype.attachEmailEvents = function attachEmailEvents() {
  for (imp = 0; imp < this.mods.length; imp++) {
    this.mods[imp].attachEmailEvents(this.app);
  }
  return null;
}
Mods.prototype.initializeHTML = function initializeHTML() {
  for (icb = 0; icb < this.mods.length; icb++) {
    if (this.mods[icb].browser_active == 1) {
      this.mods[icb].initializeHTML(this.app);
    }
  }
  return null;
}
Mods.prototype.formatEmailTransaction = function formatEmailTransaction(tx, modname) {
  for (i = 0; i < this.mods.length; i++) {
    if (modname == this.mods[i].name) {
      return this.mods[i].formatEmailTransaction(tx, this.app);
    }
  }
  return null;
}
Mods.prototype.handleDomainRequest = function handleDomainRequest(message, peer, mycallback) {
  for (iii = 0; iii < this.mods.length; iii++) {
    if (this.mods[iii].handlesDNS == 1) {
      this.mods[iii].handleDomainRequest(this.app, message, peer, mycallback);
    }
  }
  return;
}
Mods.prototype.handlePeerRequest = function handlePeerRequest(message, peer, mycallback=null) {
  for (iii = 0; iii < this.mods.length; iii++) {
    this.mods[iii].handlePeerRequest(this.app, message, peer, mycallback);
  }
  return;
}
Mods.prototype.loadFromArchives = function loadFromArchives(tx) {
  for (iii = 0; iii < this.mods.length; iii++) {
    this.mods[iii].loadFromArchives(this.app, tx);
  }
  return;
}
Mods.prototype.returnModule = function returnModule(modname) {
  for (i = 0; i < this.mods.length; i++) {
    if (modname == this.mods[i].name) {
      return this.mods[i];
    }
  }
  return null;
}
Mods.prototype.updateBalance = function updateBalance() {
  for (i = 0; i < this.mods.length; i++) {
    this.mods[i].updateBalance(this.app);
  }
  return null;
}
Mods.prototype.updateBlockchainSync = function updateBlockchainSync(current, target) {
  if (this.lowest_sync_bid == -1) { this.lowest_sync_bid = current; }
  target = target-(this.lowest_sync_bid-1);
  current = current-(this.lowest_sync_bid-1);
  if (target < 1) { target = 1; }
  if (current < 1) { current = 1; }
  let percent_downloaded = 100;
  if (target > current) {
    percent_downloaded = Math.floor(100*(current/target));
  }
  for (i = 0; i < this.mods.length; i++) {
    this.mods[i].updateBlockchainSync(this.app, percent_downloaded);
  }
  return null;
}
Mods.prototype.webServer = function webServer(expressapp) {
  for (i = 0; i < this.mods.length; i++) {
    this.mods[i].webServer(this.app, expressapp);
  }
  return null;
}
Mods.prototype.onNewBlock = function onNewBlock(blk, i_am_the_longest_chain) {
  for (iii = 0; iii < this.mods.length; iii++) {
    this.mods[iii].onNewBlock(blk, i_am_the_longest_chain);
  }
  return;
}
Mods.prototype.onChainReorganization = function onChainReorganization(block_id, block_hash, lc) {
  for (imp = 0; imp < this.mods.length; imp++) {
    this.mods[imp].onChainReorganization(block_id, block_hash, lc);
  }
  return null;
}







