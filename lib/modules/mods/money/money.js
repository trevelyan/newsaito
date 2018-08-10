var saito       = require('../../../saito');
var ModTemplate = require('../../template');
var util        = require('util');
var fs          = require('fs');
var Big         = require('big.js');


//////////////////
// CONSTRUCTOR  //
//////////////////
function Money(app) {

  if (!(this instanceof Money)) { return new Money(app); }
  Money.super_.call(this);

  this.app             = app;
  this.name            = "Money";

  return this;

}
module.exports = Money;
util.inherits(Money, ModTemplate);



Money.prototype.onNewBlock = function onNewBlock(blk) {

  //console.log(this.returnTableContents(this.app));

}



/////////////////////////
// Handle Web Requests //
/////////////////////////
Money.prototype.webServer = function webServer(app, expressapp) {

  var money_self = this;

  ///////////////////
  // web resources //
  ///////////////////
  expressapp.get('/money/', function (req, res) {
    //rewrite indexHTML page
    fs.writeFileSync((__dirname + "/web/index.html"), money_self.returnIndexHTML(app), function(err) {
      if (err) {
        return console.log(err);
      }
    });
    res.sendFile(__dirname + '/web/index.html');
    return;
  });
  expressapp.get('/money/style.css', function (req, res) {
    res.sendFile(__dirname + '/web/style.css');
    return;
  });
}




Money.prototype.returnIndexHTML = function returnIndexHTML(app) {

  var pagehtml = '<html> \
<head> \
  <meta charset="utf-8"> \
  <meta http-equiv="X-UA-Compatible" content="IE=edge"> \
  <meta name="viewport" content="width=device-width, initial-scale=1"> \
  <meta name="description" content=""> \
  <meta name="author" content=""> \
  <title>Saito Network: Blockchain Explorer</title> \
  <link rel="stylesheet" type="text/css" href="/money/style.css" /> \
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
      Money Tracker: \
      <p></p> \
      <table> \
	<tr> \
	  <th>Block Id</th> \
	  <th>Treasury</th> \
	  <th>Coinbase</th> \
	  <th>Solved</th> \
	  <th>Reclaimed</th> \
	  <th>Spent</th> \
	  <th>Unspent</th> \
	  <th>Locked</th> \
	</tr> \
      '+this.returnTableContents(app)+ ' \
     </table> \
    </div> \
\
</body> \
</html>';

  return pagehtml;

}




Money.prototype.returnTableContents = function returnTableContents(app) {

  var thtml = "";
  var mv = app.blockchain.returnLatestBlockId(); 
  var ma = mv - app.blockchain.returnGenesisPeriod();
  if (ma < 1) { ma = 1; }

  var locked    = Big(0);
  var fees      = [];
  var gt        = [];
  var spent     = [];
  var unspent   = [];
  var treasury  = [];
  var coinbase  = [];
  var reclaimed = [];
  var blockid  = [];

  var spent_input_slips = [];

  for (var b = mv, bind = 0; b >= ma; b--, bind++) {

    tmpblk = app.blockchain.returnBlockByIdLongestChain(b);

    let burn_fee_needed = Big(tmpblk.returnTransactionFeesNeededForThisBlock());
    let creator_surplus = Big(tmpblk.returnTransactionFeesUsableForBlockCreatorSurplus());
    let total_surplus   = Big(tmpblk.returnTransactionFeesTotalSurplus());
    locked = burn_fee_needed.plus(total_surplus).minus(creator_surplus);

    blockid[bind]    = b;
    treasury[bind]   = Big(tmpblk.returnTreasury());
    coinbase[bind]   = Big(tmpblk.returnCoinbase());
    reclaimed[bind]  = Big(tmpblk.returnReclaimed());
    spent[bind]      = Big(0.0);
    unspent[bind]    = Big(0.0);
    fees[bind]       = locked.toFixed(8);
    gt[bind]         = 0;

    if (tmpblk != null) {
      for (var bt = 0; bt < tmpblk.transactions.length; bt++) {

        tx = tmpblk.transactions[bt].transaction;

        if (tmpblk.transactions[bt].isGoldenTicket() == 1) { gt[bind] = 1; }

        for (var s = 0; s < tx.from.length; s++)  { spent_input_slips.push(tx.from[s]); }
        for (var s1 = 0; s1 < tx.to.length; s1++) {

	  var slip1 = tx.to[s1];
	  var slip1_spent = 0;

	  var block_id = b;
	  var tx_id    = tx.id;
	  var slip_id  = s1;

          for (var s2 = 0; s2 < spent_input_slips.length; s2++) {
	    slip2 = spent_input_slips[s2];
	    if (slip2.bid == block_id && slip2.tid == tx_id && slip2.sid == slip_id) {
	      slip1_spent = 1;
	    }
	  }

	  if (slip1_spent == 1) {
	    spent[bind]   = spent[bind].plus(Big(slip1.amt));
	  } else {
	    unspent[bind] = unspent[bind].plus(Big(slip1.amt));
	  }
        }
      }
    }
  }

  var bdata = '';
  var total_reclaimed = Big(0.0);
  var total_unspent   = Big(0.0);
  var total_coinbase  = Big(0.0);
  var tr              = Big(0.0);

  for (var sd = 0; sd < spent.length; sd++) {

    if (sd == 0) { 
      total_reclaimed = reclaimed[sd];
      tr  = treasury[sd]; 
    }
    total_coinbase  = total_coinbase.plus(coinbase[sd]);
    total_unspent   = total_unspent.plus(unspent[sd]);


    // locked funds
    if (gt[sd-1] == null) {
      total_coinbase = total_coinbase.plus(Big(fees[sd])); 
    } else {
      if (gt[sd-1] == 0) {
        total_coinbase = total_coinbase.plus(Big(fees[sd])); 
      }
    }


    if (gt[sd] == 1) { 
      if (coinbase[sd+1] != null) { 
        total_coinbase = total_coinbase.minus(coinbase[sd+1]); 
      }
    }

    bdata += '<tr> \
		<td>'+blockid[sd]+'</td> \
		<td>'+treasury[sd].toFixed(8)+'</td> \
		<td>'+coinbase[sd].toFixed(8)+'</td> \
		<td>'+gt[sd]+'</td> \
		<td>'+reclaimed[sd].toFixed(8)+'</td> \
		<td>'+spent[sd].toFixed(8)+'</td> \
		<td>'+unspent[sd].toFixed(8)+'</td> \
		<td>'+fees[sd]+'</td> \
	      </tr>';	
  }


   bdata += '<tr> \
		<td>TOTAL</td> \
		<td>'+tr.toFixed(8)+'</td> \
		<td>'+total_coinbase.toFixed(8)+'</td> \
		<td></td> \
		<td>'+total_reclaimed.toFixed(8)+'</td> \
		<td>'+total_unspent.toFixed(8)+'</td> \
		<td></td> \
		<td>'+tr.plus(total_coinbase).plus(total_reclaimed).plus(total_unspent).toFixed(8)+'</td> \
	      </tr>';	

  return bdata;

}




