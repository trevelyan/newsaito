var request = require("request");


function Infura() {

  if (!(this instanceof Infura)) {
    return new Infura();
  }

  this.apikey = "";

  return this;

}
module.exports = Infura;



Infura.prototype.getBalance = function getBalance(address="") {

  var url = "https://api.infura.io/v1/jsonrpc/mainnet/eth_getBalance?params=";
  var arg = '["0xc94770007dda54cF92009BFF0dE90c06F603a09f","latest"]';
      url = url + encodeURI(arg);

  var requestSettings = {
    url: url,
    method: 'GET',
    timeout: 5000,                    // remove from queue if not received in 5 seconds
    encoding: null
  }

  request(requestSettings, function(err, res, body) {
    if (err) {
      console.log("Error downloading block");
    }

    //
    // we seem to have got something
    //
    console.log(body.toString('UTF-8'));

  });

}








