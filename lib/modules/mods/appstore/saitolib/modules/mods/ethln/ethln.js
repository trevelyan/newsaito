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



//
// creates channel and returns idx in accounts array
//
Ethln.prototype.openChannel = function openChannel(publickey) {

  if (this.app.options.ethereum == undefined) {
  
    this.accounts = [];
    this.accounts[this.accounts.length]           = {};
    this.accounts[this.accounts.length-1].peer    = publickey;
    this.accounts[this.accounts.length-1].account = new account();
    this.accounts[this.accounts.length-1].account.initialize();
    this.accounts[this.accounts.length-1].obj     = [];
    this.accounts[this.accounts.length-1].obj[0]  = {};
    this.accounts[this.accounts.length-1].obj[1]  = {};
    this.app.options.ethereum                     = this.accounts;
    this.app.storage.saveOptions();
    return this.accounts.length-1;

  } else {

    for (let i = 0; i < this.accounts.length; i++) {
      if (this.accounts[i].peer == publickey) {
        return i;
      }
    }

    this.accounts = this.app.options.ethereum;
    this.accounts[this.accounts.length]           = {};
    this.accounts[this.accounts.length-1].peer    = publickey;
    this.accounts[this.accounts.length-1].account = new account();
    this.accounts[this.accounts.length-1].account.initialize();
    this.accounts[this.accounts.length-1].obj     = [];
    this.accounts[this.accounts.length-1].obj[0]  = {};
    this.accounts[this.accounts.length-1].obj[1]  = {};
    this.app.options.ethereum                     = this.accounts;
    this.app.storage.saveOptions();
    return this.accounts.length-1;
    
  }
}


//
// checks if channel exists for peer
//
Ethln.prototype.existsChannel = function existsChannel(publickey) {

  if (this.app.options.ethereum == undefined) {
    return false;  
  } else {
    for (let i = 0; i < this.accounts.length; i++) {
      if (this.accounts[i].peer == publickey) {
        return true;
      }
    }
    return false;
  }
  return false;
}


Ethln.prototype.signChannel = function signChannel(idx=null) {

  if (idx == null) { alert("Cannot sign Lightning Payment"); return false; }

  this.accounts[idx].obj[0].saitokey                  = this.app.wallet.returnPublicKey();
  this.accounts[idx].obj[0].publickey                 = this.accounts[idx].account.returnPublicKey();
  this.accounts[idx].obj[0].initial_coin_distribution = this.accounts[idx].account.returnInitialCoinDistribution();
  this.accounts[idx].obj[0].current_coin_distribution = this.accounts[idx].account.returnCurrentCoinDistribution();
  this.accounts[idx].obj[0].index_signed              = this.accounts[idx].account.returnIndexSigned();
  this.accounts[idx].obj[0].MRS                       = this.accounts[idx].account.returnMRS();

  return true;

}







