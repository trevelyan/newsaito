'use strict';


function Options(app) {

  if (!(this instanceof Options)) {
    return new Options(app);
  }

  this.app = app || {};

  return this;

}
module.exports = Options;



Options.prototype.parseJSON = function parseJSON(optjson="") {

}


