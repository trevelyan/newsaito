const assert = require('chai').assert

const Monitor = require('../lib/saito/monitor');

describe('MONITOR', () => {
  const monitor = new Monitor();

  describe('Constructor', () => {
    it('should have all necessary fields for a Block object', () => {
      assert(monitor.app !== undefined);
      assert.equal(monitor.bundling_active, false);
    });
  });

  describe('isBundlingActive', () => {
    it(`should return bundling_active boolean`, () => {
      assert.isBoolean(monitor.isBundlingActive(), "returnBundlingActive returns a boolean value");
    });
  });

  describe('toggleBundlingActive', () => {
    it(`should return true if it's a private network`, () => {
      assert.equal(monitor.bundling_active, false);
      monitor.toggleBundlingActive();
      assert.equal(monitor.bundling_active, true);
    });
  });

});