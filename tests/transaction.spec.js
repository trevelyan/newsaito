// const chai = require('chai');
// const should = chai.should();
// const expect = chai.expect;

const Transaction = require('../lib/saito/transaction');

var assert = require('assert');


describe('TRANSACTION', () => {

  const tx = new Transaction();
  const txDefault = {
    id: 1,
    from: [],
    to: [],
    ts: '',
    sig: '',
    ver: 1,
    path: [],
    type: 0,
    msg: {},
    msig: '',
    ps: 0
  }

  describe('Constructor', () => {
    it('should contain all necessary values', () => {
      assert.deepEqual(tx.transaction, txDefault)
      assert.notEqual(tx.transaction.id, undefined)
      assert.deepEqual(tx.transaction.from, [])
      assert.deepEqual(tx.transaction.to, [])
      assert.equal(tx.transaction.ts, "")
      assert.equal(tx.transaction.sig, "")
      assert.equal(tx.transaction.ver, 1.0)
      assert.deepEqual(tx.transaction.path, [])
      assert.equal(tx.transaction.type, 0)
      assert.deepEqual(tx.transaction.msg, {})
      assert.equal(tx.transaction.msig, "")
      assert.equal(tx.transaction.ps, 0)
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