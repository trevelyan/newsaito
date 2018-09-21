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
    let pageToWrite = money_self.returnIndexHTML(app);
    fs.writeFileSync((__dirname + "/web/index.html"), pageToWrite, function(err) {
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

  let page_data = this.returnTableContents(app);

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
	  <th>Id</th> \
	  <th>Treasury</th> \
	  <th>Coinbase</th> \
	  <th>Burn Fee</th> \
	  <th>Fees</th> \
	  <th>Golden Ticket</th> \
	  <th>Creator Share</th> \
	  <th>Node Share</th> \
	  <th>Miner Share</th> \
	  <th>Reclaimed</th> \
	  <th>Spent</th> \
	  <th>Unspent</th> \
	</tr> \
      '+page_data+ ' \
     </table> \
    </div> \
\
</body> \
</html>';

  return pagehtml;

}




Money.prototype.returnTableContents = function returnTableContents(app) {

  var thtml = "";
  var latest_bid = app.blockchain.returnLatestBlockId(); 
  var earliest_bid = latest_bid - app.blockchain.returnGenesisPeriod();
  if (earliest_bid < 1) { earliest_bid = 1; }

  var fees          = [];
  var gt            = [];
  var treasury      = [];
  var coinbase      = [];
  var reclaimed     = [];
  var spent         = [];
  var unspent       = [];
  var blockid       = [];
  var creator_share = [];
  var node_share    = [];
  var miner_share   = [];
  var burn_fee      = [];

  var spent_input_slips = [];

  //for (let bid = earliest_bid, idx = 0, bind = 0; bid <= latest_bid; bid++, bind++) {
  for (let bid = latest_bid, idx = this.app.blockchain.index.hash.length-1, bind = 0; bid >= earliest_bid; bid--, bind++) {

    //while (bid > 1 && this.app.blockchain.blocks[idx].block.id < bid) { idx++ };
    //while (this.app.blockchain.index.lc[idx] != 1) { idx++ };

    while (this.app.blockchain.blocks[idx].block.id > bid && idx >= 0) { idx--; };
    while (this.app.blockchain.index.lc[idx] != 1 && idx >= 0) { idx--; };
    if (idx == -1) { idx = 0; }

//console.log("IDX: " + idx);

    let tmpblk = this.app.blockchain.blocks[idx];

//console.log("THIS IS THE BID: " + bid + "/" + tmpblk.block.id);
//console.log("THIS IS THE HASH: "+tmpblk.returnHash());
//console.log("THIS IS THE TREASURY: "+tmpblk.returnTreasury());
//console.log("THIS IS THE COINBASE: "+tmpblk.returnCoinbase());
//console.log("THIS IS THE BLOCK: " + JSON.stringify(tmpblk.block));


    let burn_fee_needed = Big(0);
    if (tmpblk.block.bf.current != undefined) { burn_fee_needed = Big(tmpblk.block.bf.current).toFixed(8); 
//
// hack
//
burn_fee_needed = Big(burn_fee_needed);

    }

    let creator_fees    = Big(tmpblk.returnAvailableFees(tmpblk.block.creator));
    let creator_surplus = creator_fees.minus(burn_fee_needed);
    let total_surplus   = Big(tmpblk.returnFeesTotal()).minus(creator_surplus).minus(burn_fee_needed);
    let total_fees      = Big(tmpblk.returnFeesTotal());
    let total_fees_for_miners_and_nodes = Big(total_fees).minus(creator_surplus).plus(tmpblk.returnCoinbase());
    let node_share2     = total_fees_for_miners_and_nodes.div(2).toFixed(8);
    let miner_share2    = total_fees_for_miners_and_nodes.minus(Big(node_share2)).toFixed(8);

//console.log(burn_fee_needed + " --- " + total_fees_for_miners_and_nodes.toFixed(8) + " -- " + node_share2 + " -- " + miner_share2);

    //
    // top-level block data
    //
    blockid[bind]       = bid;
    treasury[bind]      = Big(tmpblk.returnTreasury());
    coinbase[bind]      = Big(tmpblk.returnCoinbase());
    reclaimed[bind]     = Big(tmpblk.returnReclaimed());
    spent[bind]         = Big(0.0);
    unspent[bind]       = Big(0.0);
    creator_share[bind] = creator_surplus.toFixed(8);
    node_share[bind]    = Big(node_share2).toFixed(8);
    miner_share[bind]   = Big(miner_share2).toFixed(8);
    gt[bind]            = 0;
    fees[bind]          = Big(tmpblk.returnFeesTotal());
    burn_fee[bind]      = burn_fee_needed;

    //
    // calculate spent and unspent
    //
    // the problem with this right now is that we are counting blocks in the OPPOSITE
    // direction from what we used to count.
    if (tmpblk != null) {
      for (var bt = 0; bt < tmpblk.transactions.length; bt++) {

        tx = tmpblk.transactions[bt].transaction;

        if (tmpblk.transactions[bt].isGoldenTicket() == 1) { gt[bind] = 1; }

        for (var s = 0; s < tx.from.length; s++)  { spent_input_slips.push(tx.from[s]); }
        for (var s1 = 0; s1 < tx.to.length; s1++) {

	  var slip1 = tx.to[s1];
	  var slip1_spent = 0;

	  var block_id = bid;
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

  //
  // calculate amount floating around
  //

  // latest treasury 
  //   + latest reclaimed
  //   + creator share
  //   + coinbase (for unclaimed golden tickets)
  //  
  var bdata = '';
  var money_supply              = Big(0.0);
  var locked_coinbase           = Big(0.0);

  for (var sd = 0; sd < spent.length; sd++) {

    //
    // money supply = latest treasury plus reclaimed
    //
    if (sd == 0) {
      money_supply = treasury[sd];
      locked_coinbase = locked_coinbase.plus(Big(coinbase[sd])).plus(burn_fee[sd]);
      money_supply = money_supply.plus(unspent[sd]);
      money_supply = money_supply.plus(reclaimed[sd]);
    }


    else {

      money_supply = money_supply.plus(unspent[sd]);

      //
      // golden ticket
      //
      if (gt[sd-1] != 1) {
        locked_coinbase = locked_coinbase.plus(Big(coinbase[sd])).plus(Big(burn_fee[sd]));
        node_share[sd] = "0";
        miner_share[sd] = "0";
      }

    }

console.log("LC: " + locked_coinbase.toFixed(10));

    bdata += '<tr> \
		<td>'+blockid[sd]+'</td> \
		<td>'+treasury[sd].toFixed(8)+'</td> \
		<td>'+coinbase[sd].toFixed(8)+'</td> \
		<td>'+burn_fee[sd].toFixed(8)+'</td> \
		<td>'+fees[sd]+'</td> \
		<td>'+gt[sd]+'</td> \
		<td>'+creator_share[sd]+'</td> \
		<td>'+miner_share[sd]+'</td> \
		<td>'+node_share[sd]+'</td> \
		<td>'+reclaimed[sd].toFixed(8)+'</td> \
		<td>'+spent[sd].toFixed(8)+'</td> \
		<td>'+unspent[sd].toFixed(8)+'</td> \
	      </tr>';	
  }

  bdata += '<tr> \
		<td>TOTAL</td> \
		<td><b>'+money_supply.plus(locked_coinbase).toFixed(8)+'</b></td> \
		<td>'+money_supply.toFixed(8)+'</td> \
		<td>'+locked_coinbase.toFixed(8)+' == ' + locked_coinbase.toFixed(9) + '</td> \
		<td></td> \
		<td></td> \
		<td></td> \
		<td></td> \
		<td></td> \
		<td></td> \
	      </tr>';	

  return bdata;

}




