var eth = require('./eth');

var account1         = new eth.account();
var account2         = new eth.account();

//
// this is the initial deposit that is put
// into the smart contract. there are 18
// decimal places in a WEI
//
//var account1_deposit = 1000000000000000000;
//var account2_deposit = 2000000000000000000;
var account1_deposit = 1000000000000000;
var account2_deposit = 2000000000000000;

//
// these are the signatures that are used
// to sign the distributions.
//
var account1_sigidx  = 1;
var account2_sigidx  = 2;



account1.setCoinDistribution(account1_deposit);
account2.setCoinDistribution(account2_deposit);
account1.setIndexSigned(1);
account2.setIndexSigned(2);

var accounts = [];
    accounts[0] = account1;
    accounts[1] = account2;

console.log("\n\n\n");
console.log("Step 1: ");
console.log("submit the following addresses to the CREATE function, with a payment in WEI of: " + account1_deposit);
console.log('"' + account1.returnAddress() + '", "' + account2.returnAddress() + '"');
console.log("\n\n\n");


console.log("\n\n\n");
console.log("DEPOSIT: ");
console.log("send a deposit of '+account2_deposit+' with a transaction announcing the deposit of the second user: ");
console.log('"0", "' + account2.returnAddress() + '"');
console.log("\n\n\n");


//
// now we generate our signatures
//
var msg_to_sign1 = "" + account1.returnCurrentCoinDistribution() + account1.returnIndexSigned();
var signed_msg1   = account1.signMessage(account1.keys, msg_to_sign1);
var msg_to_sign2 = "" + account2.returnCurrentCoinDistribution() + account2.returnIndexSigned();
var signed_msg2   = account2.signMessage(account2.keys, msg_to_sign2);

console.log("\n\n\n");
console.log("VALIDATE MESSAGE 1: ");
console.log(" ---> " + signed_msg1);
console.log(
		'"' + account1.returnAddress() + '", ' +
		'"' + account1.returnMessageHash() + '", ' +
		'"0x' + signed_msg1.r.toString('hex') + '"' + ", " +
                '"0x' + signed_msg1.s.toString('hex') + '"' + ", "
);


console.log("\n\n\n");
console.log("VALIDATE MESSAGE 2: ");
console.log(" ---> " + signed_msg2);
console.log(
		'"' + account2.returnAddress() + '", ' +
		'"' + account2.returnMessageHash() + '", ' +
		'"0x' + signed_msg2.r.toString('hex') + '"' + ", " +
                '"0x' + signed_msg2.s.toString('hex') + '"' + ", "
);


console.log("\n\n\n");
console.log("VALIDATE MESSAGE: ");
console.log(
		'"' + 0 + '"' + ", " + 

		'"' + account1.returnCurrentCoinDistribution() + '"' + ", " +
		'"' + account1.returnIndexSigned() + '"' + ", " +
		'"0x' + signed_msg1.r.toString('hex') + '"' + ", " +
		'"0x' + signed_msg1.s.toString('hex') + '"' + ", " +

		'"' + account2.returnCurrentCoinDistribution() + '"' + ", " +
		'"' + account2.returnIndexSigned() + '"' + ", " +
		'"0x' + signed_msg2.r.toString('hex') + '"' + ", " +
		'"0x' + signed_msg2.s.toString('hex') + '"'

);
console.log("\n\n\n");

















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











