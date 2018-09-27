const saito = require('../../../saito');
const ModTemplate = require('../../template');
const util = require('util');


//////////////////
// CONSTRUCTOR  //
//////////////////
function Raw(app) {

  if (!(this instanceof Raw)) { return new Raw(app); }

  Raw.super_.call(this);

  this.app             = app;

  this.name            = "Raw";
  this.handlesEmail    = 1;
  this.emailAppName    = "Send Raw Tx";

  return this;

}
module.exports = Raw;
util.inherits(Raw, ModTemplate);






////////////////////////////////
// Email Client Interactivity //
////////////////////////////////
Raw.prototype.displayEmailForm = function displayEmailForm(app) {

  var raw_self = this;

  // create transaction
  var newtx = app.wallet.createUnsignedTransactionWithDefaultFee(app.wallet.returnPublicKey(), 0.0);

  if (newtx == null) {
    alert("You do not have enough tokens to send a Raw Transaction.");
    return;
  }

  element_to_edit = $('#module_editable_space');

  element_to_edit_html = '<div id="module_instructions" class="module_instructions" style="padding:10px;margin-top:0px;width:90%"><textarea class="rawtx" style="width:95%;height:80%">'+JSON.stringify(newtx.transaction, null, 4)+'</textarea><p></p><div id="module_textinput_button" class="module_textinput_button" style="margin-left:0px;margin-right:0px;">broadcast tx</div></div>';
  element_to_edit.html(element_to_edit_html);

  $('#module_textinput_button').off();
  $('#module_textinput_button').on('click', function() {

    var txjson = $('.rawtx').val();
console.log("1: "+txjson);
    var newtx = new saito.transaction(txjson);
  
    if (newtx == null) {
      alert("ERROR: malformed transaction #1");
    }
//    if (newtx.is_valid == 0) {
//      alert("ERROR: malformed transaction #2");
//    }

    console.log("2: "+JSON.stringify(newtx)); 

    newtx = app.wallet.signTransaction(newtx);

    console.log("3: "+JSON.stringify(newtx));

    app.network.propagateTransactionWithCallback(newtx, function() {
      alert("Broadcast Tx");
      $.fancybox.close();
    });


  });


  // auto-input correct address and payment amount
  //$('#lightbox_compose_to_address').val(this.publickey);
  //$('#lightbox_compose_payment').val(3);
  //$('#lightbox_compose_fee').val(raw_self.app.wallet.returnDefaultFee());
  $('.lightbox_compose_address_area').hide();
  $('.lightbox_compose_module').hide();

}

////////////////////////
// Format Transaction //
////////////////////////
Raw.prototype.formatEmailTransaction = function formatEmailTransaction(tx, app) {
  tx.transaction.msg.module = this.name;
  tx.transaction.msg.requested_identifier  = $('#module_textinput').val().toLowerCase();
  return tx;
}









