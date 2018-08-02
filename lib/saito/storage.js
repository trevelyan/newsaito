'use strict';

const saito    = require('../saito');
const fs       = require('fs');
//const shashmap = require('shashmap');
const path     = require('path');
const Big      = require('big.js');


/////////////////
// Constructor //
/////////////////
function Storage(app) {

  if (!(this instanceof Storage)) {
    return new Storage(app);
  }

  this.app  = app || {};

  this.db = null;

  this.directory             = path.join(__dirname, '../data/');

  return this;
}
module.exports = Storage;


////////////////
// initialize //
////////////////
//
// opens existing database or creates a new one. we
// default our database to be as fast as possible at
// the cost of tolerance, because we can always
// reload from blocks on disk if necessary.
//
Storage.prototype.initialize = function initialize() {

  //
  // load options file
  //
  this.loadOptions();

  //
  // check options file
  //
  if (this.app.BROWSER == 0) {

/***
    //////////////
    // database //
    //////////////
    var sqlite3 = require('sqlite3').verbose();
    this.db = new sqlite3.Database(this.directory + 'database.sq3');
    //this.db = new sqlite3.Database(':memory:');
    //this.createDatabaseTables();

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
***/

  }

  return;
}




/////////////////
// loadPptions //
/////////////////
//
// load options file
//
Storage.prototype.loadOptions = function loadOptions() {

  var storage_self = this;

  /////////////
  // servers //
  /////////////
  if (this.app.BROWSER == 0) {

    try {
      this.app.options = JSON.parse(
        fs.readFileSync(__dirname + '/../options', 'utf8', (err, data) => {
          if (err) {
            console.log("Error Reading Options File");
            storage_self.app.logger.logError("Error Reading Options File", {message:"", stack: err});
                  process.exit();
          }
        })
      );
    } catch (err) {
      console.log("Error Reading Options File");
      storage_self.app.logger.logError("Error Reading Options File", {message:"", stack: err});
      process.exit();
    }

  //////////////
  // browsers //
  //////////////
  } else {

    let data = null;

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
      $.ajax({
        url: '/client.options',
        dataType: 'json',
        async: false,
        success: function(data) {
          storage_self.app.options = data;
        },
        error: function(XMLHttpRequest, textStatus, errorThrown) {
          storage_self.app.logger.logError("Reading client.options from server failed", {message:"", stack: errorThrown})
        }
      });
    }
  }
}




/////////////////
// saveOptions //
/////////////////
//
// save options file
//
Storage.prototype.saveOptions = function saveOptions() {

  var storage_self = this;

  if (storage_self.app.options == null) { storage_self.app.options = {}; }

  if (this.app.BROWSER == 0) {
    fs.writeFileSync("options", JSON.stringify(storage_self.app.options, null, 4), function(err) {
      if (err) {
        storage_self.app.logger.logError("Error thrown in storage.saveOptions", {message: "", stack: err});
        return;
      }
    });
  } else {
    if (typeof(Storage) !== "undefined") {
      localStorage.setItem("options", JSON.stringify(storage_self.app.options));
    }
  }
}

Storage.prototype.validateTransactionInputsForMempool = function validateTransactionInputsForMempool(tx) {
  return new Promise((resolve, reject) => {
    if (this.app.BROWSER == 1 || this.app.SPVMODE == 1) { resolve(tx); return; }

    var storage_self = this;
    let utxiarray = tx.transaction.from;
    let gtnum = 0;
    let map_found = 0;

    for (let via = 0; via < utxiarray.length; via++) {

      let utxi  = utxiarray[via];

      ////////////////////////
      // validate 0-payment //
      ////////////////////////
      if (utxi.amt == 0) {
          map_found++;
      } else {

        if (utxi.amt == 0 && utxi.bid == 0 && utxi.tid == 0 && utxi.sid == 0 && (utxi.gt == 1 || utxi.ft == 1)) { gtnum++; } else {

          //////////////////////
          // validate hashmap //
          //////////////////////
          let slip_map_index = this.returnHashmapIndex(utxi.bid, utxi.tid, utxi.sid, utxi.add, utxi.amt, utxi.bhash);
          if (shashmap.validate_slip(slip_map_index, storage_self.app.blockchain.returnLatestBlockId()) == 1) {
            map_found++;
          }
        }
      }
    }

    if (gtnum == utxiarray.length) { resolve(tx); }
    if (gtnum+map_found >= utxiarray.length) { resolve(tx); }
    reject("TX COULD NOT BE VALIDATED")
  });
}

Storage.prototype.saveBlock = async function saveBlock(blk, lc = 0) {
  return new Promise((resolve, reject) => {
    if (this.app.BROWSER == 1) { reject(); }
    if (blk == null) { reject(); }
    if (blk.is_valid == 0) { reject(); }

    var storage_self = this;
    this.saving_blocks = 1;

    ///////////
    // slips //
    ///////////
    //
    // insert the "to" slips so that future blocks can manipulate them
    //
    for (let b = 0; b < blk.transactions.length; b++) {
      for (let bb = 0; bb < blk.transactions[b].transaction.to.length; bb++) {
        if (blk.transactions[b].transaction.to[bb].amt > 0) {
          var slip_map_index = storage_self.returnHashmapIndex(blk.block.id, blk.transactions[b].transaction.id, blk.transactions[b].transaction.to[bb].sid, blk.transactions[b].transaction.to[bb].add, blk.transactions[b].transaction.to[bb].amt, blk.returnHash());
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

    storage_self.db.run(sql2, params2, function(err) {

      if (err) {
        storage_self.app.logger.logError("Error thrown in storage.saveBlock", {message: "", stack: err});
      }

      if (this.lastID != undefined) {

        //////////////////
        // save to disk //
        //////////////////
        var tmp_filename = blk.block.id + "-" + this.lastID + ".blk";
        var tmp_filepath = storage_self.data_directory + "blocks/" + tmp_filename;

        // write file if it does not exist
        if ( ! fs.existsSync(tmp_filepath)) {
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
          //blk.compressSegAdd();

          fs.writeFileSync(tmp_filepath, JSON.stringify(blk.block), 'UTF-8');

          //
          // set filename before we permit continuing
          //
          blk.filename = tmp_filename;
          storage_self.saving_blocks     = 0;
        } else {
          blk.filename = tmp_filename;
        }

      } else {

        ///////////////////
        // already saved //
        ///////////////////
        storage_self.saving_blocks = 0;
        return resolve(false);

      }
    });

    return resolve(false);
  });
}