var saito = require('../../../saito');
var ModTemplate = require('../../template');
var util = require('util');
var fs          = require('fs');
var request = require("request");









//////////////////
// CONSTRUCTOR  //
//////////////////
function Registry(app) {

  if (!(this instanceof Registry)) { return new Registry(app); }

  Registry.super_.call(this);

  this.app             = app;

  // separate database
  this.db              = null;

  this.name            = "Registry";
  this.browser_active  = 0;
  this.handlesEmail    = 1;
  this.handlesDNS      = 1;
  this.emailAppName    = "Register Address";

  this.domain          = "saito";
  this.host            = "localhost"; // hardcoded
  this.port            = "12101";     // hardcoded
  // This value will change in production. Make sure in dev this value is set correctly
  // "nR2ecdN7cW91nxVaDR4uXqW35GbAdGU5abzPJ9PkE8Mn"
  // "226GV8Bz5rwNV7aNhrDybKhntsVFCtPrhd3pZ3Ayr9x33";

  this.publickey       = "226GV8Bz5rwNV7aNhrDybKhntsVFCtPrhd3pZ3Ayr9x33";
  //this.publickey       = "nR2ecdN7cW91nxVaDR4uXqW35GbAdGU5abzPJ9PkE8Mn";

  return this;

}
module.exports = Registry;
util.inherits(Registry, ModTemplate);




////////////////////
// Install Module //
////////////////////
Registry.prototype.installModule = function installModule() {

  var registry_self = this;

  if (registry_self.app.BROWSER == 1 || registry_self.app.SPVMODE == 1) { return; }


  // we want to watch mailings FROM our key
  registry_self.app.keys.addKey(registry_self.publickey, "", "", 1, "");

  var sqlite3 = require('sqlite3').verbose();
  registry_self.db = new sqlite3.Database('./data/registry.sq3');

  sql = "\
        CREATE TABLE IF NOT EXISTS mod_registry_addresses (\
                id INTEGER, \
                identifier TEXT, \
                publickey TEXT, \
                unixtime INTEGER, \
                block_id INTEGER, \
                lock_block INTEGER DEFAULT 0, \
                block_hash TEXT, \
                signature TEXT, \
                signer TEXT, \
                longest_chain INTEGER, \
		UNIQUE (identifier), \
                PRIMARY KEY(id ASC) \
        )";


  registry_self.db.run(sql, {}, function() {

    //
    // if we are not the main server but we are running
    // the registry module, we want to be able to track
    // DNS requests, which means running our own copy
    // of the database.
    //
    if (registry_self.app.wallet.returnPublicKey() != registry_self.publickey) {

      console.log("//");
      console.log("// FETCHING DNS INFORMATION");
      console.log("// ");

      //
      // figure out where to get our master data
      //
      // we only get it from the master server if we do not have
      // another DNS server configured as an intermediary
      //
      var master_url = "https://dns.saito.network/registry/addresses.txt";
      //
      if (registry_self.app.options.dns != null) {
        for (let i = 0; i < registry_self.app.options.dns.length; i++) {
          if (registry_self.app.options.dns[i].domain == registry_self.domain) {
            if (registry_self.app.options.server != null) {
              if (registry_self.app.options.dns[i].host != registry_self.app.options.server.host) {
                var protocol = registry_self.app.options.dns[i].protocol;
                if (protocol == "") { protocol = "http"; }
                master_url = `${protocol}://${registry_self.app.options.dns[i].host}:${registry_self.app.options.dns[i].port}/registry/addresses.txt`;
                i = registry_self.app.options.dns.length+1;
              }
            }
          }
        }
      }
      //
      //
      // fetch the latest DNS data from our server
      //
      registry_self.app.logger.logInfo(`MASTER URL BEFORE REQUEST ${master_url}`)
      try {
        request.get(master_url, (error, response, body) => {
          registry_self.app.logger.logInfo(`FETCH THE LATEST DNS DATA FROM SERVER: ${response}`)
	  if (body != null) {
            var lines = body.split("\n");
            for (var m = 0; m < lines.length; m++) {
	      registry_self.addDomainRecord(lines[m]);
            }
          }
        });
      } catch (err) {}
    }
  });
}


