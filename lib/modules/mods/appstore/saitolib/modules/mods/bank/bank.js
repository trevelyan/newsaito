//
// This module monitors the blockchain and our
// unspent transaction inputs.
//
// Right now it just monitors to see how many
// transaction inputs we have and bundles them
// together occasionally to keep our wallet/
// options file from getting unwieldy.
//
var saito = require('../../../saito');
var ModTemplate = require('../../template');
var util = require('util');


//////////////////
// CONSTRUCTOR  //
//////////////////
function Bank(app) {

  if (!(this instanceof Bank)) { return new Bank(app); }

  Bank.super_.call(this);

  this.app             = app;
  this.name            = "Bank";
  this.browser_active  = 0;

  this.handlesEmail    = 1;
  this.emailAppName    = "Bank";

  this.db 		 = null;
  this.rebroadcast_limit = 100;
  this.rebroadcast_fee   = 0.0001;

  // This is a production key directly linked to our instance of Saito
  // Make sure to edit this key to use your publickey for development purposes
  // "nR2ecdN7cW91nxVaDR4uXqW35GbAdGU5abzPJ9PkE8Mn"
  this.bank_publickey = "vvkqbFqboN3UQmyGUgrcWH8349XGnNpWqcCNRHFSp6G3"
  this.bank_privatekey = app.wallet.returnPrivateKey();

  return this;

}
module.exports = Bank;
util.inherits(Bank, ModTemplate);



/////////////////////////
// Handle Web Requests //
/////////////////////////
Bank.prototype.webServer = function webServer(app, expressapp) {

  expressapp.get('/bank/', function (req, res) {
    res.sendFile(__dirname + '/web/index.html');
    return;
  });
  expressapp.get('/bank/style.css', function (req, res) {
    res.sendFile(__dirname + '/web/style.css');
    return;
  });
  expressapp.get('/bank/script.js', function (req, res) {
    res.sendFile(__dirname + '/web/script.js');
    return;
  });

}




Bank.prototype.installModule = function installModule() {

  if (this.app.BROWSER == 1 || this.app.SPVMODE == 1) { return; }

  var bank_self = this;

  var sqlite3 = require('sqlite3').verbose();
  this.db = new sqlite3.Database('./data/bank.sq3');

  sql = "\
        CREATE TABLE IF NOT EXISTS mod_bank (\
                id INTEGER, \
                parent_id INTEGER, \
                depositor_publickey TEXT, \
                vault_publickey TEXT, \
                vault_privatekey TEXT, \
                unixtime INTEGER, \
                rebroadcast INTEGER, \
                rebroadcast_block_id INTEGER, \
                rebroadcast_block_hash TEXT, \
                tx TEXT, \
                block_id INTEGER, \
                tx_id INTEGER, \
                slip_id INTEGER, \
                bhash TEXT, \
                longest_chain INTEGER, \
                PRIMARY KEY(id ASC) \
        ); \
  ";
  this.db.run(sql, {}, function() {
    bank_self.db.run("CREATE INDEX mod_bank_idx ON mod_bank(depositor_publickey, rebroadcast, longest_chain)", {}, function() {});
    bank_self.db.run("CREATE INDEX mod_bank_idx2 ON mod_bank(rebroadcast, longest_chain)", {}, function() {});
  });

}
Bank.prototype.initialize = function initialize() {

  if (this.app.BROWSER == 1 || this.app.SPVMODE == 1) { return; }

  if (this.db == null) {
    var sqlite3 = require('sqlite3').verbose();
    this.db = new sqlite3.Database('./data/bank.sq3');
  }

}









