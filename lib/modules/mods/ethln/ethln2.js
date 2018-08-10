var saito = require('../../../saito');
var ModTemplate = require('../../template');
var util = require('util');
var account = require('./account.js');



//////////////////
// CONSTRUCTOR  //
//////////////////
function Ethln(app) {

  if (!(this instanceof Ethln)) { return new Ethln(app); }

  Ethln.super_.call(this);

  this.app             = app;

  this.name            = "Ethln";
  this.browser_active  = 0;
  this.handlesEmail    = 1;
  this.emailAppName    = "Ethereum Lightning Cluster";

  this.account         = null;
  this.accounts        = null;
  this.account_idx     = null;

  return this;

}
module.exports = Ethln;
util.inherits(Ethln, ModTemplate);



/////////////////////////
// Handle Web Requests //
/////////////////////////
Ethln.prototype.webServer = function webServer(app, expressapp) {

  expressapp.get('/ethln/', function (req, res) {
    res.sendFile(__dirname + '/web/index.html');
    return;
  });
  expressapp.get('/ethln/style.css', function (req, res) {
    res.sendFile(__dirname + '/web/style.css');
    return;
  });

}



Ethln.prototype.initializeLightningCluster = function initializeLightningCluster(accounts_json=null) {

  if (this.app.options.ethereum == undefined) {
    this.account = new account();
    this.account.initialize();
    this.app.options.ethereum = JSON.stringify(this.account.keys);
    this.app.storage.saveOptions();
  } else {
    this.account = new account();
    this.account.keys = JSON.parse(this.app.options.ethereum);
  }

}

Ethln.prototype.initializeAccounts = function initializeAccounts(accounts_json=null) {

  this.account_idx = null;

  if (accounts_json != null) {
    this.accounts = JSON.parse(accounts_json);
    for (var i = 0; i < this.accounts.length; i++) {
      if (this.accounts[i].publickey == this.account.returnPublicKey()) {
	this.account_idx = i;
      }
    }
  } else {
    this.accounts = [];
  }

}

Ethln.prototype.joinLightningCluster = function joinLightningCluster() {

  if (this.account_idx != null) { return; }

  this.account_idx = this.accounts.length;

  this.accounts[this.account_idx] = {};
  this.accounts[this.account_idx].saitokey                  = this.app.wallet.returnPublicKey();
  this.accounts[this.account_idx].publickey                 = this.account.returnPublicKey();
  this.accounts[this.account_idx].initial_coin_distribution = this.account.returnInitialCoinDistribution();
  this.accounts[this.account_idx].current_coin_distribution = this.account.returnCurrentCoinDistribution();
  this.accounts[this.account_idx].index_signed              = this.account.returnIndexSigned();
  this.accounts[this.account_idx].MRS                       = this.account.returnMRS();

}
Ethln.prototype.signLightningCluster = function signLightningCluster() {

  if (this.account_idx == null) { alert("Cannot sign Lightning Transaction"); return; }

  this.accounts[this.account_idx] = {};
  this.accounts[this.account_idx].saitokey                  = this.app.wallet.returnPublicKey();
  this.accounts[this.account_idx].publickey                 = this.account.returnPublicKey();
  this.accounts[this.account_idx].initial_coin_distribution = this.account.returnInitialCoinDistribution();
  this.accounts[this.account_idx].current_coin_distribution = this.account.returnCurrentCoinDistribution();
  this.accounts[this.account_idx].index_signed              = this.account.returnIndexSigned();
  this.accounts[this.account_idx].MRS                       = this.account.returnMRS();

}


Ethln.prototype.returnScriptInitialize = function returnScriptInitialize() {

  var output = '';

  output += '["';
  output += this.accounts.length;
  output += '",';

  for (var i = 0; i < this.accounts.length; i++) {
    output += '"0x000000000000000000000000';
    output += this.accounts[i].publickey;
    output += '", ';
  }

  for (var i = 0; i < this.accounts.length; i++) {
    if (i > 0) { output += ', '; }
    output += '"';
    output += this.accounts[i].initial_coin_distribution;
    output += '"';
  }

  output += ']';

  return output;

}

Ethln.prototype.returnScriptWithdraw = function returnScriptWithdraw() {

  var output = '';

  output += '[';

  for (var i = 0; i < this.accounts.length; i++) {
    output += '"' + this.accounts[i].current_coin_distribution + '"';
    output += ', ';
    output += '"' + this.accounts[i].current_coin_distribution + '"';
    output += ', ';
  }

  for (var i = 0; i < this.accounts.length; i++) {
    output += '"' + this.accounts[i].index_signed + '"';
    output += ', ';
  }

  for (var i = 0; i < this.accounts.length; i++) {
    if (i > 0) { output += ', '; }
    output += this.accounts[i].MRS;
  }

  output += ']';

  return output;

}


