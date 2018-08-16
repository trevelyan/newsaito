'use strict';

const saito    = require('../saito');
const fs       = require('fs-extra')
const shashmap = require('shashmap');
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
 * Saves new block data to database and disk and hashmap
 * @param {saito.block} blk block
 * @param {int} lc longest chain
 */
Storage.prototype.saveBlock = async function saveBlock(blk, lc = 0) {

  if (this.app.BROWSER == 1 || blk == null) { return; }
  if (blk.is_valid == 0) { return; }

  // var storage_self = this;
  // this.saving_blocks = 1;

  ///////////
  // slips //
  ///////////
  //
  // insert the "to" slips so that future blocks can manipulate them
  //
  for (let b = 0; b < blk.transactions.length; b++) {
    for (let bb = 0; bb < blk.transactions[b].transaction.to.length; bb++) {
      if (blk.transactions[b].transaction.to[bb].amt > 0) {
        let { id, to } = blk.transactions[b].transaction;
        var slip_map_index = this.returnHashmapIndex(blk.block.id, id, to[bb].sid, to[bb].add, to[bb].amt, blk.returnHash());
        shashmap.insert_slip(slip_map_index, -1);
      }
    }
  }


  ///////////////////////////////
  // figure our min/max tx_ids //
  ///////////////////////////////
  let mintxid = 0;
  let maxtxid = 0;

  if (blk.transactions.length > 0) {
    let mintx = JSON.parse(blk.block.transactions[0]);
    let maxtx = JSON.parse(blk.block.transactions[blk.block.transactions.length-1]);
    maxtxid = maxtx.id;
    mintxid = mintx.id;
  }


  //////////////////////
  // save to database //
  //////////////////////
  var sql2 = "INSERT INTO blocks (block_id, golden_ticket, reindexed, block_json_id, hash, conf, longest_chain, min_tx_id, max_tx_id) VALUES ($block_id, $golden_ticket, 1, $block_json_id, $hash, 0, $lc, $mintxid, $maxtxid)";
  var params2 = {
    $block_id: blk.block.id,
    $golden_ticket: blk.containsGoldenTicket(),
    $block_json_id : 0,
    $hash: blk.returnHash(),
    $lc: lc,
    $mintxid: mintxid,
    $maxtxid: maxtxid
  };

  //
  // this is > -1 if we are reading the block
  // off disk and restoring our database, in
  // which case we want to use our prior IDs
  // to maintain consistency with the saved
  // blocks
  //
  if (blk.saveDatabaseId > -1) {
    sql2 = "INSERT INTO blocks (id, block_id, golden_ticket, reindexed, block_json_id, hash, conf, longest_chain, min_tx_id, max_tx_id) VALUES ($dbid, $block_id, $golden_ticket, 1, $block_json_id, $hash, 0, $lc, $mintxid, $maxtxid)";
    params2 =  {
      $dbid: blk.saveDatabaseId,
      $block_id: blk.block.id,
      $golden_ticket: blk.containsGoldenTicket(),
      $block_json_id : 0,
      $hash: blk.returnHash(),
      $lc: lc,
      $mintxid: mintxid,
      $maxtxid: maxtxid
    }
  }

  try {
    var res = await this.db.run(sql2, params2);
  } catch (err) {
    this.app.logger.logError("Error thrown in storage.saveBlock", {message: "", stack: err});
  }

  if (res.lastID != undefined) {

    //////////////////
    // save to disk //
    //////////////////
    var tmp_filename = `${blk.block.id}-${res.lastID}.blk`;
    var tmp_filepath = `${this.data_directory}blocks/${tmp_filename}`;

    // write file if it does not exist
    if (!fs.existsSync(tmp_filepath)) {
      //
      // compresses segregated addresses, which
      // removes addresses to separate part of
      // block and puts a reference in the address
      // space allowing it to be reconstituted
      //
      // useful compression technique as many
      // transaction paths will have duplicate
      // address info
      //
      // blk.compressSegAdd();

      fs.writeFileSync(tmp_filepath, JSON.stringify(blk.block), 'UTF-8');
    }

    //
    // set filename before we permit continuing
    //
    blk.filename = tmp_filename;

  } else {

    ///////////////////
    // already saved //
    ///////////////////
    return -1;

  }
  //});

  return 1;
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

    console.log("OPTIONS: " + JSON.stringify(this.app.options, null, 4));

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
    //if (typeof(Storage) !== "undefined") {
    //  data = localStorage.getItem("options");
    //  this.app.options = JSON.parse(data);
    //}

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
console.log("LOADING: " + JSON.stringify(this.app.options));
        },
        error: function(XMLHttpRequest, textStatus, errorThrown) {
          console.log("ERROR loading options file from server");
        }
      });
    }
  }

}

/**
 * Reorganizes the block table in the database
 * @param {int} block_id
 * @param {string} block_hash
 * @param {int} lc
 */
Storage.prototype.onChainReorganization = function onChainReorganization(block_id, block_hash, lc) {}

/**
 * Save the options file
 */
Storage.prototype.saveOptions = function saveOptions() {

  if (this.app.options == null) { this.app.options = {}; }

  // if (this.app.CHROME == 1) {
  //   chrome.storage.local.set({'options': JSON.stringify(this.app.options)});
  //   return;
  // }

  //
  // servers
  //
  if (this.app.BROWSER == 0) {
    try {
      fs.writeFileSync(`${__dirname}/../options`, JSON.stringify(this.app.options), null, 4);
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