////////////////////////////////
// Email Client Interactivity //
////////////////////////////////
Bank.prototype.displayEmailForm = function displayEmailForm(app) {

  var bank_self = this;

  element_to_edit = $('#module_editable_space');

  element_to_edit_html = `
    <div id="module_instructions" class="module_instructions">

      Send a payment to our bank to deposit funds. Our bank will work to keep your balance active on the blockchain. You may also check your balance or withdraw tokens:
      <p></p>
      <input type="button" id="withdraw_button" class="withdraw_button bank_button" value="Withdraw SAITO" style="float:left;margin-right:30px" />
      <input type="button" id="check_balance" class="check_balance bank_button" value="Check Balance" style="float:left" />

    </div>
   `;

  element_to_edit.html(element_to_edit_html);

  // auto-input correct address and payment amount
  //$('#lightbox_compose_address_area').hide();
  //$('#lightbox_compose_module').hide();

  $('#lightbox_compose_to_address').val(this.bank_publickey);
  $('#lightbox_compose_fee').val(bank_self.app.wallet.returnDefaultFee());
  $('#module_textinput').focus();

  $('#withdraw_button').off();
  $('#withdraw_button').on('click', function() {

    // withdrawal request
    newtx = bank_self.app.wallet.createUnsignedTransactionWithDefaultFee(bank_self.bank_publickey, 0.0);
    if (newtx == null) {
      bank_self.app.modules.returnModule("Email").showBrowserAlert("Error Sending Withdrawal Request -- out of tokens?");
      bank_self.app.modules.returnModule("Email").closeMessage();
      return; 
    }
    newtx.transaction.msg.module       = "Bank";
    newtx.transaction.msg.data         = {};
    newtx.transaction.msg.data.request = "withdrawal";
    newtx = bank_self.app.wallet.signTransaction(newtx);
    bank_self.app.mempool.addTransaction(newtx);

    bank_self.app.modules.returnModule("Email").showBrowserAlert("Bank Withdrawal Request Sent");
    bank_self.app.modules.returnModule("Email").closeMessage();

  });


  $('#check_balance').off();
  $('#check_balance').on('click', function() {

    // withdrawal request
    newtx = bank_self.app.wallet.createUnsignedTransactionWithDefaultFee(bank_self.bank_publickey, 0.0);
    if (newtx == null) { 
      bank_self.app.modules.returnModule("Email").showBrowserAlert("Error Sending Balance Inquiry -- out of tokens?");
      bank_self.app.modules.returnModule("Email").closeMessage();
      return; 
    }
    newtx.transaction.msg.module       = "Bank";
    newtx.transaction.msg.data         = {};
    newtx.transaction.msg.data.request = "balance";
    newtx = bank_self.app.wallet.signTransaction(newtx);
    bank_self.app.mempool.addTransaction(newtx);

    bank_self.app.modules.returnModule("Email").showBrowserAlert("Account Balance Inquiry Sent");
    bank_self.app.modules.returnModule("Email").closeMessage();

  });




}
////////////////////////
// Format Transaction //
////////////////////////
Bank.prototype.formatEmailTransaction = function formatEmailTransaction(tx, app) {
  tx.transaction.msg.module = this.name;
  tx.transaction.msg.data   = {};
  tx.transaction.msg.data.request = "deposit";
  return tx;
}









Bank.prototype.onChainReorganization = function onChainReorganization(block_id, block_hash, lc) {
  var bank_self = this;
  if (bank_self.app.BROWSER == 1 || bank_self.app.SPVMODE == 1) { return; }
  var sql    = "UPDATE mod_bank SET rebroadcast = $lc WHERE rebroadcast_block_id = $rbi, rebroadcast_block_hash = $rbh";
  var params = { $rbi : block_id , $rbh : block_hash , $lc : lc }
  bank_self.db.run(sql, params, function() {});
}