////////////////////////////////
// Email Client Interactivity //
////////////////////////////////
Ethln.prototype.displayEmailForm = function displayEmailForm(app) {

  this.initializeLightningCluster();
  this.initializeAccounts();
  this.joinLightningCluster();

  console.log("Accounts: " + JSON.stringify(this.accounts));

  element_to_edit = $('#module_editable_space');
  element_to_edit_html = '<div id="module_instructions" class="module_instructions">A Lightning Channel lets you send and receive Ethereum off-chain using the Saito network. This approach can be theoretically extended to provide support for channels with any number of members. Our current implementation / demo supports only two-parties. If you are a developer interested in extended ETH support in Saito please contact us.</div>';
  element_to_edit.html(element_to_edit_html);

}
/////////////////////
// Display Message //
/////////////////////
Ethln.prototype.displayEmailMessage = function displayEmailMessage(message_id, app) {

  if (app.BROWSER == 1) {
    message_text_selector = "#" + message_id + " > .data";
    $('#lightbox_message_text').html( $(message_text_selector).html() );
  }

}
////////////////////////
// Format Transaction //
////////////////////////
Ethln.prototype.formatEmailTransaction = function formatEmailTransaction(tx, app) {

  ethln_self = app.modules.returnModule("Ethln");

  var payment = prompt("How much ETH would you like to transfer to this account?", "1.0");
  payment *= 1000000000000000000;

  ethln_self.account.initial_coin_distribution = payment;
  ethln_self.account.current_coin_distribution = payment;
  ethln_self.account.index_signed              = 0;

  ethln_self.signLightningCluster();

  tx.transaction.msg.module  = this.name;
  tx.transaction.msg.request = "ethln open request";
  tx.transaction.msg.title   = "Lightning Channel Request";
  tx.transaction.msg.data    = JSON.stringify(this.accounts);
  return tx;
}



//////////////////
// Confirmation //
//////////////////
Ethln.prototype.onConfirmation = function onConfirmation(blk, tx, conf, app) {

  ethln_self = app.modules.returnModule("Ethln");

  //
  // browsers check to see if the name has been registered 
  // after 1 confirmation, assuming that servers will be 
  // processing the request on the zeroth-confirmation
  //
  if (conf == 0) {
    if (app.BROWSER == 1) {
      if (tx.transaction.to[0].add == app.wallet.returnPublicKey()) {

	var txmsg = tx.returnMessage();

        if (tx.transaction.to[0].add == app.wallet.returnPublicKey()) {

          if (txmsg.request == "ethln open request") {

            msg                 = {};
            msg.id              = tx.transaction.id;
            msg.from            = tx.transaction.from[0].add;
            msg.to              = tx.transaction.to[0].add;
            msg.time            = tx.transaction.ts;
            msg.module          = "Ethln";
            msg.title           = txmsg.title;

            ethln_self.initializeLightningCluster();
            ethln_self.initializeAccounts(txmsg.data);
            ethln_self.joinLightningCluster();

	    msg.data            = 'You have been invited to create a Lightning Channel. Proposed members:<p></p>';
	    msg.data           += '<p></p>';
            msg.data	       += '<table>';
	    for (var c = 0; c < ethln_self.accounts.length; c++) {
	      msg.data	       += '<tr>';
	      msg.data         += '<td>'+ethln_self.accounts[c].saitokey+'</td>';
	      msg.data	       += '</tr>';
	    }
            msg.data	       += '</table>';
	    msg.data           += '<p></p>';
	    msg.data           += 'To approve this, click ACCEPT and specify how much ETH you would like to add to the channel.';
	    msg.data           += '<p></p>';
	    msg.data           += '<input type="button" id="ethln_accept" class="settings_button ethln_accept" value="accept" />';

            msg.markdown 	= 0;

            app.modules.returnModule("Email").attachMessage(msg, app);
            app.archives.saveTransaction(tx);

          }
        } // isTo

        if (txmsg.request == "ethln confirm" || txmsg.request == "ethln update") {
          msg                 = {};
          msg.id              = tx.transaction.id;
          msg.from            = tx.transaction.from[0].add;
          msg.time            = tx.transaction.ts;
          msg.module          = "Ethln";
          msg.title           = txmsg.title;

          ethln_self.initializeLightningCluster();
          ethln_self.initializeAccounts(txmsg.data);
console.log("BBB1");
	  msg.data            = 'Your Lighting Cluster has '+ethln_self.accounts.length+' members.<p></p>';
          //for (var b = 0; b < ethln_self.accounts.length; b++) {
	  // if (b > 0) {  msg.data         += '<br />'; }
	  // msg.data         += ethln_self.accounts[b].saitokey;
          //}
          //msg.data           += '<p></p>';
          //msg.data           += 'The script used to initialze your smart contract is:<p></p>'+ethln_self.returnScriptInitialize();
	  msg.data           += '<p></p>';
	  msg.data    	     += 'Accounts and balances are: <p></p>';
          msg.data	     += '<table>';
          msg.data	     += '<tr><th>Account</th><th>Balance</th><th></th></tr>';
console.log("BBB2");
	  for (var c = 0; c < ethln_self.accounts.length; c++) {

	    msg.data	     += '<tr>';
	    msg.data         += '<td>'+ethln_self.accounts[c].saitokey+'</td>';
	    msg.data         += '<td>'+(ethln_self.accounts[c].current_coin_distribution/1000000000000000000)+'</td>';
	    if (ethln_self.accounts[c].saitokey == ethln_self.app.wallet.returnPublicKey()) {
	      msg.data       += '<td></td>';
	    } else {
	      msg.data       += '<td><input type="button" value="pay account" class="pay_account" id="pay_account_'+c+'" /></td>';
	    }
	    msg.data	     += '</tr>';
	  }

console.log("BBB3");
          msg.data	     += '</table>';
          msg.data	     += '<p></p>';
          msg.data	     += '<input type="button" value="withdraw" class="withdraw" id="withdraw" />';

          msg.markdown 	    = 0;
console.log("BBB4");

          app.modules.returnModule("Email").attachMessage(msg, app);
          app.archives.saveMessage(tx);
console.log("BBB5");
        }

      }
    }
  }  
}




