'use strict';

const saito    = require('../saito');
const fs       = require('fs-extra')
// const shashmap = require('shashmap');
const path     = require('path');
const sqlite   = require('sqlite');


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
Storage.prototype.initialize = async function initialize() {

  //
  // load options file
  //
  this.loadOptions();

  //
  // save the file
  //
  this.saveOptions();

  //
  // only servers will have sqlite3 installed
  //
  if (this.app.BROWSER == 0) {

    // database
    try {

      this.db = await sqlite.open(this.directory + 'database.sq3');

      await this.createDatabaseTables();

      await Promise.all([
        // pragma temp store -- temp objects in memory (2) (default = 0)
        this.db.run("PRAGMA temp_store = 2"),

        // controls pagesize. default is 4096
        this.db.run("PRAGMA page_size = 32768"),

        // increase cache size (default is 1024)
        this.db.run("PRAGMA cache_size = 512000"),

        // radically faster db writes at cost of corruption on power failure
        this.db.run("PRAGMA synchronous = OFF"),

        // locking mode means only one connection (nodsjs) but increases speed (default: NORMAL)
        this.db.run("PRAGMA locking_mode = EXCLUSIVE"),

        // depreciated by small tweak
        this.db.run("PRAGMA count_changes = false"),

        // no rollbacks and db corruption on power failure
        this.db.run("PRAGMA journal_mode = OFF"),
      ]);
    } catch(err) {
      console.log(err)
    }
  }

  return;
}

/**
 * Create DB Tables
 */
Storage.prototype.createDatabaseTables = async function createDatabaseTables() {

  if (this.app.BROWSER == 1) { return; }

  try {
    await this.db.run("\
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
      )");

    await Promise.all([
      this.db.run("CREATE INDEX IF NOT EXISTS blocks_idx ON blocks (block_id, longest_chain)"),
      this.db.run("CREATE INDEX IF NOT EXISTS blocks_idx2 ON blocks (reindexed)"),
      this.db.run("CREATE INDEX IF NOT EXISTS blocks_idx3 ON blocks (hash)")
    ]);
  } catch(err) {
    console.log(err);
  }
}


/**
 * Executes an SQL command like INSERT, UPDATE, etc.
 *
 * @param {string} sql command
 * @param {*} parameters
 */
Storage.prototype.execDatabase = async function execDatabase(sql, params) {

  if (this.app.BROWSER == 1) { return; }

  try {
    return await this.db.run(sql, params)
  } catch (err) {
    this.app.logger.logError("Error thrown in execDatabase", {message:"", stack: err});
  }
}

/**
 * Load the options file
 */
Storage.prototype.loadOptions = async function loadOptions() {

  //
  // servers
  //
  if (this.app.BROWSER == 0) {

    if (fs.existsSync(__dirname + '/../options')) {

      //
      // open options file
      //
      try {
        let optionsfile = fs.readFileSync(__dirname + '/../options', 'utf8');
        this.app.options = JSON.parse(optionsfile);
      } catch (err) {
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
    ////////////////////////////////
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

  //
  // servers
  //
  if (this.app.BROWSER == 0) {
    try {
      //fs.writeFileSync(`${__dirname}/../options`, JSON.stringify(this.app.options, null, 4));
      fs.writeFileSync(`${__dirname}/../options`, JSON.stringify(this.app.options));
    } catch (err) {
      this.app.logger.logError("Error thrown in storage.saveOptions", {message: "", stack: err});
      console.log(err);
      return;
    }

  //
  // browsers
  //
  } else {
    if (typeof(Storage) !== "undefined") {
      localStorage.setItem("options", JSON.stringify(this.app.options));
    }
  }
}




///////////////////////
// saveClientOptions //
///////////////////////
//
// when browsers connect to our server, we check to see
// if the client.options file exists in our web directory
// and generate one here if it does not.
//
// this is fed out to client browsers and serves as their
// default options, specifying us as the node to which they
// should connect and through which they can route their
// transactions. :D
//
Storage.prototype.saveClientOptions = function saveClientOptions() {

  if (this.app.BROWSER == 1) { return; }

  //
  // mostly empty, except that we tell them what our latest
  // block_id is and send them information on where our
  // server is located so that they can sync to it.
  //
  var t                      = {};
      t.archives             = [];
      t.keys                 = [];
      t.peers                = [];
      t.dns                  = [];
      t.blockchain           = {};
      t.peers.push(this.app.server.server.endpoint);

  //
  // write file
  //
  fs.writeFileSync("saito/web/options", JSON.stringify(t), (err) => {
    if (err) {
      this.app.logger.logError("Error thrown in storage.saveBlock", {message: "", stack: err});
      console.log(err);
    }
  });

}




