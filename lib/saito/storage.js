'use strict';
const saito = require('../saito');


/**
 * Storage Constructor
 * @param {*} app
 */
function Storage(app) {

  if (!(this instanceof Storage)) {
    return new Storage(app);
  }

  this.app                = app || {};

  return this;

}
module.exports = Storage;


/**
 * Initialize the database and load the options
 */
Storage.prototype.initialize = function initialize() {

  if (this.app.BROWSER == 0) {

    //////////////
    // database //
    //////////////
    var sqlite3 = require('sqlite3').verbose();
    this.db = new sqlite3.Database(this.data_directory + 'database.sq3');
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
  this.loadOptions();
}











