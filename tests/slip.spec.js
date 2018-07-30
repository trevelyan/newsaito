// const chai   = require('chai');
// const should = chai.should();
// const expect = chai.expect;

var assert = require('assert');

const Slip = require('../lib/saito/slip');


describe('SLIP', function() {
  const slip = new Slip();

  describe('Constructor', function() {
    it('should produce random 0<= rn < 100', function(){
      assert(slip.rn >= 0 && slip.rn < 100)
    });
  });
});