const chai = require('chai');
const should = chai.should();
const expect = chai.expect;

const Mempool = require('../lib/saito/storage');

var assert = require('assert');

describe('MEMPOOL', () => {
  const mempool = new Mempool();

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