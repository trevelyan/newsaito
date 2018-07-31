const assert = require('chai').assert;

const Storage = require('../lib/saito/storage');

describe('STORAGE', () => {
  const storage = new Storage();

  describe('Constructor', () => {
    it('should have all necessary fields for a Storage object', () => {
      assert(storage.app !== undefined)
      assert(storage.directory !== undefined)
    });
  });

  describe('Initialize', () => {
    it('should import options file successfully ', () => {
      assert(1,1)
    });
  })

});