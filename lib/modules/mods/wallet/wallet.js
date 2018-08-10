var saito = require('../../../saito');
var ModTemplate = require('../../template');
var util = require('util');


//////////////////
// CONSTRUCTOR  //
//////////////////
function Wallet(app) {

  if (!(this instanceof Wallet)) { return new Wallet(app); }

  Wallet.super_.call(this);

  this.app             = app;

  this.name            = "Wallet";
  this.browser_active  = 0;

  return this;

}
module.exports = Wallet;
util.inherits(Wallet, ModTemplate);






/////////////////////////
// Handle Web Requests //
/////////////////////////
Wallet.prototype.webServer = function webServer(app, expressapp) {

  var wallet_self = this;

  ///////////////////
  // web resources //
  ///////////////////
  expressapp.get('/wallet/', function (req, res) {
    res.sendFile(__dirname + '/web/index.html');
    return;
  });

  expressapp.post('/wallet/results.html', function (req, res) {

    var walletJSON = req.body.walletJSON;

    var w = new saito.wallet(wallet_self.app);
    w.wallet = JSON.parse(walletJSON);

    res.setHeader('Content-type', 'text/html');
    res.charset = 'UTF-8';
    res.write(wallet_self.returnResultsHTML(w));
    res.end();
    return;
    
  });
  expressapp.get('/wallet/style.css', function (req, res) {
    res.sendFile(__dirname + '/web/style.css');
    return;
  });


}




Wallet.prototype.returnResultsHTML = function returnResultsHTML(w) {

  var wallet_self = this;

  var html = '<html> \
<head> \
  <meta charset="utf-8"> \
  <meta http-equiv="X-UA-Compatible" content="IE=edge"> \
  <meta name="viewport" content="width=device-width, initial-scale=1"> \
  <meta name="description" content=""> \
  <meta name="author" content=""> \
  <title>Saito Network: Online Demo</title> \
  <link rel="stylesheet" type="text/css" href="/secret/style.css" /> \
</head> \
<body> \
\
    <div class="header"> \
      <a href="/" style="text-decoration:none;color:inherits"> \
        <img src="/img/saito_logo_black.png" style="width:35px;margin-top:5px;margin-left:25px;margin-right:10px;float:left;" /> \
        <div style="font-family:Georgia;padding-top:0px;font-size:1.2em;color:#444;">saito</div> \
      </a> \
    </div> \
\
    <div class="main"> \
      <table> \
	<tr> \
	  <th> amount </th> \
	  <th> block received </th> \
	  <th> transaction no. </th> \
	  <th> slip id </th> \
	  <th> block spent </th> \
	</tr> \
	<tr> \
';


  for (var i = 0; i < w.wallet.utxi.length; i++) {

    var utxi = w.wallet.utxi[i];

    var hv = wallet_self.app.storage.checkSlipValue(utxi);
    var cbid = wallet_self.app.blockchain.returnLatestBlockId();
    var spent = "spent";


    if (hv == -1 || hv > cbid) { 
      spent = "not spent ("+hv+")";
    }

    html += '<tr>';
    html += '<td>'+w.wallet.utxi[i].amt+'</td>';
    html += '<td>'+w.wallet.utxi[i].bid+'</td>';
    html += '<td>'+w.wallet.utxi[i].tid+'</td>';
    html += '<td>'+w.wallet.utxi[i].sid+'</td>';
    html += '<td>'+spent+'</td>';
    html += '</tr>';
  }

html += ' \
      </table> \
    </div> \
</body> \
</html>';

  return html;

}




