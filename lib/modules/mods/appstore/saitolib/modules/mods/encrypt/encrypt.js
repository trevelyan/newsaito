var saito = require('../../../saito');
var ModTemplate = require('../../template');
var util = require('util');
const Big = require('big.js');


//////////////////
// CONSTRUCTOR  //
//////////////////
function Encrypt(app) {

  if (!(this instanceof Encrypt)) { return new Encrypt(app); }

  Encrypt.super_.call(this);

  this.app             = app;

  this.name            = "Encrypt";
  this.handlesEmail    = 1;
  this.emailAppName    = "Encryption";

  this.email_view_txid = 0;

  return this;

}
module.exports = Encrypt;
util.inherits(Encrypt, ModTemplate);




/////////////////////
// Email Functions //
/////////////////////
Encrypt.prototype.displayEmailForm = function displayEmailForm(app) {

  element_to_edit = $('#module_editable_space');
  element_to_edit.html('<div class="module_instructions">Click send to initiate a Diffie-Hellman key-exchange over the Saito blockchain. Once your recipient approves your request, you will be notified and all subsequent email with them will be automatically encrypted.</div>');
  $('.lightbox_compose_payment').val(app.wallet.returnDefaultFee());

}
Encrypt.prototype.formatEmailTransaction = function formatEmailTransaction(tx, app) {

  link_id    = "encrypt_authorize_link_"+this.email_view_txid;

  // always set the message.module to the name of the app
  tx.transaction.msg.module  = this.name;
  tx.transaction.msg.request = "key exchange request";
  tx.transaction.msg.title   = "Key-Exchange Request";
  tx.transaction.msg.markdown = 0;
  email_html = 'You have received a request for encrypted communications from the sender of this email.<p></p>To authorize this request, <div class="encrypt_authorize_link" id="'+link_id+'" style="display:inline;text-decoration:underline;cursor:pointer">click here</div>.';
  tx.transaction.msg.data    = email_html;

  // return OUR public key submitting THEIR publickey
  tx.transaction.msg.alice_publickey = app.keys.initializeKeyExchange(tx.transaction.to[0].add);

console.log("\nINITIALIZED ALICE WITH PUBLICKEY: ");
console.log(tx.transaction.msg.alice_publickey);

  return tx;

}
Encrypt.prototype.displayEmailMessage = function displayEmailMessage(message_id, app) {

  if (app.BROWSER == 1) {
    this.email_view_txid = message_id.substring(8);
    message_text_selector = "#" + message_id + " > .data";
    authbody = $(message_text_selector).html();

    $('#lightbox_message_text').html(authbody);

    // update authorize link ID
    message_text_selector = ".lightbox_message_text > .encrypt_authorize_link";
    new_auth_link = "encrypt_authorize_link_"+this.email_view_txid;
    $(message_text_selector).attr('id', new_auth_link);
  }

}