////////////////
// Initialize //
////////////////
Registry.prototype.initialize = function initialize() {

  if (this.app.BROWSER == 1) { return; }

  var registry_self = this;

  if (this.db == null) {
    var sqlite3 = require('sqlite3').verbose();
    registry_self.db = new sqlite3.Database('./data/registry.sq3');
  }

}


/////////////////////////
// Handle Web Requests //
/////////////////////////
Registry.prototype.webServer = function webServer(app, expressapp) {

  expressapp.get('/registry/', function (req, res) {
    res.sendFile(__dirname + '/web/index.html');
    return;
  });
  expressapp.get('/registry/style.css', function (req, res) {
    res.sendFile(__dirname + '/web/style.css');
    return;
  });

  expressapp.get('/registry/addresses.txt', function (req, res) {
    res.sendFile(__dirname + '/web/addresses.txt');
    return;
  });

}






////////////////////////////////
// Email Client Interactivity //
////////////////////////////////
Registry.prototype.displayEmailForm = function displayEmailForm(app) {

  element_to_edit = $('#module_editable_space');

  $('#lightbox_compose_to_address').val(this.publickey);
  $('#lightbox_compose_payment').val(3);
  $('#lightbox_compose_fee').val(app.wallet.returnDefaultFee());
  $('.lightbox_compose_address_area').hide();
  $('.lightbox_compose_module').hide();
  $('#module_textinput').focus();

  element_to_edit_html = '<div id="module_instructions" class="module_instructions">Register a human-readable email address:<p></p><input type="text" class="module_textinput" id="module_textinput" value="" /><div class="module_textinput_details">@'+this.domain+'</div><p style="clear:both;margin-top:0px;"> </p>ASCII characters only, e.g.: yourname@'+this.domain+', etc. <p></p><div id="module_textinput_button" class="module_textinput_button" style="margin-left:0px;margin-right:0px;">register</div></div>';
  element_to_edit.html(element_to_edit_html);

  $('#module_textinput').off();
  $('#module_textinput').on('keypress', function(e) {
    if (e.which == 13 || e.keyCode == 13) {
      $('#module_textinput_button').click();
    }
  });

  $('#module_textinput_button').off();
  $('#module_textinput_button').on('click', function() {
    var identifier_to_check = $('.module_textinput').val();
    var regex=/^[0-9A-Za-z]+$/;
    if (regex.test(identifier_to_check)) {
      $('#send').click();
    } else {
      alert("Only Alphanumeric Characters Permitted");
    }
  });


}
/////////////////////
// Display Message //
/////////////////////
Registry.prototype.displayEmailMessage = function displayEmailMessage(message_id, app) {

  if (app.BROWSER == 1) {

    message_text_selector = "#" + message_id + " > .data";
    $('#lightbox_message_text').html( $(message_text_selector).html() );
    $('#lightbox_compose_to_address').val(registry_self.publickey);
    $('#lightbox_compose_payment').val(3);
    $('#lightbox_compose_fee').val(app.wallet.returnDefaultFee());

  }

}
////////////////////////
// Format Transaction //
////////////////////////
Registry.prototype.formatEmailTransaction = function formatEmailTransaction(tx, app) {
  tx.transaction.msg.module = this.name;
  tx.transaction.msg.requested_identifier  = $('#module_textinput').val().toLowerCase();
  return tx;
}









