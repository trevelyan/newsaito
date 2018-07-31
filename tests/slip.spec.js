const assert   = require('chai').assert;

const Slip = require('../lib/saito/slip');


describe('SLIP', () => {
  const slip = new Slip();

  describe('Constructor', () => {
    it('should contain all the necessary fields', () => {
      assert(slip.add    !== undefined)
      assert(slip.amt    !== undefined)
      assert(slip.type   !== undefined)
      assert(slip.bid    !== undefined)
      assert(slip.tid    !== undefined)
      assert(slip.sid    !== undefined)
      assert(slip.bhash  !== undefined)
      assert(slip.lc     !== undefined)
      assert(slip.rn     !== undefined)
    })

    it('should produce random 0<= rn < 100', () => {
      assert(slip.rn >= 0 && slip.rn < 100)
    });
  });
});