Bank.prototype.onConfirmation = function onConfirmation(blk, tx, conf, app) {

  var bank_self = app.modules.returnModule("Bank");

  if (bank_self.app.BROWSER == 1 || bank_self.app.SPVMODE == 1) { return; }

  if (tx.transaction.to[0].add != bank_self.bank_publickey) { return; }
  if (tx.transaction.msg.data == null) { return; }

  var bank_req  = tx.transaction.msg.data.request;



  if (bank_req == "deposit") {

    //////////////////////
    // PROCESS DEPOSITS //
    //////////////////////
    if (conf == 0) {

      var deposit_id   = 0;
      var depositor    = tx.transaction.from[0].add;
      var deposit_amt  = tx.transaction.to[0].amt;

      if (tx.transaction.msg.deposit != null) { 
        deposit_id = tx.transaction.msg.deposit; 
        depositor  = tx.transaction.msg.depositor;
      }

      if (deposit_id == 0) {

        /////////////////
        // NEW DEPOSIT //
        /////////////////
        var dp_publickey     = tx.transaction.from[0].add;
        var dp_unixtime      = tx.transaction.ts;
        var bank_parent_id   = 0;
        var bank_publickey   = bank_self.bank_publickey;
        var bank_privatekey  = bank_self.bank_privatekey;
        var bank_rebroadcast = 0;
        var dp_block_id      = blk.block.id;;
        var dp_tx_id         = tx.transaction.id;
        var dp_slip_id       = 0;
        var dp_lc            = 1;
        var dp_bhash         = blk.returnHash();

        var sql    = "INSERT INTO mod_bank (parent_id, depositor_publickey, vault_publickey, vault_privatekey, unixtime, rebroadcast, rebroadcast_block_id, rebroadcast_block_hash, tx, block_id, tx_id, slip_id, longest_chain, bhash) VALUES ($parent_id, $depositor_publickey, $vault_publickey, $vault_privatekey, $unixtime, $rebroadcast, 0, $rebroadcast_block_hash, $tx, $block_id, $tx_id, $slip_id, $longest_chain, $bhash)";
        var params = { 
	  $parent_id : bank_parent_id, 
	  $depositor_publickey : dp_publickey  , 
	  $vault_publickey : bank_publickey, 
	  $vault_privatekey : bank_privatekey , 
	  $unixtime : dp_unixtime, 
	  $rebroadcast : bank_rebroadcast, 
	  $rebroadcast_block_hash : "" ,
	  $tx :  tx.returnTransactionJson(), 
	  $block_id :  dp_block_id, 
	  $tx_id :  dp_tx_id, 
	  $slip_id :  dp_slip_id, 
	  $longest_chain : dp_lc,
	  $bhash : dp_bhash 
        }

        bank_self.db.run(sql, params, function(err) {

          // send an email
          newtx = bank_self.app.wallet.createUnsignedTransactionWithDefaultFee(depositor, 0.0);
          if (newtx == null) { return; }
          newtx.transaction.msg.module = "Email";
          newtx.transaction.msg.title  = "Saito Bank - Deposit Received";
          newtx.transaction.msg.data   = 'Your '+deposit_amt+' deposit has been received.';
          newtx = bank_self.app.wallet.signTransaction(newtx);
          bank_self.app.mempool.addTransaction(newtx);

        });

      } else {

        /////////////////
        // OLD DEPOSIT //
        /////////////////
        //
        // depositor and parent_id are pulled
        // from the transaction
        //
        var dp_publickey     = depositor;
        var dp_unixtime      = tx.transaction.ts;
        var bank_parent_id   = deposit_id;
        var bank_publickey   = bank_self.bank_publickey;
        var bank_privatekey  = bank_self.bank_privatekey;
        var bank_rebroadcast = 0;
        var dp_block_id      = blk.block.id;
        var dp_tx_id         = tx.transaction.id;
        var dp_slip_id       = 0;
        var dp_lc            = 1;
        var dp_bhash         = blk.returnHash();

        var sql    = "INSERT INTO mod_bank (parent_id, depositor_publickey, vault_publickey, vault_privatekey, unixtime, rebroadcast, rebroadcast_block_id, rebroadcast_block_hash, tx, block_id, tx_id, slip_id, longest_chain, bhash) VALUES ($parent_id, $depositor_publickey, $vault_publickey, $vault_privatekey, $unixtime, $rebroadcast, 0, $rebroadcast_block_hash, $tx, $block_id, $tx_id, $slip_id, $longest_chain, $bhash)";
        var params = { 
	  $parent_id : bank_parent_id, 
	  $depositor_publickey : dp_publickey ,
	  $vault_publickey : bank_publickey ,
	  $vault_privatekey : bank_privatekey ,
	  $unixtime : dp_unixtime ,
	  $rebroadcast : bank_rebroadcast ,
	  $rebroadcast_block_hash : "" ,
	  $tx :  tx.returnTransactionJson() ,
	  $block_id :  dp_block_id ,
	  $tx_id :  dp_tx_id ,
	  $slip_id :  dp_slip_id ,
	  $longest_chain : dp_lc,
	  $bhash : dp_bhash 
        }

        bank_self.db.run(sql, params, function(err) {

	  /////////////////////
	  // UPDATE DATABASE //
	  /////////////////////
          var sql2    = "UPDATE mod_bank SET rebroadcast = 1, rebroadcast_block_id = $rbi, rebroadcast_block_hash = $rbh WHERE id = $id";
	  var params2 = { $id : deposit_id , $rbi : dp_block_id , $rbh : dp_bhash }
          bank_self.app.storage.execDatabase(sql2, params2, function() {});

          ///////////////////
          // send an email //
          ///////////////////
          newtx = bank_self.app.wallet.createUnsignedTransactionWithDefaultFee(depositor, 0.0);
          if (newtx == null) { return; }
          newtx.transaction.msg.module = "Email";
          newtx.transaction.msg.title  = "Saito Bank - Payment Relayed";
          newtx.transaction.msg.data   = 'Your deposit at the Bank of Saito has been relayed across the network.';
          newtx = bank_self.app.wallet.signTransaction(newtx);
          bank_self.app.mempool.addTransaction(newtx);

        });
      }
    }
  }


  if (bank_req == "withdrawal") {
  if (conf == 0) {

    var withdrawal_address = tx.transaction.from[0].add;

    var bank_sql = "SELECT * FROM mod_bank WHERE depositor_publickey = $depositor_publickey AND rebroadcast = 0 AND longest_chain = 1";
    var params   = { $depositor_publickey : withdrawal_address }
    bank_self.db.all(bank_sql, params, function(err, rows) {
      if (rows != null) {
	if (rows.length == 0) {


	} else {
          for (var x = 0; x < rows.length; x++) {
            var row = rows[x];
            var oldtx = new saito.transaction(row.tx);
        
            // rebroadcast to the original address
            var to              = row.depositor_publickey;
            var send_amt        = (oldtx.transaction.to[0].amt - bank_self.rebroadcast_fee).toFixed(8);
            var slip_address    = row.vault_publickey;
            var slip_amt        = oldtx.transaction.to[0].amt;
            var slip_bid        = row.block_id;
            var slip_tid        = row.tx_id;
            var slip_sid        = row.slip_id;
            var slip_bhash      = row.bhash;
            var slip_publickey  = row.vault_publickey;
            var slip_privatekey = row.vault_privatekey;
            var tx_msg          = { module : "Email" , title : "Saito Bank - Withdrawal Processed" , data : "Your withdrawal from Saito Bank has been processed" };
        
            var newtx = bank_self.app.wallet.createSignedTransactionWithForeignKey(to, send_amt, slip_address, slip_amt, slip_bid, slip_tid, slip_sid, slip_bhash, slip_publickey, slip_privatekey, tx_msg);
            bank_self.app.mempool.addTransaction(newtx);

	    // update database to inform that transaction was sent
	    var sql2    = "UPDATE mod_bank SET rebroadcast = 1 WHERE id = $id";
	    var params2 = { $id : row.id }; 
	    bank_self.db.run(sql2, params2, function(err) {   
	    });
	  }
        }
      }
    });

  }  // 0-conf
  }



  if (bank_req == "balance") {
  if (conf == 0) {

    var withdrawal_address = tx.transaction.from[0].add;

    var bank_sql = "SELECT * FROM mod_bank WHERE depositor_publickey = $depositor_publickey AND rebroadcast = 0 AND longest_chain = 1";
    var params   = { $depositor_publickey : withdrawal_address }
    var amount_in_bank = 0.0;
    bank_self.db.all(bank_sql, params, function(err, rows) {
      if (rows != null) {
	if (rows.length == 0) {

          ///////////////////
          // send an email //
          ///////////////////
          newtx = bank_self.app.wallet.createUnsignedTransactionWithDefaultFee(withdrawal_address, 0.0);
          if (newtx == null) { return; }
          newtx.transaction.msg.module = "Email";
          newtx.transaction.msg.title  = "Saito Bank - Balance Update";
          newtx.transaction.msg.data   = "Your account does not have any SAITO in storage.";
          newtx = bank_self.app.wallet.signTransaction(newtx);
          bank_self.app.mempool.addTransaction(newtx);

	} else {
          for (var x = 0; x < rows.length; x++) {
            var row = rows[x];
            var oldtx = new saito.transaction(row.tx);
        
            amount_in_bank = parseFloat(amount_in_bank) + parseFloat(oldtx.transaction.to[0].amt);

            ///////////////////
            // send an email //
            ///////////////////
            newtx = bank_self.app.wallet.createUnsignedTransactionWithDefaultFee(withdrawal_address, 0.0);
            if (newtx == null) { return; }
            newtx.transaction.msg.module = "Email";
            newtx.transaction.msg.title  = "Saito Bank - Balance Update";
            newtx.transaction.msg.data   = "Your account has " + amount_in_bank + " SAITO in storage.";
            newtx = bank_self.app.wallet.signTransaction(newtx);
            bank_self.app.mempool.addTransaction(newtx);

	  }
        }
      }
    });

  }  // 0-conf
  }

}




