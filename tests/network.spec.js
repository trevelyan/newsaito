const assert = require('chai').assert

const Network = require('../lib/saito/network');

describe('NETWORK', () => {
  const network = new Network();

  describe('Constructor', () => {
    it('should have all necessary fields for a Block object', () => {
      assert(network.app !== undefined)
    });
    it('should have peers array field', () => {});
    it('should have peer_monitor_time field', () => {});
    it('should have peer_monitor_timer_speed field', () => {});
    it('should have peers_connected field', () => {});
    it('should have peers_connected_limit', () => {});
  });

  describe('initalize', () => {
    it('should call addPeer function for all peers in options file', () => {});
    it('should call cleanupDisconnectedSocket when peer is not connected', () => {});
  });
  describe('addPeer', () => {
    it('should not connect to its own self', () => {});
    it('should create new peer object', () => {});
    it('should add peer to peers array', () => {});
    it('should increase peers_connected field', () => {});
  });
  describe('addRemotePeer', () => {
    it('should deny connecting to peers greater than peers_connected_limit', () => {});
    it('should not allow a peer to be added twice', () => {});
    it('should should create new peer object', () => {});
    it('should add peer object to peer array', () => {});
    it('should increment peers_connected field', () => {});
  });
  describe('isPrivateNetwork', () => {
    it(`should return false if peers are connected`, () => {});
    it(`should return false if options contains peers`, () => {});
    it(`else should return true`, () => {});
  });
  describe('cleanupDisconnectedSocket', () => {
    it('should not remove peers if they are in the options file', () => {});
    it('should not remove peers serving dns', () => {});
    it('should remove peers from peer review', () => {});
    it('should decrement peers_connected', () => {});
  });
  describe('propagateBlock', () => {
    it('should early return blk if it is null', () => {});
    it('should early return if blk is invalid', () => {});
    it('should call sendRequest to all peers in array', () => {});
  });
  describe('propagateGoldenTicket', () => {
    it('should early return if tx is null', () => {});
    it('should early return if tx.is_valid is 0', () => {});
    it('should early return if tx.transaction.gt is 0', () => {});
    it('should early return if tx.transaction.msg is blank', () => {});
    it('should call propagateTransaction for a valid tx', () => {});
  });
  describe('sendRequest', () => {
    it('should call sendRequest for each peer in peer array', () => {});
  });
  describe('propagateTransaction', () => {
    it('should early return if tx is null', () => {});
    it('should early return if tx.is_valid is false', () => {});
    it('should not propagate to a peer if it exists in the tx path', () => {});
    it('should add to mempool if it does not exist currently', () => {});
    it('should add valid tx to path', () => {});
    it('should call sendRequest()', () => {});
  });
  describe('close', () => {
    it('should call disconnect() for all peers in peers array', () => {});
  });


});