//////////////////
// Confirmation //
//////////////////
Registry.prototype.onConfirmation = function onConfirmation(blk, tx, conf, app) {

  var registry_self = app.modules.returnModule("Registry");

  //////////////
  // BROWSERS //
  //////////////
  //
  // check if name registered
  //
  if (conf == 1) {
    if (app.BROWSER == 1) {
      if (tx.transaction.to[0].add == app.wallet.returnPublicKey()) {
        full_identifier = tx.transaction.msg.requested_identifier + "@" + app.modules.returnModule("Registry").domain;
        app.dns.fetchPublicKey(full_identifier, function(answer, publickey="") {
          if (answer == app.wallet.returnPublicKey()) {
            app.keys.addKey(app.wallet.returnPublicKey(), full_identifier, 0);
            app.keys.saveKeys();
            app.wallet.updateIdentifier(full_identifier);
          }
        });
      }
    }
  }
  if (app.BROWSER == 1) { return; }



  /////////////
  // SERVERS //
  /////////////
  //
  // register identifiers
  //
  if (conf == 0) {

    if (tx.transaction.msg != null) {

      var txmsg = tx.returnMessage();

      //
      // monitor confirmation from master server
      //
      if (txmsg.module == "Email") {

        if (tx.transaction.to[0].add != registry_self.publickey) { return; }
        // if (registry_self.publickey != app.wallet.returnPublicKey()) { return; }
        if (txmsg.sig == "") { return; }

        var sig = txmsg.sig;

        registry_self.addDomainRecord(txmsg.sig);
        return;

      }

      //
      // monitor registration requests
      //
      if (txmsg.module == "Registry") {
        registry_self.app.logger.logInfo(`Logging outcome of onConfirmation`)
        registry_self.app.logger.logInfo(`TRANSACTION TO ADD: ${tx.transaction.to[0].add}`)
        registry_self.app.logger.logInfo(`REGISTRY PUBKEY: ${registry_self.publickey}`)
        if (tx.transaction.to[0].add != registry_self.publickey) { return; }
        // if (registry_self.publickey != app.wallet.returnPublicKey()) { return; }
        if (tx.transaction.msg.requested_identifier == "") { return; }

        full_identifier = tx.transaction.msg.requested_identifier + "@" + app.modules.returnModule("Registry").domain;
        if (full_identifier.indexOf("'") > 0) { return; }
        full_identifier = full_identifier.replace(/\s/g, '');
        //registry_self.app.logger.logInfo(`IF YOU'RE PUBLIC, YOU SHOULD NOT GET HERE`)
        registry_self.addDatabaseRecord(tx, blk, full_identifier);

      }
    }
  }
}










/////////////////////////
// Handle DNS Requests //
/////////////////////////
//
// this handles zero-free requests sent peer-to-peer across the Saito network
// from hosts to DNS providers.
//
Registry.prototype.handleDomainRequest = function handleDomainRequest(app, message, peer, mycallback) {

  var registry_self = this;

  let identifier = message.data.identifier;
  let publickey  = message.data.publickey;

  let dns_response            = {};
  dns_response.err            = "";
  dns_response.publickey      = "";
  dns_response.identifier     = "";


  if (identifier != null) {
    sql = "SELECT * FROM mod_registry_addresses WHERE longest_chain = 1 AND identifier = $identifier";
    params = { $identifier : identifier };
    registry_self.db.get(sql, params, function (err, row) {
      if (row != null) {
        if (row.publickey != null) {
          dns_response.err        = "";
          dns_response.identifier = row.identifier;
          dns_response.publickey  = row.publickey;
          dns_response.unixtime   = row.unixtime;
          dns_response.block_id   = row.block_id;
          dns_response.block_hash = row.block_hash;
          dns_response.signer     = row.signer;
          dns_response.signature  = row.signature;
	  mycallback(JSON.stringify(dns_response));
        }
      } else {
        dns_response.err = "identifier not found";
	mycallback(JSON.stringify(dns_response));
      }
    });
  }

  if (publickey != null) {
    sql = "SELECT * FROM mod_registry_addresses WHERE publickey = $publickey";
    params = { $publickey : publickey };
    registry_self.db.get(sql, params, function (err, row) {
      if (row != null) {
        if (row.publickey != null) {
          dns_response.err        = "";
          dns_response.identifier = row.identifier;
          dns_response.publickey  = row.publickey;
          dns_response.unixtime   = row.unixtime;
          dns_response.block_id   = row.block_id;
          dns_response.block_hash = row.block_hash;
          dns_response.signer     = row.signer;
          dns_response.signature  = row.signature;
          mycallback(JSON.stringify(dns_response));
        }
      } else {
        dns_response.err = "publickey not found";
        mycallback(JSON.stringify(dns_response));
      }
    });
  }

}


