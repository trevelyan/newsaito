var saito = require('../../../saito');
var ModTemplate = require('../../template');
var util = require('util');



//////////////////
// CONSTRUCTOR  //
//////////////////
//
// You do not need to change this.
//
function DaveMod(app) {

  if (!(this instanceof DaveMod)) { return new DaveMod(app); }

  DaveMod.super_.call(this);

  this.app             = app;
  this.name            = "DaveMod";

  this.handlesEmail = 1;
  this.emailAppName = "DaveMod App";
  return this;

}
module.exports = DaveMod;
util.inherits(DaveMod, ModTemplate);



//////////////////
// Confirmation //
//////////////////
//
// This callback is run by every computer running your module every time 
// a "DaveMod" transaction receives a confirmation. This is why we check 
// to see if we are the recipient...
//
DaveMod.prototype.onConfirmation = function onConfirmation(blk, tx, conf, app) {

  var remix_self = app.modules.returnModule("DaveMod");

  // on the first confirmation
  if (conf == 0) {

    // if message is for us...
    if (tx.transaction.to[0].add == app.wallet.returnPublicKey()) {

      var txmsg = tx.returnMessage();

      // do something ...


      // and email us ...
      msg          = {};
      msg.id       = tx.transaction.id;
      msg.from     = tx.transaction.from[0].add;
      msg.time     = tx.transaction.ts;
      msg.module   = txmsg.module;
      msg.title    = "You have received a " + msg.module + " message";
      msg.data     = "The email client treats msg.data field as email content";
      msg.markdown = 1;  // 0 = display as HTML
                         // 1 = display as markdown

      app.modules.returnModule("Email").attachMessage(msg, app);
      app.archives.saveMessage(tx);

    }
  }
}



/////////////////////
// Email Callbacks //
/////////////////////
//
// This callback controls how your Application shows up in the email client. 
// Use HTML to display information or create a form.
//
DaveMod.prototype.displayEmailForm = function displayEmailForm(app) {

  $('#module_editable_space').html('<div id="module_instructions" class="module_instructions">Edit the controls in standard HTML? </div>');

}
//
// This callback is run when the user clicks "send". Grab the data from your form
// (or javascript code) and stick it into your transaction.
//
DaveMod.prototype.formatEmailTransaction = function formatEmailTransaction(tx, app) {

  tx.transaction.msg.module = this.name;
  tx.transaction.msg.remix_data = "Add whatever data you want to your transaction.";
  return tx;

}