////////////////////////////////
// Email Client Interactivity //
////////////////////////////////
Ethln.prototype.displayEmailForm = function displayEmailForm(app) {

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

  //
  // sanity check
  //
  if (ethln_self.existsChannel(tx.transaction.to[0].add) == true) {
    alert("You already have a payment channel with this user");
    return false;
  }

  //
  // open channel
  //
  let idx = ethln_self.openChannel(tx.transaction.to[0].add);

  var payment = prompt("How much ETH would you like to transfer to this account?", "1.0");
  payment *= 1000000000000000000;

  ethln_self.accounts[idx].account.initial_coin_distribution = payment;
  ethln_self.accounts[idx].account.current_coin_distribution = payment;
  ethln_self.accounts[idx].account.index_signed              = 0;

  ethln_self.signChannel(idx);

  tx.transaction.msg.module  = this.name;
  tx.transaction.msg.request = "ethln open request";
  tx.transaction.msg.title   = "Lightning Channel Request";
  tx.transaction.msg.data    = JSON.stringify(ethln_self.accounts[idx].obj);


  //
  // and send message
  //
  msg                 = {};
  msg.id              = tx.transaction.id;
  msg.from            = tx.transaction.from[0].add;
  msg.to              = tx.transaction.to[0].add;
  msg.time            = tx.transaction.ts;
  msg.module          = "Ethln";
  msg.title           = "Lightning Channel Invitation Sent";
  msg.markdown 	= 0;
  msg.data            = 'You have invited ' + tx.transaction.to[0].add + ' to join a Lightning Channel with you.';

  app.modules.returnModule("Email").attachMessage(msg, app);

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

console.log("TESTING A");
        if (tx.transaction.to[0].add == app.wallet.returnPublicKey()) {

console.log("TESTING B");


	  ////////////////////////
	  // ethln open request //
	  ////////////////////////
          if (txmsg.request == "ethln open request") {
console.log("TESTING B2");

	    //
	    // sanity check
	    //
	    if (ethln_self.existsChannel(tx.transaction.from[0].add) == true) {
	      alert("You already have a payment channel with this user");
	      return false;
	    }

	    //
	    // open channel
	    //
	    let idx = ethln_self.openChannel(tx.transaction.from[0].add);
	    ethln_self.account_idx = idx;

console.log("WE RECEIVED THIS FROM THEM: ");
console.log(JSON.stringify(txmsg.data));

            let tmpdata = JSON.parse(txmsg.data);
            ethln_self.accounts[idx].obj[1] = tmpdata[0];
    	    ethln_self.app.options.ethereum = ethln_self.accounts;
	    ethln_self.app.storage.saveOptions();

console.log("OUR NEW OBJ IS: ");
console.log(JSON.stringify(ethln_self.accounts[idx].obj));

	    //
 	    // and send message
	    //
            msg                 = {};
            msg.id              = tx.transaction.id;
            msg.from            = tx.transaction.from[0].add;
            msg.to              = tx.transaction.to[0].add;
            msg.time            = tx.transaction.ts;
            msg.module          = "Ethln";
            msg.title           = txmsg.title;
            msg.markdown 	= 0;
	    msg.data            = 'You have been invited to create a Lightning Channel. Your counterparty proposes depositing ' + (ethln_self.accounts[idx].obj[1].current_coin_distribution/1000000000000000000) + ' ETH.';
	    msg.data           += '<p></p>';
	    msg.data           += 'To open this channel, click ACCEPT and specify your own deposit amount.';
	    msg.data           += '<p></p>';
	    msg.data           += '<input type="button" id="ethln_accept" class="settings_button ethln_accept" value="accept" />';

            app.modules.returnModule("Email").attachMessage(msg, app);
            app.archives.saveTransaction(tx);

          }




console.log("TESTING C");


	  ////////////////////////
	  // ethln confirm open //
	  ////////////////////////
          if (txmsg.request == "ethln confirm open") {

console.log("TESTING D");

	    //
	    // sanity check
	    //
	    if (ethln_self.existsChannel(tx.transaction.from[0].add) != true) {
	      alert("You do not have a payment channel with this user");
	      return false;
	    }
console.log("TESTING E");

	    //
	    // open channel
	    //
	    let idx = ethln_self.openChannel(tx.transaction.from[0].add);
	    ethln_self.account_idx = idx;

console.log("WE RECEIVED THIS FROM THEM: ");
console.log(JSON.stringify(txmsg.data));

            let tmpdata = JSON.parse(txmsg.data);
	    ethln_self.accounts[idx].obj[1] = tmpdata[0];
    	    ethln_self.app.options.ethereum = ethln_self.accounts;
	    ethln_self.app.storage.saveOptions();

	    //
 	    // post email message
	    //
            msg                 = {};
            msg.id              = tx.transaction.id;
            msg.from            = tx.transaction.from[0].add;
            msg.to              = tx.transaction.to[0].add;
            msg.time            = tx.transaction.ts;
            msg.module          = "Ethln";
            msg.title           = txmsg.title;
            msg.markdown 	= 0;
	    msg.data            = 'Your counterparty has accepted, with a deposit of ' + (ethln_self.accounts[idx].obj[1].current_coin_distribution/1000000000000000000) + ' ETH.';
	    msg.data           += '<p></p>';
	    msg.data           += 'Please open this channel and notify your counterparty when done';
	    msg.data           += '<p></p>';
	    msg.data           += '<input type="button" id="ethln_open_party1" class="settings_button ethln_open_party1" value="notify" />';

            app.modules.returnModule("Email").attachMessage(msg, app);
            app.archives.saveTransaction(tx);

	  }





	  ///////////////////////
	  // ethln open party1 //
	  ///////////////////////
          if (txmsg.request == "ethln open party1") {

	    //
	    // sanity check
	    //
	    if (ethln_self.existsChannel(tx.transaction.from[0].add) != true) {
	      alert("You do not have a payment channel with this user");
	      return false;
	    }

	    //
	    // open channel
	    //
	    let idx = ethln_self.openChannel(tx.transaction.from[0].add);
	    ethln_self.account_idx = idx;

console.log("WE RECEIVED THIS FROM THEM: ");
console.log(JSON.stringify(txmsg.data));

            let tmpdata = JSON.parse(txmsg.data);
	    ethln_self.accounts[idx].obj[1] = tmpdata[0];
    	    ethln_self.app.options.ethereum = ethln_self.accounts;
	    ethln_self.app.storage.saveOptions();

	    //
 	    // post email message
	    //
            msg                 = {};
            msg.id              = tx.transaction.id;
            msg.from            = tx.transaction.from[0].add;
            msg.to              = tx.transaction.to[0].add;
            msg.time            = tx.transaction.ts;
            msg.module          = "Ethln";
            msg.title           = txmsg.title;
            msg.markdown 	= 0;
	    msg.data            = 'You can make your deposit to the ETH channel now.';
	    msg.data           += '<p></p>';
	    msg.data           += 'When that is done, click here to notify your counterparty.';
	    msg.data           += '<p></p>';
	    msg.data           += '<input type="button" id="ethln_open_party2" class="settings_button ethln_open_party2" value="notify" />';

            app.modules.returnModule("Email").attachMessage(msg, app);
            app.archives.saveTransaction(tx);

	  }






	  ///////////////////////
	  // ethln open party2 //
	  ///////////////////////
          if (txmsg.request == "ethln open party2") {

	    //
	    // sanity check
	    //
	    if (ethln_self.existsChannel(tx.transaction.from[0].add) != true) {
	      alert("You do not have a payment channel with this user");
	      return false;
	    }

	    //
	    // open channel
	    //
	    let idx = ethln_self.openChannel(tx.transaction.from[0].add);
	    ethln_self.account_idx = idx;

console.log("WE RECEIVED THIS FROM THEM: ");
console.log(JSON.stringify(txmsg.data));

            let tmpdata = JSON.parse(txmsg.data);
	    ethln_self.accounts[idx].obj[1] = tmpdata[0];
    	    ethln_self.app.options.ethereum = ethln_self.accounts;
	    ethln_self.app.storage.saveOptions();

	    //
 	    // post email message
	    //
            msg                 = {};
            msg.id              = tx.transaction.id;
            msg.from            = tx.transaction.from[0].add;
            msg.to              = tx.transaction.to[0].add;
            msg.time            = tx.transaction.ts;
            msg.module          = "Ethln";
            msg.title           = txmsg.title;
            msg.markdown 	= 0;
	    msg.data            = 'Your ETH Lightning Channel is now open. Click below to make a payment:';
	    msg.data           += '<p></p>';
	    msg.data           += '<input type="button" id="ethln_payment" class="settings_button ethln_payment" value="make payment" />';

            app.modules.returnModule("Email").attachMessage(msg, app);
            app.archives.saveTransaction(tx);

	  }





	  ////////////////////////
	  // ethln live payment //
	  ////////////////////////
          if (txmsg.request == "ethln live payment") {

	    //
	    // sanity check
	    //
	    if (ethln_self.existsChannel(tx.transaction.from[0].add) != true) {
	      alert("You do not have a payment channel with this user");
	      return false;
	    }

	    //
	    // open channel
	    //
	    let idx = ethln_self.openChannel(tx.transaction.from[0].add);
	    ethln_self.account_idx = idx;

console.log("WE RECEIVED THIS FROM THEM: ");
console.log(JSON.stringify(txmsg.data));

            let tmpdata = JSON.parse(txmsg.data);
	    ethln_self.accounts[idx].obj[1] = tmpdata[0];
    	    ethln_self.app.options.ethereum = ethln_self.accounts;
	    ethln_self.app.storage.saveOptions();

	    //
 	    // post email message
	    //
            msg                 = {};
            msg.id              = tx.transaction.id;
            msg.from            = tx.transaction.from[0].add;
            msg.to              = tx.transaction.to[0].add;
            msg.time            = tx.transaction.ts;
            msg.module          = "Ethln";
            msg.title           = txmsg.title;
            msg.markdown 	= 0;
	    msg.data            = 'The current distribution of payments is: ';
	    msg.data           += '<p></p>';
	    msg.data           += ethln_self.accounts[idx].obj[0].saitokey;
	    msg.data           += " --> ";
	    msg.data           += (ethln_self.accounts[idx].obj[0].current_coin_distribution/1000000000000000000);
	    msg.data           += '<p></p>';
	    msg.data           += ethln_self.accounts[idx].obj[1].saitokey;
	    msg.data           += " --> ";
	    msg.data           += (ethln_self.accounts[idx].obj[1].current_coin_distribution/1000000000000000000);

	    msg.data           += '<p></p>';
	    msg.data           += '<input type="button" id="ethln_payment" class="settings_button ethln_payment" value="make payment" />';

            app.modules.returnModule("Email").attachMessage(msg, app);
            app.archives.saveTransaction(tx);

	  }
        }
      }
    }
  }  
}