Registry.prototype.onChainReorganization  = function onChainReorganization(block_id, block_hash, lc) {

  var registry_self = this;

  //
  // browsers don't have a database tracking this stuff
  //
  if (registry_self.app.BROWSER == 1) { return; }

  if (lc == 0) {
    var sql    = "UPDATE mod_registry_addresses SET longest_chain = 0 WHERE block_id = $block_id AND block_hash = $block_hash";
    var params = { $block_id : block_id , $block_hash : block_hash }
    registry_self.db.run(sql, params, function(err, row) {});
  }

  if (lc == 1) {
    var sql    = "UPDATE mod_registry_addresses SET longest_chain = 1 WHERE block_id = $block_id AND block_hash = $block_hash";
    var params = { $block_id : block_id , $block_hash : block_hash }
    registry_self.db.run(sql, params, function(err, row) {});
  }


  // write to addresses.txt
  var msg = "UPDATE" + "\t" + block_id + "\t" + block_hash + "\t" + lc + "\n";
  fs.appendFileSync((__dirname + "/web/addresses.txt"), msg, function(err) { if (err) { }; });

}




//
// listen to EMAIL from our public server
//
Registry.prototype.shouldAffixCallbackToModule = function shouldAffixCallbackToModule(modname) {
  if (modname == this.name) { return 1; }
  if (modname == "Email") { return 1; }
  return 0;
}



/////////////////////
// addDomainRecord //
/////////////////////
//
// the master server does not run this, but child servers do
//
Registry.prototype.addDomainRecord = function addDomainRecord(sigline) {

  if (this.app.BROWSER == 1) { return; }

  var registry_self = this;
  var write_to_file = sigline + "\n";
  var line = sigline.split("\t");

  if (line.length != 7) {

    if (line.length != 4) { return; }

    ////////////
    // UPDATE //
    ////////////
    var action     = line[0];
    var block_id   = line[1];
    var block_hash = line[2];
    var lc         = line[3];

    if (action == "UPDATE") {

      var sql    = "UPDATE mod_registry_addresses SET longest_chain = $lc WHERE block_id = $block_id AND block_hash = $block_hash";
      var params = { 
	$block_id : block_id,
	$block_hash : block_hash,
	$lc : lc
      }

//console.log("UPDATING: ");
//console.log(sql);
//console.log(JSON.stringify(params));

      registry_self.db.run(sql, params, function(err, row) {});
    }

  } else {

    ////////////
    // INSERT //
    ////////////
    var action     = line[0];
    var identifier = line[1];
    var block_id   = line[2];
    var block_hash = line[3];
    var address    = line[4];
    var unixtime   = line[5];
    var sig        = line[6];
    var signer     = line[7];

    if (signer != registry_self.publickey) {} else {

      if (action == "INSERT") {

        var msgtosign   = identifier + address + block_id + block_hash;
        var msgverifies = registry_self.app.crypt.verifyMessage(msgtosign, sig, signer);

        if (msgverifies == true) {
          var lock_block = block_id+(registry_self.app.blockchain.genesis_period + registry_self.app.blockchain.fork_guard);
          var sql = "INSERT OR IGNORE INTO mod_registry_addresses (identifier, publickey, unixtime, block_id, lock_block, block_hash, signature, signer, longest_chain) VALUES ($identifier, $publickey, $unixtime, $block_id, $lock_block, $block_hash, $sig, $signer, $longest_chain)";
          var params = {
            $identifier : identifier,
            $publickey : address,
            $unixtime : unixtime,
            $block_id : block_id,
            $lock_block : lock_block,
            $block_hash : block_hash,
            $sig : sig,
            $signer : signer,
            $longest_chain : 1
          }
          fs.appendFileSync((__dirname + "/web/addresses.txt"), write_to_file, function(err) { if (err) { }; });

//console.log("INSERTING: ");
//console.log(sql);
//console.log(JSON.stringify(params));

          registry_self.db.run(sql, params, function(err) {});
        }
      }
    }
  }
}



