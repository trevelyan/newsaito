const assert = require('chai').assert

const BurnFee = require('../lib/saito/burnfee');
const saito = require('../lib/saito');

describe('BURNFEE', () => {

  var app = {};
  // const burnfee = new BurnFee();
  const burnfee = new saito.burnfee(app);
  const bf = { start: 2 };

  describe('Constructor', () => {
    it('should have all necessary fields for a Blockchain object', () => {
    });
  });

});
