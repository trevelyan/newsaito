//
// This module monitors the blockchain and our
// unspent transaction inputs. It creates fake
// transactions to speed up block production
// for testing purposes.`
//
var saito = require('../../../saito');
var ModTemplate = require('../../template');
var util = require('util');
var crypto = require('crypto');
const Big      = require('big.js');

console.log("hammer.....started.....");

//////////////////
// CONSTRUCTOR  //
//////////////////
function Hammer(app) {

  if (!(this instanceof Hammer)) { return new Hammer(app); }

  Hammer.super_.call(this);

  this.app             = app;
  this.name            = "Hammer";

  return this;

}
module.exports = Hammer;
util.inherits(Hammer, ModTemplate);

Hammer.prototype.initialize = function initialize() {
  console.log("hammer:.....initialized.....");
  this.flood();
}

Hammer.prototype.flood = function flood() {

  if (this.app.BROWSER == 1) { return; }

  //console.log("hammer: public key : "+this.app.wallet.returnPublicKey());
  console.log("hammer: balance: "+this.app.wallet.returnBalance());

  var size_of_emails_in_mb   = 0.075;
  var size_of_mb             = 1024000;
  var pause                  = 5000;

  //var available_inputs_limit = 0.5;
  //var available_inputs       = Big(blk.app.wallet.returnAvailableInputs(available_inputs_limit));

  var pkey                   = this.app.wallet.returnPublicKey();

  var thisfee                = 1.0;
  var thisamt                = 0.01;
  var newtx                  = null;

    //console.log("hammer: adequate inputs? %j"+this.app.wallet.returnAdequateInputs(thisfee+thisamt));
    console.log("hammer: available inputs: "+this.app.wallet.returnAvailableInputs(thisfee+thisamt));
  if (this.app.wallet.returnAvailableInputs(thisfee+thisamt) == 0) {
    console.log("hammer: not enough saito");
    return;
  } else {
    //newtx = this.app.wallet.createUnsignedTransaction(pkey, thisamt, thisfee);
    newtx = this.app.wallet.createUnsignedTransaction(this.app.wallet.returnPublicKey(), thisamt, thisfee);
    if (newtx != null) {
      var strlength = size_of_mb * size_of_emails_in_mb;
      newtx.transaction.msg.data = crypto.randomBytes(Math.ceil(strlength/2)).toString('hex').slice(0,strlength);
      newtx = this.app.wallet.signTransaction(newtx);
      //this.app.mempool.addTransaction(newtx, 0); // don't relay-on-validate
      this.propagateTransaction(newtx);
      console.log("hammer: message sent: "+thisfee+" - "+thisamt);
    } else {
      console.log("hammer: ERROR:  modules - newtx is null...");
    }
  }

  //setTimeout(this.flood(), pause);
  this.flood();
}

Hammer.prototype.onNewBlock = function onNewBlock(blk) {
  this.flood();
}

Hammer.prototype.propagateTransaction = function propagateTransaction(tx, outboundMessage="transaction") {

  if (tx == null) { return; }
  if (tx.is_valid == 0) { return; }

  //
  // sign transaction for our peers and propagate
  //
  console.log("hammer: peer: ", this.app.network.peers[0].peer.host);
  for (let networki = 0; networki < this.app.network.peers.length; networki++) {
  //console.log("hammer: peer "+this.app.network.peers.length);
    // if peer not on path

  //console.log("hammer: peer: ", this.app.network.peers[networki].peer.host);
      // create a temporary transaction
      //
      // try/catch block exists as it is possible to create
      // a JSON string that JSON class cannot parse successfully
      //
      try {
        var tmptx = new saito.transaction();
            tmptx.transaction = JSON.parse(JSON.stringify(tx.transaction));
      } catch (err) {
	      return;
      }

      // add our path
      var tmppath = new saito.path();
          tmppath.from = this.app.wallet.returnPublicKey();
          tmppath.to   = this.app.wallet.returnPublicKey();
          tmppath.sig  = this.app.crypt.signMessage(tmppath.to, this.app.wallet.returnPrivateKey());

      tmptx.transaction.path.push(tmppath);
    	this.app.network.peers[networki].sendRequest(outboundMessage, JSON.stringify(tmptx.transaction));

  }
}
