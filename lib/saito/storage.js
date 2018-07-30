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

console.log("OPTIONS: " + JSON.parse(app.options));


  // 
  // this must check options file
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






