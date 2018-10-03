const assert = require('chai').assert;
const Transaction = require('../lib/saito/transaction');


describe('TRANSACTION', () => {

  const tx = new Transaction();

  describe('Constructor', () => {
    it('there is a contructor', () => {
      assert.notEqual(tx.transaction.id, undefined)
    });
  });

  // describe('addFrom', function() {
  //   it('should add slip to tx.transaction.from', function(){
  //     tx.addFrom("27ebA7Ai68RReWiHE8VMmEQVQpCp2M3epZmvW38DhB6Kc", 2);
  //     assert(tx.transaction.from[0] instanceof Slip);
  //     assert(tx.transaction.from[0].add === "27ebA7Ai68RReWiHE8VMmEQVQpCp2M3epZmvW38DhB6Kc");
  //   });
  // });
  // describe('toFrom', function() {
  //   it('should add slip to tx.transaction.to', function(){
  //     tx.addTo("kNe8jyemTbjrrxgaRwwJRSHe7RhibwrbiBWXmvQo2FBL", 3);
  //     assert(tx.transaction.to[0] instanceof Slip);
  //     assert(tx.transaction.to[0].amt === 3);
  //   });
  // });

  // const tx1 = new Transaction();
  // const tx2 = new Transaction();
  // const tx3 = new Transaction();
  // const tx4 = new Transaction();

  // tx2.addTo("", 2);
  // tx2.addTo("", 2);
  // tx3.addTo("", 2);
  // tx3.addTo("00000000000000000000000000000000000000000000", 2);

  // describe('validateRebroadcastTransaction', function() {
  //   it('should return 0 due to no fee transcation', function() {
  //     assert(!tx1.validateRebroadcastTransaction(""));
  //   });
  //   it('should return 0 due to inadequate tx fees', function() {
  //     assert(!tx2.validateRebroadcastTransaction("", 3));
  //   });
  //   it('should return 0 due to not trapdoor address', function() {
  //     assert(!tx2.validateRebroadcastTransaction("", 1));
  //   });
  //   it('should validate', function(){
  //     assert(tx3.validateRebroadcastTransaction("", 1));
  //   });
  // });
  // tx1.addFrom("1", 3);
  // tx1.addFrom("1", 5);
  // tx1.addFrom("1", 1);
  // tx1.addFrom("2", 2);
  // tx1.addFrom("3", 1);
  // describe('returnSlipsFrom', function() {
  //   it('should return the right slips', function() {
  //     var slips = tx1.returnSlipsFrom("1");
  //     assert(slips.length == 3);
  //     for(var slip of slips) {
  //       assert(slip.add == "1");
  //     }
  //   });
  // });
  // describe('generateRebroadcastTransaction', function() {
  //   it('should fail, no to addresses', function(){
  //     assert(!tx4.generateRebroadcastTransaction("", 2));
  //   });
  // });
});
