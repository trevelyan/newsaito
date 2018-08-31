var eth = require('./eth');

var account1 = new eth.account();
var account2 = new eth.account();

account1.setCoinDistribution(1000000000000000000);
account2.setCoinDistribution(3000000000000000000);
account1.setIndexSigned(1);
account2.setIndexSigned(2);


var accounts = [];
    accounts[0] = account1;
    accounts[1] = account2;



console.log("\n\n\n");
console.log("CREATE CHANNEL: ");
console.log('"' + account1.returnAddress() + '", "' + account2.returnAddress() + '"');
console.log("\n\n\n");


console.log("\n\n\n");
console.log("DEPOSIT: ");
console.log('"0", "' + account2.returnAddress() + '"');
console.log("\n\n\n");



var msg_to_sign  = account1.returnCurrentCoinDistribution() + ", " + account1.returnIndexSigned();
var msg_to_sign2 = "" + account1.returnCurrentCoinDistribution() + account1.returnIndexSigned();
var signed_msg   = account1.signMessage(account1.keys, msg_to_sign2);
var msg_to_sign3 = "" + account2.returnCurrentCoinDistribution() + account2.returnIndexSigned();
var signed_msg2   = account2.signMessage(account2.keys, msg_to_sign3);


console.log("MSG and MSG HASH: ");
console.log(msg_to_sign);
console.log("\n\n\n");

console.log(account1.returnMessageHash());
console.log("0x" + signed_msg.r.toString('hex'));
console.log("0x" + signed_msg.s.toString('hex'));
console.log("\n\n\n");


console.log("VALIDATE MESSAGE: ");
console.log(

		'"' + 0 + '"' + ", " + 

		'"' + 1000000000000000000 + '"' + ", " +
		'"' + account1.returnIndexSigned() + '"' + ", " +
		'"0x' + signed_msg.r.toString('hex') + '"' + ", " +
		'"0x' + signed_msg.s.toString('hex') + '"' + ", " +

		'"' + 3000000000000000000 + '"' + ", " +
		'"' + account2.returnIndexSigned() + '"' + ", " +
		'"0x' + signed_msg2.r.toString('hex') + '"' + ", " +
		'"0x' + signed_msg2.s.toString('hex') + '"'

);






function return_initialization_script(accounts) {

  var output = '';

  output += '[';

  for (var i = 0; i < accounts.length; i++) {
    output += '"0x000000000000000000000000';
    output += accounts[i].returnPublicKey();
    output += '", ';
  }

  for (var i = 0; i < accounts.length; i++) {
    if (i > 0) { output += ', '; }
    output += '"';
    output += accounts[i].returnInitialCoinDistribution();
    output += '"';
  }

  output += ']';

  return output;

}

function return_withdrawal_script(accounts) {

  var output = '';

  output += '[';

  for (var i = 0; i < accounts.length; i++) {
    output += '"' + accounts[i].returnCurrentCoinDistribution() + '"';
    output += ', ';
    output += '"' + accounts[i].returnCurrentCoinDistribution() + '"';
    output += ', ';
  }

  for (var i = 0; i < accounts.length; i++) {
    output += '"' + accounts[i].returnIndexSigned() + '"';
    output += ', ';
  }

  for (var i = 0; i < accounts.length; i++) {
    if (i > 0) { output += ', '; }
    output += accounts[i].returnMRS();
  }


  output += ']';

  return output;

}











