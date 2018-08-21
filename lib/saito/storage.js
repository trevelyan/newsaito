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
      console.log(err);
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
 * Saves a block to database and disk and shashmap
 *
 * @param {saito.block} blk block
 * @param {int} lc longest chain
 */
Storage.prototype.saveBlock = async function saveBlock(blk=null, lc=0) {

  if (this.app.BROWSER == 1 || blk == null) { return; }
  if (blk.is_valid) { return; }


  ///////////////////////
  // slips to shashmap //
  ///////////////////////
  //
  // insert the "to" slips so that future blocks can manipulate them
  //
  for (let b = 0; b < blk.transactions.length; b++) {
    for (let bb = 0; bb < blk.transactions[b].transaction.to.length; bb++) {
      if (blk.transactions[b].transaction.to[bb].amt > 0) {

	//
	// TODO - if we insert the information here, do we need to 
	// do that in the wallet class? restructure to avoid needing
	// to do this twice.
	//
	blk.transactions[b].transaction.to[bb].bid = blk.block.id;
	blk.transactions[b].transaction.to[bb].bhash = blk.returnHash();
	blk.transactions[b].transaction.to[bb].tid = blk.transactions[b].transaction.id;

        var slip_map_index = blk.transactions[b].transaction.to[bb].returnIndex();
        shashmap.insert_slip(slip_map_index, -1);
      }
    }
  }


  ///////////////////////
  // block to database //
  ///////////////////////
  //
  // this is > -1 if we are reading the block
  // off disk and restoring our database, in
  // which case we want to use our prior IDs
  // to maintain consistency with the saved
  // blocks
  //
  var sql = "";
  var params = "";
  if (blk.save_db_id > -1) {
    sql = `INSERT INTO blocks (id, block_id, golden_ticket, reindexed, block_json_id, hash, conf, longest_chain, min_tx_id, max_tx_id) VALUES ($dbid, $block_id, $golden_ticket, 1, $block_json_id, $hash, 0, $lc, $mintxid, $maxtxid)`;
    params =  {
      $dbid: blk.saveDatabaseId,
      $block_id: blk.block.id,
      $golden_ticket: blk.containsGoldenTicket(),
      $block_json_id : 0,
      $hash: blk.returnHash(),
      $lc: lc,
      $mintxid: blk.returnMinTxId(),
      $maxtxid: blk.returnMaxTxId()
    }
  } else {
    sql = `INSERT INTO blocks (block_id, golden_ticket, reindexed, block_json_id, hash, conf, longest_chain, min_tx_id, max_tx_id) VALUES ($block_id, $golden_ticket, 1, $block_json_id, $hash, 0, $lc, $mintxid, $maxtxid)`;
    params = {
      $block_id: blk.block.id,
      $golden_ticket: blk.containsGoldenTicket(),
      $block_json_id : 0,
      $hash: blk.returnHash(),
      $lc: lc,
      $mintxid: blk.returnMinTxId(),
      $maxtxid: blk.returnMaxTxId()
    }
  };


  ///////////////////
  // block to disk //
  ///////////////////
  try {
    var res = await this.db.run(sql, params);
    blk.filename = `${blk.block.id}-${res.lastID}.blk`;
    var tmp_filepath = `${this.directory}blocks/${blk.filename}`;

    if (!fs.existsSync(tmp_filepath)) {
      fs.writeFileSync(tmp_filepath, JSON.stringify(blk.block, null, 4), 'UTF-8');
    }
  } catch (err) {
  }

  return true;

}



/**
 * This function is called by the Blockchain class when it
 * initializes. It looks to see if we have any blocks saved
 * to disk and -- if so -- force-adds them to the blockchain.
 *
 * This is done in chunks in order to avoid exhausting all of
 * our memory. Logically, we should have no more than two
 * blocks getting processed at a time -- one working its way
 * through the addBlockToBlockchain process in the blockchain
 * class and another sitting queued up in the mempool.
 *
 * @param {integer} mylimit how many blocks to index
 */
Storage.prototype.loadBlocksFromDisk = async function loadBlocksFromDisk(mylimit=0) {

  if (this.app.BROWSER == 1 || this.app.SPVMODE == 1) { return; }

  //
  // sort files by creation date, and then name
  // if two files have the same creation date
  //
  let dir   = this.directory + "blocks/";

  //
  // if this takes a long time, our server can
  // just refuse to sync the initial connection
  // as when it starts to connect, currently_reindexing
  // will be set at 1
  //
  let files = fs.readdirSync(dir);

  //
  // "empty" file only
  //
  if (files.length == 1) {
    this.reindexing_active = false;
    return;
  }

  this.block_size_current         = 0.0;
  files.sort(function(a, b) {
    var compres = fs.statSync(dir + a).mtime.getTime() - fs.statSync(dir + b).mtime.getTime();
    // if exact same creation time... string compare on names to fetch lower ID
    if (compres == 0) {
      return parseInt(a) - parseInt(b);
  }
      return compres;
  });

  // let current_block = 0;
  for (let i = 1, n = files.length; i < n; i++) {
    try {

      let fileID = files[i]
      let blk = this.openBlockByFilename(fileID);

      if (blk == null) {
        console.log("Error loading block from disk: missing block: " +fileID);
        this.app.logger.logError(`Error loading block from disk: missing block: ${fileID}`,
          { message: "", stack: "" });
        process.exit();
      }

      //
      // setting these fields allows our blockchain
      // class to take shortcuts and ensures that when
      // we add a block to the database it will be with
      // the right info.
      //
      blk.save_bid = fileID.substr(0, fileID.indexOf("-"));
      blk.save_db_id = fileID.substr(fileID.indexOf("-") + 1, fileID.indexOf(".")-fileID.indexOf("-")-1);
      blk.prevalidated = 1;       // force-add to index
                                  // cannot be set through json
                                  // prevents spamming network

      // LOGGING INFO
      //this.app.logger.logInfo(`REPOPULATING: adding block to mempool w/ id: ${blk.block.id} -- ${blk.returnHash()}`)
      await this.app.blockchain.addBlockToBlockchain(blk);
      // this.reindexing_chunk = false;

      } catch (err) {
        console.log(err);
        //this.app.logger.logError("Error thrown in loadBlocksFromDisk, setInterval", err);
    }
  }

  return;
}

