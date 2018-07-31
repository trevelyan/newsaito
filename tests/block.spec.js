const chai = require('chai');
const should = chai.should();
const expect = chai.expect;

const Block = require('../lib/saito/block');

var assert = require('assert');

describe('BLOCK', () => {
  const block = new Block();
  console.log(block)

  describe('Constructor', () => {
    it('should have all necessary fields for a Block object', () => {
      
    });
  });

  describe('Initialize', () => {
    it('should import options file successfully ', () => {
      assert(1,1)
    });
  });

});