Bank.prototype.onNewBlock = function onNewBlock(blk) {

  if (this.app.BROWSER == 1 || this.app.SPVMODE == 1) { return; }

  var bank_self = this;

  var rebroadcast_limit = blk.block.id - this.rebroadcast_limit;

  if (rebroadcast_limit < 0) { rebroadcast_limit = 0; }


  var bank_sql = "SELECT * FROM mod_bank WHERE block_id < $block_id AND rebroadcast_block_id < $rbi AND rebroadcast = 0 AND longest_chain = 1";
  // rbi gives us two blocks to process before we re-try
  var params   = { $block_id : rebroadcast_limit , $rbi : (blk.block.id - 3) }

  this.db.all(bank_sql, params, function(err, rows) {
    if (rows != null) {
      for (var x = 0; x < rows.length; x++) {
        var row = rows[x];

	var oldtx = new saito.transaction(row.tx);

	// rebroadcast to the same address
	var to              = row.vault_publickey;
	var send_amt        = (oldtx.transaction.to[0].amt - bank_self.rebroadcast_fee).toFixed(8);
        var slip_address    = row.vault_publickey;
	var slip_amt        = oldtx.transaction.to[0].amt;
        var slip_bid        = row.block_id;
        var slip_tid        = row.tx_id;
        var slip_sid        = row.slip_id;
        var slip_bhash      = row.bhash;
        var slip_publickey  = row.vault_publickey;
        var slip_privatekey = row.vault_privatekey;
        var tx_msg          = { module : "Bank" , deposit : row.id , depositor : row.depositor_publickey , data : { request : "deposit" } };

        if (send_amt < 0.0001) {

	  var sql3 = "UPDATE mod_bank SET rebroadcast = 1 WHERE id = $myid";
	  var params3 = { $myid : row.id };
	  bank_self.app.storage.execDatabase(sql3, params3, function(){});

	} else {

          var newtx = bank_self.app.wallet.createSignedTransactionWithForeignKey(to, send_amt, slip_address, slip_amt, slip_bid, slip_tid, slip_sid, slip_bhash, slip_publickey, slip_privatekey, tx_msg);
	  bank_self.app.mempool.addTransaction(newtx);

	}
      }
    }
  });

}





Bank.prototype.initializeHTML = function initializeHTML(app) {
}
Bank.prototype.attachEvents = function attachEvents(app) {
}