Storage.prototype.loadSingleBlockFromDisk = function loadSingleBlockFromDisk(hash) {
  if (this.app.BROWSER == 1 || this.app.SPVMODE == 1) { return; }

  //
  // sort files by creation date, and then name
  // if two files have the same creation date
  //
  let dir   = this.directory + "blocks/";

  let files = fs.readdirSync(dir);

  //
  // "empty" file only
  //
  if (files.length == 1) {
    return null;
  }

  var sql = `SELECT id, block_id FROM blocks WHERE hash=$hash`;
  var params = {
    $hash: hash
  }

  this.db.run(sql, params)
    .then((results) => {
      let blk = this.openBlockByFilename(`${results.block_id}-${results.id}.blk`);

      if (blk == null) {
        console.log("Error loading block from disk: missing block: " +fileID);
        this.app.logger.logError(`Error loading block from disk: missing block: ${fileID}`,
          { message: "", stack: "" });
        process.exit();
      }

      //
      // setting these fields allows our blockchain
      // class to take shortcuts and ensures that when
      // we add a block to the database it will be with
      // the right info.
      //
      blk.save_bid = fileID.substr(0, fileID.indexOf("-"));
      blk.save_db_id = fileID.substr(fileID.indexOf("-") + 1, fileID.indexOf(".")-fileID.indexOf("-")-1);
      blk.prevalidated = 1;       // force-add to index
                                  // cannot be set through json
                                  // prevents spamming network
      return blk;
    })
    .catch((err) => {
      console.log(err);
      return null;
    });
}

/**
 * if a block exists with name, open it from disk and
 * returns the block data
 *
 * @param {string} block filename
*/
Storage.prototype.openBlockByFilename = function openBlockByFilename(filename) {

  let block_filename = `${this.directory}blocks/${filename}`;

  try {
  //
  // readFileSync leads to issues loading from
  // disk. for some reason the only file is not
  // opened and we never hit the function inside
  //
  if (fs.existsSync(block_filename)) {
    let data = fs.readFileSync(block_filename, 'utf8');
    var blk = new saito.block(this.app, data);

    if (blk.is_valid) { return null; }

    return blk;
  } else {
    this.app.logger.logInfo(`cannot open: ${block_filename} as it does not exist on disk`);
    return null;
  }
  } catch (err) {
    console.log("Error reading block from disk");
    this.app.logger.logError("Error reading block from disk", {message: "", stack: err})
  }
}


/**
 *
 * This is called by the mempool when it receives a transaction
 * over the network. We validate that the inputs are valid before
 * we add it to our mempool so that we don't end up producing an
 * invalid block.
 *
 * @param {array} slip_array an array of slips to validate
 * @returns {boolean} are the slips in the transaction valid?
 */
Storage.prototype.validateTransactionInputs = function validateTransactionInputs(slip_array, bid) {
  if (this.app.BROWSER == 1 || this.app.SPVMODE == 1) { resolve(false); }

  for (let i = 0; i < slip_array.length; i++) {
    if (slip_array[i].amt != 0) {
      if (shashmap.validate_slip(slip_array[i].returnIndex(), bid) == 0) {
        return false;
      }
    }
  }

  return true;
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

console.log("BROWSER: always fetch clean options file");

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



/**
 * Reset the options file
 */
Storage.prototype.resetOptions = function resetOptions() {

  var storage_self = this;

  //
  // prevents caching
  //
  let tmpdate = new Date().getTime();
  let loadurl = '/options?x='+tmpdate;

  $.ajax({
    url: loadurl,
    dataType: 'json',
    async: false,
    success: function(data) {
      storage_self.app.options = data;
      storage_self.saveOptions();
    },
    error: function(XMLHttpRequest, textStatus, errorThrown) {
      storage_self.app.logger.logError("Reading client.options from server failed", {message: "", stack: errorThrown});
    }
  });

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
    console.log(err);
    this.app.logger.logError("Error thrown in storage.saveBlock", {message: "", stack: err});
    }
  });

}