//////////////////
// Confirmation //
//////////////////
Encrypt.prototype.onConfirmation = function onConfirmation(blk, tx, conf, app) {

  var encrypt_self = app.modules.returnModule("Encrypt");

  if (conf == 0) {

    var sender           = tx.transaction.from[0].add;
    var receiver         = tx.transaction.to[0].add;
    var request          = tx.transaction.msg.request;  // "request"

    /////////////////////////
    // requests made to us //
    /////////////////////////
    if (sender == app.wallet.returnPublicKey()) {
      if (tx.transaction.msg.request == "key exchange request") {

          msg                 = {};
          msg.id              = tx.transaction.id + "_1";
          msg.from            = sender;
          msg.time            = tx.transaction.ts;
          msg.module          = "Email";
          msg.title           = "You have initiated a key exchange";
          msg.data            = "You have requested a key exchange request with:<p></p>"+receiver+"<p></p>Please wait while they approve this request.";
          msg.alice_publickey = tx.transaction.msg.alice_publickey;
          msg.markdown = 0;

          app.modules.returnModule("Email").attachMessage(msg, app);
          app.archives.saveTransaction(tx);

      }
    }


    /////////////////////////
    // requests made to us //
    /////////////////////////
    if (receiver == app.wallet.returnPublicKey()) {

      // someone wants to key exchange
      if (tx.transaction.msg.request == "key exchange request") {

	// payment will be first field, cannot take all due to change address
	if (Big(tx.transaction.to[0].amt).gt(0)) {
          encrypt_self.approveEncryptionRequest(app, tx, tx.transaction.to[0].amt);
        } else {

          msg                 = {};
          msg.id              = tx.transaction.id;
          msg.from            = sender;
          msg.time            = tx.transaction.ts;
          msg.module          = "Encrypt";
          msg.title           = tx.transaction.msg.title;
          msg.data            = tx.transaction.msg.data;;
          msg.alice_publickey = tx.transaction.msg.alice_publickey;
          msg.markdown = 0;

console.log("HERE WE ARE!");
console.log(JSON.stringify(msg));

          app.modules.returnModule("Email").attachMessage(msg, app);
console.log("ADDED!");
          app.archives.saveTransaction(tx);
console.log("AND SAVED");

        }
      }


      // confirming shared secret
      if (tx.transaction.msg.request == "key exchange confirm") {

        msg        = {};
        msg.id     = tx.transaction.id;
        msg.from   = sender;
        msg.time   = tx.transaction.ts;
        msg.module = "Encrypt";
        msg.title  = tx.transaction.msg.title;
        msg.data   = tx.transaction.msg.data;       
        msg.markdown = 0;

	// generate the shared secret
	var bob_publickey = new Buffer(tx.transaction.msg.bob, "hex");;

	var senderkeydata = app.keys.findByPublicKey(sender);

	if (senderkeydata == null) { if (app.BROWSER == 1) { alert('Cannot find our original DH keys for key exchange.'); return; } }

	var alice_publickey  = new Buffer(senderkeydata.aes_publickey, "hex");
	var alice_privatekey = new Buffer(senderkeydata.aes_privatekey, "hex");

	var alice            = app.crypt.createDiffieHellman(alice_publickey, alice_privatekey);
        var alice_secret     = app.crypt.createDiffieHellmanSecret(alice, bob_publickey);

        app.keys.updateCryptoByPublicKey(sender, alice_publickey.toString("hex"), alice_privatekey.toString("hex"), alice_secret.toString("hex"));

        app.modules.returnModule("Email").attachMessage(msg, app);
        app.archives.saveTransaction(tx);

      }
    }
  }
}



// this code is duplicated and needs to be refactored, it is only run when automated acceptance
// because the other user has sent a payment along with the request.
Encrypt.prototype.approveEncryptionRequest = function approveEncryptionRequest(app, thistx, fee) {

  remote_address = thistx.transaction.from[0].add;
  our_address    = thistx.transaction.to[0].add;
  alice_publickey = thistx.transaction.msg.alice_publickey;

  // generate shared secret and save
  bob              = app.crypt.createDiffieHellman();
  bob_publickey    = bob.getPublicKey(null, "compressed").toString("hex");
  bob_privatekey   = bob.getPrivateKey(null, "compressed").toString("hex");
  bob_secret       = app.crypt.createDiffieHellmanSecret(bob, new Buffer(alice_publickey, "hex"));

  // send plaintext confirmation, returning publickey used for encryption
  email_html = 'Your request for encrypted communications has been accepted by: <p></p>'+app.modules.returnModule("Email").formatAuthor(our_address, app)+'<p></p>Your future correspondence will be encrypted with a shared-secret known only by your two accounts.';

  var newtx = app.wallet.createUnsignedTransaction(remote_address, 0, fee);  
  if (newtx == null) { return; }
  newtx.transaction.msg.module   = "Encrypt";
  newtx.transaction.msg.request  = "key exchange confirm";
  newtx.transaction.msg.tx_id    = thistx.transaction.id;		// reference id for parent tx
  newtx.transaction.msg.title    = "Key-Exchange Success";
  newtx.transaction.msg.data     = email_html;
  newtx.transaction.msg.bob      = bob_publickey;
  newtx.transaction.msg.markdown = 0;
  newtx = app.wallet.signTransaction(newtx);

  app.mempool.addTransaction(newtx);

  // save encryption information
  app.keys.updateCryptoByPublicKey(thistx.transaction.from[0].add, bob_publickey, bob_privatekey, bob_secret.toString("hex"));
  app.modules.returnModule("Email").showBrowserAlert("key-exchange completed");

  if (our_address != remote_address) {

    // and send me an email too
    newtx = app.wallet.createUnsignedTransaction(our_address, 0.0, 0.0);
    if (newtx == null) { return; }
    newtx.transaction.msg.module   = "Email";
    newtx.transaction.msg.title    = "Key-Exchange Success";
    newtx.transaction.msg.data     = email_html;
    newtx.transaction.msg.bob      = 'You have accepted a request for encrypted communications with: <p></p>'+remote_address+'<p></p>Your future correspondence will be encrypted with a shared-secret known only by your two accounts.';
    newtx.transaction.msg.markdown = 0;
    newtx = app.wallet.signTransaction(newtx);
 
    var email_self = app.modules.returnModule("Email");
    if (email_self != null) {
      email_self.app.archives.saveTransaction(newtx);
      email_self.addMessageToInbox(newtx, email_self.app);
    }
  }
}



