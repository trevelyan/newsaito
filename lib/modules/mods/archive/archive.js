const saito = require('../../../saito');
const ModTemplate = require('../../template');
const util = require('util');


//////////////////
// CONSTRUCTOR  //
//////////////////
function Archive(app) {

  if (!(this instanceof Archive)) { return new Archive(app); }

  Archive.super_.call(this);

  this.app             = app;

  this.name            = "Archive";
  this.browser_active  = 0;

  this.host            = "localhost"; // hardcoded
  this.port            = "12100";     // hardcoded
  this.publickey       = "";          // hardcoded

  return this;

}
module.exports = Archive;
util.inherits(Archive, ModTemplate);



////////////////
// Initialize //
////////////////
//
// load our publickey
//
Archive.prototype.initialize = function initialize() {
  // This publicKey is changed in our production env
  //this.app.wallet.returnPublicKey();
  this.publickey = "fwPHDCG1Z2RCP1LTm97mubfafdx72vcMun8FdfQNJ522"
}


////////////////////
// Install Module //
////////////////////
//
// create one table to manage authorized users, and another
// table to store the transactions.
//
Archive.prototype.installModule = function installModule() {

  if (this.app.BROWSER == 1) { return; }

  //
  // sig is a SPECIAL signature that authorizes all of the other
  // settings, such as permission (who can access) and authorized_keys
  // who can access if permission is set to restrict access only to 
  // approved users.
  //
  sql = "\
        CREATE TABLE IF NOT EXISTS mod_archive (\
                id INTEGER, \
                publickey TEXT, \
                tx TEXT, \
                sig TEXT, \
                permission INTEGER, \
                authorized_keys TEXT, \
                unixtime INTEGER, \
                PRIMARY KEY(id ASC) \
        )";
  this.app.storage.execDatabase(sql, {}, function() {});

  sql = "\
        CREATE TABLE IF NOT EXISTS mod_archive_users (\
                id INTEGER, \
                publickey TEXT, \
                active INTEGER, \
                PRIMARY KEY(id ASC) \
        )";
  this.app.storage.execDatabase(sql, {}, function() {});

}






/////////////////////////
// Handle Web Requests //
/////////////////////////
Archive.prototype.webServer = function webServer(app, expressapp) {

  var archive_self = this;

  expressapp.get('/archive/txs/:sig', function (req, res) {

    if (req.params.sig == null) { return; }

    var sig = req.params.sig;

    var sql = "SELECT * FROM mod_archive WHERE sig = $sig";
    var params = { $sig : sig };
    archive_self.app.storage.queryDatabase(sql, params, function(err, row) {

      if (err != null) {
        res.setHeader('Content-type', 'text/html');
        res.charset = 'UTF-8';
        res.write(JSON.stringify(err));
        res.write("Error Locating Transaction");
        res.end();
        return;
      }

      if (row != null) {
        res.setHeader('Content-type', 'text/html');
        res.charset = 'UTF-8';
        res.write(JSON.stringify(row));
        res.end();
        return;

      } else {
        res.setHeader('Content-type', 'text/html');
        res.charset = 'UTF-8';
        res.write("No Transaction Found");
        res.end();
        return;
      }

    });
  });

  expressapp.get('/archive/', function (req, res) {
    res.sendFile(__dirname + '/web/index.html');
    return;
  });

  expressapp.get('/archive/style.css', function (req, res) {
    res.sendFile(__dirname + '/web/style.css');
    return;
  });

}





//////////////////////////
// Handle Peer Requests //
//////////////////////////
Archive.prototype.handlePeerRequest = function handlePeerRequest(app, message, peer, mycallback) {

  //////////////////
  // archive load // 
  //////////////////
  if (message.request == "archive load") {

console.log("loading request inbound: ");
console.log(JSON.stringify(message));

    starting_at       = message.data.starting_at;
    number_of_entries = message.data.number;
    publickey = message.data.publickey;
    sql    = "SELECT * FROM mod_archive WHERE publickey = $publickey LIMIT $number_of_entries OFFSET $starting_at";
    params = { $publickey : publickey, $number_of_entries : number_of_entries, $starting_at : starting_at } 
    app.storage.queryDatabaseArray(sql, params, function(err, rows) {
      if (rows != null) {
        for (mat = 0; mat < rows.length; mat++) {
	  message                 = {};
	  message.request         = "archive send";
	  message.data            = {};
	  message.data.tx         = rows[mat].tx;
          message.data.id         = rows[mat].id;  
          message.data.sig        = rows[mat].sig;
	  message.data.unixtime   = rows[mat].unixtime;
          peer.sendRequest(message.request, message.data);
        }
      }
    });
  }


  ////////////////////
  // archive delete //
  ////////////////////
  //
  // requires implementation
  //
  if (message.request == "archive delete") {
    try {
    } catch (err) {
      console.log("ERROR DELETING TX");
      return;
    }
  }


  ///////////////////
  // archive reset //
  ///////////////////
  if (message.request == "archive reset") {

    try {

      var publickey = message.data.publickey;
      var sig = message.data.sig;
      var msg_to_sign = message.data.publickey + message.data.unixtime;
      let does_validate = this.app.crypt.verifyMessage(msg_to_sign, sig, publickey);

      //
      // delete all user content
      // 
      sql = "DELETE FROM mod_archive WHERE publickey = $publickey";
      params = { $publickey : publickey };
      app.storage.execDatabase(sql, params, function() {});

    } catch (err) {
      console.log("ERROR RESETTING TX");
      return;
    }
  }


  //////////////////
  // archive send // 
  //////////////////
  if (message.request == "archive send") {
  
    try {

      var tx       = message.data.tx;
      var id       = message.data.id;
      var sig      = message.data.sig;
      var unixtime = message.data.unixtime;

      var newtx = new saito.transaction(tx);

      if (newtx != null && newtx.is_valid != 0) {
        this.app.modules.loadFromArchives(newtx);
      }

    } catch (err) {
      console.log("Error loading transaction from Archive");
    }
  }


  //////////////////
  // archive save //
  //////////////////
  if (message.request == "archive save") {

console.log("Attempting to Save in Archives");
console.log(JSON.stringify(message.data, null, 4));

    try {

      var tx  = JSON.parse(message.data.tx);
      var publickey = message.data.publickey;
      var sig = message.data.sig;
      var msg_to_sign = message.data.publickey + tx.sig + message.data.permission + message.data.authorized_keys;
      let does_validate = this.app.crypt.verifyMessage(msg_to_sign, sig, publickey);

      //
      // insert in archive
      // 
      sql = "INSERT OR IGNORE INTO mod_archive (publickey, tx, sig, permission, authorized_keys, unixtime) VALUES ($publickey, $tx, $sig, $permission, $authorized_keys, $unixtime)";
      app.storage.execDatabase(sql, {
        $publickey: message.data.publickey,
        $tx: tx,
        $sig: message.data.sig,
        $permission: message.data.permission,
        $authorized_keys: message.data.authorized_keys,
        $unixtime: message.data.unixtime
      });

    } catch (err) {

      console.log("ERROR SAVING TX");
      console.log(err);
      return;

    }
  }
}








