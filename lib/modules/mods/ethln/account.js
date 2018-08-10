var ethutil    = require("ethereumjs-util");
var ethwallet  = require("ethereumjs-wallet");



function Account() {

  if (!(this instanceof Account)) {
    return new Account();
  }

  this.keys = {};

  this.initialize();

  this.units_per_ethereum        = 1000000000000000000;
  this.initial_coin_distribution = 1000000000000000000;
  this.current_coin_distribution = 1000000000000000000;
  this.index_signed              = 0;

  return this;

}
module.exports = Account;



Account.prototype.initialize = function initialize(coin_dist) {

  this.keys = {};
  const wallet = ethwallet.generate();
  this.keys.private  = wallet.getPrivateKeyString();
  this.keys.public  = wallet.getPublicKeyString();
  this.keys.address = wallet.getAddressString();

  // remove 0x
  this.keys.private = this.keys.private.substring(2);
  this.keys.public  = this.keys.public.substring(2);
  this.keys.address = this.keys.address.substring(2);

}


Account.prototype.setCoinDistribution = function setCoinDistribution(adjustment) {
  this.current_coin_distribution = adjustment;
  return this.current_coin_distribution;
}
Account.prototype.setIndexSigned = function setIndexSigned(index_signed) {
  this.index_signed = index_signed;
  return this.index_signed;
}
Account.prototype.addCoinDistribution = function addCoinDistribution(adjustment) {
  this.current_coin_distribution += adjustment;
  return this.current_coin_distribution;
}
Account.prototype.subtractCoinDistribution = function subtractCoinDistribution(adjustment) {
  this.current_coin_distribution -= adjustment;
  return this.current_coin_distribution;
}


Account.prototype.returnPublicKey = function returnPublicKey() {
  return this.keys.public;
}
Account.prototype.returnAddress = function returnAddress() {
  return this.keys.address;
}
Account.prototype.returnIndexSigned = function returnIndexSigned() {
  return this.index_signed;
}
Account.prototype.returnInitialCoinDistribution = function returnInitialCoinDistribution() {
  return this.initial_coin_distribution;
}
Account.prototype.returnCurrentCoinDistribution = function returnCurrentCoinDistribution() {
  return this.current_coin_distribution;
}
Account.prototype.returnMessageHash = function returnMessageHash() {
  var msg    = "" + this.returnCurrentCoinDistribution() + this.returnIndexSigned();
  return '0x'+ethutil.sha256(msg).toString('hex');
}
Account.prototype.returnMRS = function returnMRS() {

  var output = '';
  var msg    = "" + this.returnCurrentCoinDistribution() + this.returnIndexSigned();
console.log("\nSIGNING: "+msg);
  var msg_s  = this.signMessage(this.keys, msg);
console.log("MESSAGE: " + ethutil.sha256(msg).toString('hex'));

  output += '"0x'+ethutil.sha256(msg).toString('hex') + '", "0x'+msg_s.r.toString('hex')+'", "0x'+msg_s.s.toString('hex')+'"';

  return output;

}
Account.prototype.printKeys = function printKeys() {
  console.log(this.keys);
}
Account.prototype.signMessage = function signMessage(keys, msg) {

  var privk = "0x"+keys.private;

  var msg_b     = ethutil.sha256(msg);
  var privkey_b = ethutil.toBuffer(privk);
  var msg_s     = ethutil.ecsign(msg_b, privkey_b);

  return msg_s;

}




