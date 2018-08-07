const assert = require('chai').assert;

const Voter = require('../lib/saito/voter');

// ***VOTERT***
describe('Voter', () => {
  const voter = new Voter();

  // do we prefer the right block
  describe('prefersBlock', () => {
    it('should prefer block A to block B', () => {

      let a = {};
      a.block = {};
      a.block.paysplit = 0.6;
      a.block.vote     = -1;

      let b = {};
      b.block = {};
      b.block.paysplit = 0.7;
      b.block.vote     = 0;

      let expectedResult = true;

      assert.equal(voter.prefersBlock(a,b), expectedResult);

    });
  });


  // return difficulty vote
  describe('returnDifficultyVote', () => {
    it('should return -1 difficulty vote if difficulty is too high', () => {
      assert.equal(voter.returnDifficultyVote(3), -1);
    });
  });


  // return difficulty vote
  describe('returnDifficultyVote', () => {
    it('should return 1 difficulty vote if difficulty is too low', () => {
      assert.equal(voter.returnDifficultyVote(1), 1);
    });
  });


  // return difficulty vote
  describe('returnDifficultyVote', () => {
    it('should return 0 difficulty vote if difficulty is just right', () => {
      assert.equal(voter.returnDifficultyVote(2), 0);
    });
  });


  // return paysplit vote
  describe('returnPaysplitVote', () => {
    it('should return -1 paysplit vote if paysplit is too high', () => {
      assert.equal(voter.returnPaysplitVote(0.7), -1);
    });
  });


  // return paysplit vote
  describe('returnPaysplitVote', () => {
    it('should return 1 paysplit vote if paysplit is too low', () => {
      assert.equal(voter.returnPaysplitVote(0.3), 1);
    });
  });


  // return paysplit vote
  describe('returnPaysplitVote', () => {
    it('should return 0 paysplit vote if paysplit is just right', () => {
      assert.equal(voter.returnPaysplitVote(0.5), 0);
    });
  });



})