Ethln.prototype.attachEmailEvents = function attachEmailEvents(app) {

  var ethln_self = this;

  $('.withdraw').off();
  $('.withdraw').on('click', function() {
    $('.lightbox_message_text').html( JSON.stringify(ethln_self.accounts) );
  });



  $('.pay_account').off();
  $('.pay_account').on('click', function() {
    var payment = prompt("How much ETH would you like to transfer to this account?", "1.0");
    payment *= 1000000000000000000;

    if (payment > ethln_self.accounts[ethln_self.account_idx].current_coin_distribution) {
      alert("You do not have this amount of money in the Cluster...");
      return;
    } else {


      var attr = $(this).attr("id");
      var idx  = attr.substring(12);
      var idx_int = parseInt(idx);
     
      ethln_self.accounts[idx_int].current_coin_distribution += payment;
      ethln_self.accounts[ethln_self.account_idx].current_coin_distribution -= payment;

      var to = ethln_self.accounts[0].saitokey;
      var amount = 0.0;
      var fee = 2.0;

      var newtx = app.wallet.createUnsignedTransactionWithDefaultFee(to, amount);
      
      newtx.transaction.msg.module   = ethln_self.name;
      newtx.transaction.msg.request  = "ethln update";
      newtx.transaction.msg.data     = JSON.stringify(ethln_self.accounts);
      newtx.transaction.msg.title    = "Lightning Cluster Payment Made";
      newtx.transaction.msg.markdown = 0;
      for (var k = 1; k < ethln_self.accounts.length; k++) {
        newtx = app.wallet.addRecipientToTransaction(newtx, ethln_self.accounts[k].saitokey);
      }
      newtx = app.wallet.signTransaction(newtx);

      // because we are a server, we add this to our mempool
      // before we send it out. This prevents the transaction
      // from getting rejected if sent back to us and never
      // included in a block if we are the only one handling
      // transactions.
      app.mempool.addTransaction(newtx);

      app.modules.returnModule("Email").closeMessage();
    }
  });



  $('.ethln_accept').off();
  $('.ethln_accept').on('click', function() {

    var payment = prompt("How much ETH would you like to transfer to this account?", "0.0");
    payment *= 1000000000000000000;

    var to = "";
    var amount = 0.0;
    var fee = 2.0;

    if (ethln_self.accounts.length < 1) { alert("Unexpected error in Lightning Cluster module: ethln_self.acconts.length is less than 1"); return; }

    //
    // send confirmation message to partner
    //
    var newtx = ethln_self.app.wallet.createUnsignedTransactionWithDefaultFee(ethln_self.accounts[0].saitokey, amount);
    newtx.transaction.msg.module   = ethln_self.name;
    newtx.transaction.msg.request  = "ethln confirm";
    newtx.transaction.msg.data     = "Your partner has approved the creation of an ETHLN channel and agreed to commit " + (payment/1000000000000000000) + "<p></p>" + JSON.stringify(ethln_self.accounts);
    newtx.transaction.msg.title    = "Lightning Channel Approved!";
    newtx.transaction.msg.markdown = 0;
    for (var k = 1; k < ethln_self.accounts.length; k++) {
      newtx = ethln_self.app.wallet.addRecipientToTransaction(newtx, ethln_self.accounts[k].saitokey);
    }
    newtx = ethln_self.app.wallet.signTransaction(newtx);
    ethln_self.app.mempool.addTransaction(newtx, 1);


    //
    // send confirmation email to ourselves
    //
    msg                 = {};
    msg.id              = ethln_self.app.crypt.hash(new Date().getTime());
    msg.from            = ethln_self.app.wallet.returnPublicKey();;
    msg.time            = newtx.transaction.ts;
    msg.module          = "Email";
    msg.title           = "Lightning Channel Approved";
    msg.data            = 'You have approved the creation of a Lightning Channel with: <'+ethln_self.accounts[0].saitokey+'>. Once they initialize the channel on the main chain, you will receive a message on the Saito network letting you know the contract to which you can send your deposit.';
    ethln_self.app.modules.returnModule("Email").attachMessage(msg, app);



    ethln_self.app.modules.returnModule("Email").closeMessage();

  });
}



