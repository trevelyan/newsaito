const saito    = require('../saito');


/////////////////
// Constructor //
/////////////////
function Path(from="", to="", sig="") {

  if (!(this instanceof Path)) {
    return new Path(from,to,sig);
  }
  this.from = from;
  this.to   = to;
  this.sig  = sig;

  return this;

}
module.exports = Path;