Ethln.prototype.attachEmailEvents = function attachEmailEvents(app) {

  var ethln_self = this;


  //////////////////
  // ethln_accept //
  //////////////////
  $('.ethln_accept').off();
  $('.ethln_accept').on('click', function() {

    var amount = 0.0;

    var payment = prompt("How much ETH would you like to deposit into this channel?", "0.0");
    payment *= 1000000000000000000;

    ethln_self.accounts[ethln_self.account_idx].account.initial_coin_distribution = payment;
    ethln_self.accounts[ethln_self.account_idx].account.current_coin_distribution = payment;
    ethln_self.accounts[ethln_self.account_idx].index_signed = 0;

    ethln_self.signChannel(ethln_self.account_idx);

    //
    // send confirmation message
    //
    var newtx = ethln_self.app.wallet.createUnsignedTransactionWithDefaultFee(ethln_self.accounts[ethln_self.account_idx].obj[1].saitokey, amount);
    newtx.transaction.msg.module   = ethln_self.name;
    newtx.transaction.msg.request  = "ethln confirm open";
    newtx.transaction.msg.title    = "1 Lightning Channel Accepted";
    newtx.transaction.msg.data     = JSON.stringify(ethln_self.accounts[ethln_self.account_idx].obj);
    newtx.transaction.msg.markdown = 0;
    newtx = ethln_self.app.wallet.signTransaction(newtx);
    ethln_self.app.mempool.addTransaction(newtx, 1);


    //
    // email ourselves too
    //
    msg                 = {};
    msg.id              = ethln_self.app.crypto.hash(new Date().getTime());
    msg.from            = ethln_self.app.wallet.returnPublicKey();;
    msg.time            = newtx.transaction.ts;
    msg.module          = "Email";
    msg.title           = "2 Lightning Channel Accepted";
    msg.data            = 'You have agreed to open a Lightning Channel with: <'+ethln_self.accounts[ethln_self.account_idx].obj[1].saitokey+'>. Once they deposit their funds into the contract, you will be notified to deposit your own.';
    ethln_self.app.modules.returnModule("Email").attachMessage(msg, app);
    ethln_self.app.modules.returnModule("Email").closeMessage();

  });



  ///////////////////////
  // ethln_open_party1 //
  ///////////////////////
  $('.ethln_open_party1').off();
  $('.ethln_open_party1').on('click', function() {

    var amount = 0.0;

    //
    // send confirmation message
    //
    var newtx = ethln_self.app.wallet.createUnsignedTransactionWithDefaultFee(ethln_self.accounts[ethln_self.account_idx].obj[1].saitokey, amount);
    newtx.transaction.msg.module   = ethln_self.name;
    newtx.transaction.msg.request  = "ethln open party1";
    newtx.transaction.msg.title    = "Lightning Channel Pending";
    newtx.transaction.msg.data     = JSON.stringify(ethln_self.accounts[ethln_self.account_idx].obj);
    newtx.transaction.msg.markdown = 0;
    newtx = ethln_self.app.wallet.signTransaction(newtx);
    ethln_self.app.mempool.addTransaction(newtx, 1);


    //
    // email ourselves too
    //
    msg                 = {};
    msg.id              = ethln_self.app.crypto.hash(new Date().getTime());
    msg.from            = ethln_self.app.wallet.returnPublicKey();;
    msg.time            = newtx.transaction.ts;
    msg.module          = "Email";
    msg.title           = "Lightning Channel Pending";
    msg.data            = 'You have notified your counterparty that you have deposited your ETH to the smart contract managing your funds. Once your counterparty confirms, you will be able to make instant payments off-chain.';
    ethln_self.app.modules.returnModule("Email").attachMessage(msg, app);
    ethln_self.app.modules.returnModule("Email").closeMessage();

  });



  ///////////////////////
  // ethln_open_party2 //
  ///////////////////////
  $('.ethln_open_party2').off();
  $('.ethln_open_party2').on('click', function() {

    var amount = 0.0;

    //
    // send confirmation message
    //
    var newtx = ethln_self.app.wallet.createUnsignedTransactionWithDefaultFee(ethln_self.accounts[ethln_self.account_idx].obj[1].saitokey, amount);
    newtx.transaction.msg.module   = ethln_self.name;
    newtx.transaction.msg.request  = "ethln live payment";
    newtx.transaction.msg.title    = "Lightning Channel Live";
    newtx.transaction.msg.data     = JSON.stringify(ethln_self.accounts[ethln_self.account_idx].obj);
    newtx.transaction.msg.markdown = 0;
    newtx = ethln_self.app.wallet.signTransaction(newtx);
    ethln_self.app.mempool.addTransaction(newtx, 1);


    //
    // email ourselves too
    //
    msg                 = {};
    msg.id              = ethln_self.app.crypto.hash(new Date().getTime());
    msg.from            = ethln_self.app.wallet.returnPublicKey();;
    msg.time            = newtx.transaction.ts;
    msg.module          = "Email";
    msg.title           = "Lightning Channel Live";
    msg.data            = 'You are now able to make instant payments off-chain.';
    ethln_self.app.modules.returnModule("Email").attachMessage(msg, app);
    ethln_self.app.modules.returnModule("Email").closeMessage();

  });





















  $('.pay_account').off();
  $('.pay_account').on('click', function() {

    var payment = prompt("How much ETH would you like to transfer to this account?", "0.0");
    payment *= 1000000000000000000;

    if (payment > ethln_self.accounts[ethln_self.account_idx].current_coin_distribution) {
      alert("You do not have this amount of money in the Lightning Channel...");
      return;
    } else {

      ethln_self.accounts[ethln_self.account_idx].account.current_coin_distribution -= payment;
      ethln_self.accounts[ethln_self.account_idx].obj[1].current_coin_distribution += payment;

      var to = ethln_self.accounts[ethln_self.account_idx].obj[1].saitokey;
      var amount = 0.0;

      var newtx = app.wallet.createUnsignedTransactionWithDefaultFee(to, amount);
      
      newtx.transaction.msg.module   = ethln_self.name;
      newtx.transaction.msg.request  = "ethln live payment";
      newtx.transaction.msg.data     = JSON.stringify(ethln_self.accounts[ethln_self.account]);
      newtx.transaction.msg.title    = "Lightning Channel Payment Received";
      newtx.transaction.msg.markdown = 0;
      newtx = app.wallet.signTransaction(newtx);

      app.mempool.addTransaction(newtx);

      app.modules.returnModule("Email").closeMessage();
    }
  });



}



