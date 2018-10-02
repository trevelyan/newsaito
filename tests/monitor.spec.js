const assert = require('chai').assert

const Monitor = require('../lib/saito/monitor');

describe('MONITOR', () => {

  var app = {};
      app.mempool = {};

  const monitor = new Monitor(app);

  describe('Constructor', () => {
    it('should have all necessary fields for a Block object', () => {
      assert(monitor.app !== undefined);
    });
  });

  describe('canMempoolBundleBlock', () => {
    it(`should let us know we cannot do this, because we are unpermissive creatures`, () => {
      assert(monitor.canMempoolBundleBlock() == false);
    });
  });

});
