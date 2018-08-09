'use strict';
const saito = require('../saito');
const fs       = require('fs');
const shashmap = require('shashmap');
const path     = require('path');


/**
 * Storage Constructor
 * @param {*} app
 */
function Storage(app) {

  if (!(this instanceof Storage)) {
    return new Storage(app);
  }

  this.app                = app || {};

  this.directory          = path.join(__dirname, '../data/');
  this.db                 = null;

  return this;

}
module.exports = Storage;


/**
 * Initialize the database and load the options file
 */
Storage.prototype.initialize = function initialize() {

console.log("initializing...");

  //
  // only servers will have sqlite3 installed
  //
  if (this.app.BROWSER == 0) {

    //////////////
    // database //
    //////////////
    var sqlite3 = require('sqlite3').verbose();
    this.db = new sqlite3.Database(this.directory + 'database.sq3');
    //this.db = new sqlite3.Database(':memory:');
    this.createDatabaseTables();

    // pragma temp store -- temp objects in memory (2) (default = 0)
    this.execDatabase("PRAGMA temp_store = 2", {}, function (){});

    // controls pagesize. default is 4096
    this.execDatabase("PRAGMA page_size = 32768", {}, function (){});

    // increase cache size (default is 1024)
    this.execDatabase("PRAGMA cache_size = 512000", {}, function (){});

    // radically faster db writes at cost of corruption on power failure
    this.execDatabase("PRAGMA synchronous = OFF", {}, function (){});

    // locking mode means only one connection (nodsjs) but increases speed (default: NORMAL)
    this.execDatabase("PRAGMA locking_mode = EXCLUSIVE", {}, function (){});

    // depreciated by small tweak
    this.execDatabase("PRAGMA count_changes = false", {}, function (){});

    // no rollbacks and db corruption on power failure
    this.execDatabase("PRAGMA journal_mode = OFF", {}, function (){});

  }

  //
  // load options file
  //
  //this.loadOptions();

  //
  // test
  //
  //this.saveOptions();
}




/**
 * Load the options file
 */
Storage.prototype.loadOptions = function loadOptions() {

  /////////////
  // servers //
  /////////////
  if (this.app.BROWSER == 0) {

    if (fs.existsSync(__dirname + '/../options')) {

      //
      // open options file
      //
      try {
        this.app.options = JSON.parse(
          fs.readFileSync(__dirname + '/../options', 'utf8', (err, data) => {
            if (err) {
              console.log("Error Reading Options File");
              this.app.logger.logError("Error Reading Options File", {message:"", stack: err});
              process.exit();
            }
          })
        );
      } catch (err) {
        console.log("Error Reading Options File");
        this.app.logger.logError("Error Reading Options File", {message:"", stack: err});
        process.exit();
      }

    } else {

      //
      // default options file
      //
      this.app.options = JSON.parse('{"server":{"host":"localhost","port":12101}}');

    }

  //////////////
  // browsers //
  //////////////
  } else {

    let data = null;

    ///////////////////////////////
    // fetch from Chrome Storage //
    ///////////////////////////////
    //
    // we should have already fetched
    // our data from the Chrome backend
    // storage. (start.js)
    //
    //if (this.app.CHROME == 1) {
    //  if (this.app.options == null) { this.app.options = {}; }
    //  return;
    //}



    ////////////////////////////
    // read from localStorage //
    ////////////////////////////
    if (typeof(Storage) !== "undefined") {
      data = localStorage.getItem("options");
      this.app.options = JSON.parse(data);
    }

    //////////////////////////
    // or fetch from server //
    //////////////////////////
    if (data == null) {

      //
      // jquery
      //
      $.ajax({
        url: '/options',
        dataType: 'json',
        async: false,
        success: (data) => {
          this.app.options = data;
        },
        error: function(XMLHttpRequest, textStatus, errorThrown) {
          console.log("ERROR loading options file from server");
        }
      });
    }
  }
}



/**
 * Save the options file
 */
Storage.prototype.saveOptions = function saveOptions() {

  if (this.app.options == null) { this.app.options = {}; }

  //if (this.app.CHROME == 1) {
  //  chrome.storage.local.set({'options': JSON.stringify(this.app.options)});
  //  return;
  //}

  /////////////
  // servers //
  /////////////
  if (this.app.BROWSER == 0) {

console.log("HERE WE ARE SAVING!");

    fs.writeFileSync("options", JSON.stringify(this.app.options, null, 4), (err) => {
      if (err) {
        this.app.logger.logError("Error thrown in storage.saveOptions", {message: "", stack: err});
        console.log(err);
        return;
      }
else {
console.log("HERE WE ARE SAVING 2!");
}
    });

  //////////////
  // browsers //
  //////////////
  } else {
    if (typeof(Storage) !== "undefined") {
      localStorage.setItem("options", JSON.stringify(this.app.options));
    }
  }
}













//////////////////////////
// createDatabaseTables //
//////////////////////////
//
// run at initialization, this creates the database
// tables needed if they do not exist.
//
Storage.prototype.createDatabaseTables = function createDatabaseTables() {

  if (this.app.BROWSER == 1) { return; }

  this.execDatabase("\
    CREATE TABLE IF NOT EXISTS blocks (\
      id INTEGER, \
      reindexed INTEGER, \
      block_id INTEGER, \
      golden_ticket INTEGER, \
      min_tx_id INTEGER, \
      max_tx_id INTEGER, \
      block_json_id INTEGER, \
      hash TEXT, \
      conf INTEGER, \
      longest_chain INTEGER, \
      UNIQUE (block_id, hash), \
      PRIMARY KEY(id ASC) \
    )",
    {},
    () => {
      this.app.storage.execDatabase("CREATE INDEX blocks_idx ON blocks (block_id, longest_chain)", {}, function() {});
      this.app.storage.execDatabase("CREATE INDEX blocks_idx2 ON blocks (reindexed)", {}, function() {});
      this.app.storage.execDatabase("CREATE INDEX blocks_idx3 ON blocks (hash)", {}, function() {});
    }
  );
}

//////////////////
// execDatabase //
//////////////////
//
// executes an SQL command like INSERT, UPDATE, etc.
//
// @params {string} sql command
// @params {{"param1":"value1"}} parameters
// @params {callback} function to call with any results
//
Storage.prototype.execDatabase = function execDatabase(sql, params, callback=null) {

  if (this.app.BROWSER == 1) { return; }

  var storage_self = this;

  this.db.run(sql, params, function(err, row) {
    if (callback != null) { callback(err, row); }
    if (err) { this.app.logger.logError("Error thrown in execDatabase", {message:"", stack: err}); }
  });

}