Encrypt.prototype.attachEmailEvents = function attachEmailEvents(app) {

  if (app.BROWSER == 1) {

    // fancybox does not want us to attach events by #id so we
    // have to handle it by class. This is a bug in their software
    $('.encrypt_authorize_link').off();
    $('.encrypt_authorize_link').on('click', function() {

      txid = $(this).attr('id');
      txid = txid.substring(23);

      thistx = app.archives.returnTransactionById(txid);

      if (thistx == null) { alert("Cannot Find TX by Id: "+txid); return; }
      if (app.keys.hasSharedSecret(thistx.transaction.from[0].add) == 1) { 
        app.modules.returnModule("Email").showBrowserAlert("a shared secret already exists between your accounts!");
        app.modules.returnModule("Email").closeMessage();
        return; 
      }

      remote_address = thistx.transaction.from[0].add;
      our_address    = thistx.transaction.to[0].add;
      alice_publickey = thistx.transaction.msg.alice_publickey;

      // generate shared secret and save
      bob              = app.crypt.createDiffieHellman();
      bob_publickey    = bob.getPublicKey(null, "compressed").toString("hex");
      bob_privatekey   = bob.getPrivateKey(null, "compressed").toString("hex");
      bob_secret       = app.crypt.createDiffieHellmanSecret(bob, new Buffer(alice_publickey, "hex"));

      // send plaintext confirmation, returning publickey used for encryption
      email_html = 'Your request for encrypted communications has been accepted by: <p></p>'+app.modules.returnModule("Email").formatAuthor(our_address, app)+'<p></p>Your future correspondence will be encrypted with a shared-secret known only by your two accounts.';

      newtx = app.wallet.createUnsignedTransactionWithDefaultFee(remote_address, 1.5);  
      if (newtx == null) { return; }
      newtx.transaction.msg.module   = "Encrypt";
      newtx.transaction.msg.request  = "key exchange confirm";
      newtx.transaction.msg.tx_id    = txid;		// reference id for parent tx
      newtx.transaction.msg.title    = "Key-Exchange Success";
      newtx.transaction.msg.data     = email_html;
      newtx.transaction.msg.bob      = bob_publickey;
      newtx.transaction.msg.markdown = 0;
      newtx = app.wallet.signTransaction(newtx);

      app.mempool.addTransaction(newtx);

      // save encryption information
      app.keys.updateCryptoByPublicKey(thistx.transaction.from[0].add, bob_publickey, bob_privatekey, bob_secret.toString("hex"));
      app.modules.returnModule("Email").showBrowserAlert("key-exchange completed");

      var email_self = app.modules.returnModule("Email");

      if (remote_address != our_address) {

        // and send me an email too
        newtx = app.wallet.createUnsignedTransaction(remote_address, 0.0, 0.0);
        if (newtx == null) { return; }
        newtx.transaction.msg.module   = "Email";
        newtx.transaction.msg.title    = "Key-Exchange Success";
        newtx.transaction.msg.data     = email_html;
        newtx.transaction.msg.bob      = 'You have accepted a request for encrypted communications with: <p></p>'+remote_address+'<p></p>Your future correspondence will be encrypted with a shared-secret known only by your two accounts.';
        newtx.transaction.msg.markdown = 0;
        newtx = app.wallet.signTransaction(newtx);
 
        email_self.app.archives.saveTransaction(newtx);
        email_self.addMessageToInbox(newtx, email_self.app);

      }

      email_self.closeMessage();

    });
  }
}