///////////////////////
// addDatabaseRecord //
///////////////////////
//
// the master record does this ...
//
Registry.prototype.addDatabaseRecord = function addDatabaseRecord(tx, blk, identifier) {

  var registry_self = this;
  var tmsql = "SELECT count(*) AS count FROM mod_registry_addresses WHERE identifier = $identifier";
  var params = { $identifier : identifier }

  registry_self.db.get(tmsql, params, function(err, row) {
    if (row != null) {
      if (row.count == 0) {

        var msgtosign   = full_identifier + tx.transaction.from[0].add + blk.block.id + blk.returnHash();
        var registrysig = registry_self.app.crypt.signMessage(msgtosign, registry_self.app.wallet.returnPrivateKey());
        var sql = "INSERT OR IGNORE INTO mod_registry_addresses (identifier, publickey, unixtime, block_id, block_hash, signature, signer, longest_chain) VALUES ($identifier, $publickey, $unixtime, $block_id, $block_hash, $sig, $signer, $longest_chain)";
        var params = { $identifier : full_identifier, $publickey : tx.transaction.from[0].add, $unixtime : tx.transaction.ts , $block_id : blk.returnId(), $block_hash : blk.returnHash(), $sig : registrysig , $signer : registry_self.app.wallet.returnPublicKey(), $longest_chain : 1 };

        var sqlwrite = "INSERT" + "\t" + full_identifier + "\t" + blk.block.id + "\t" + blk.returnHash() + "\t" + tx.transaction.from[0].add + "\t" + tx.transaction.ts + "\t" + registrysig + "\t" + registry_self.app.wallet.returnPublicKey() + "\n";
        fs.appendFileSync((__dirname + "/web/addresses.txt"), sqlwrite, function(err) { if (err) { return console.log(err); } });

        registry_self.db.run(sql, params, function() {

          if (tx.transaction.to[0].add == registry_self.publickey && registry_self.publickey == registry_self.app.wallet.returnPublicKey()) {

            var to = tx.transaction.from[0].add;
            var from = registry_self.app.wallet.returnPublicKey();
            var amount = 0.0;

            registry_self.app.logger.logInfo(`THIS IS WHERE THE TX IS BEING SENT TO: ${to}`)
            registry_self.app.logger.logInfo(`THIS IS WHERE THE TX IS BEING SENT FROM: ${from}`)

            server_email_html = 'You can now receive emails (and more!) at this address:<p></p>'+tx.transaction.msg.requested_identifier+'@'+registry_self.domain+'<p></p>To configure your browser to use this address, <div class="register_email_address_success" style="text-decoration:underline;cursor:pointer;display:inline;">please click here</div>.';

            newtx = registry_self.app.wallet.createUnsignedTransactionWithDefaultFee(to, amount);
            console.log(JSON.stringify(newtx));
            if (newtx == null) { return; }
            newtx.transaction.msg.module   = "Email";
            newtx.transaction.msg.data     = server_email_html;
            newtx.transaction.msg.title    = "Address Registration Success!";
            newtx.transaction.msg.sig      = sqlwrite;
            newtx.transaction.msg.markdown = 0;
            newtx = registry_self.app.wallet.signTransaction(newtx);
            registry_self.app.mempool.addTransaction(newtx);
          }
        });
      } else {

	if (registry_self.publickey == registry_self.app.wallet.returnPublicKey()) {

          // identifier already registered
          to = tx.transaction.from[0].add;
          from = registry_self.app.wallet.returnPublicKey();
          amount = 0;

          server_email_html = full_identifier + ' is already registered';

          newtx = registry_self.app.wallet.createUnsignedTransactionWithDefaultFee(to, amount);
          if (newtx == null) { return; }
          newtx.transaction.msg.module = "Email";
          newtx.transaction.msg.data   = server_email_html;
          newtx.transaction.msg.title  = "Address Registration Failure!";
          newtx = registry_self.app.wallet.signTransaction(newtx);
          registry_self.app.mempool.addTransaction(newtx);

	}

      }
    }
  });
}





