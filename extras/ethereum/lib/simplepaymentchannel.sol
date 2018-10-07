pragma solidity ^0.4.16;

//
//
// simple two-party payment contract
//
// (c) David Lancashire, Proclus Technologies (July 31, 2018)
//
contract SimplePaymentChannel {

    address owner;

    //
    // tracks the number of payment channels handled
    // by this contract. the number of the contract
    // is the index in the various maps below
    //
    uint channel = 0;

    //
    // block delay
    //
    uint block_delay = 5760; // 24 hour at 15 secs

    //
    // the addresses of the two parties in our payment
    // channel. address1 is the user who initiates the 
    // channel
    //
    mapping (uint => address)   private address1;
    mapping (uint => address)   private address2;
    
    //
    // integer reflecting the total number of ETH in 
    // deposit in the contract (in Wei)
    //
    mapping (uint => uint)      private address1_deposit;
    mapping (uint => uint)      private address2_deposit;
    
    //
    //
    //
    mapping (uint => uint)      private withdrawal;
    
    //
    //
    //
    mapping (uint => uint)      private sigindex;
    
    //
    //
    //
    mapping (uint => uint)      private block_id;


    /////////////////
    // constructor //
    /////////////////
    function SimplePaymentChannel() {
        owner = msg.sender;
    }



    ////////////
    // create //
    ////////////
    //
    // create a simple two-party payment channel, the amount 
    // of ETH submitted with this transaction is the payment 
    // deposited to the contract by USER1
    //
    function create(address add1, address add2) public payable returns (uint) {

        // users
        address1[channel] = add1;
        address2[channel] = add2;

        // initialize
        address1_deposit[channel]    = msg.value;
        address2_deposit[channel]    = 0;

        block_id[channel]            = 0;
        withdrawal[channel]          = 0;
        
        //
        // this variable tracks whether a withdrawal request
        // has been made on a channel. If this is set to 0, then
        // the recipient (USER2) can withdraw anytime, but the 
        // creator must wait
        // 
        sigindex[channel]            = 0;

        //
        // increment for the next user
        //
        channel++;

        return channel-1;
     
    }



    /////////////
    // deposit //    
    /////////////
    //
    // deposit funds to a payment channel that already exists.
    // this contract should return the funds to the sending
    // address in the event of any problem depositing the 
    // payment.
    //
    function deposit(uint channel_id, address deposit_address) public payable returns (uint) {

        if (deposit_address == address1[channel_id]) {
            address1_deposit[channel_id] += msg.value;
            return;
        }
        if (deposit_address == address2[channel_id]) {
            address2_deposit[channel_id] += msg.value;
            return;
        }

        //        
        // TODO: if the deposit_address does not match either of 
        // the two parties to the contract at this ID, we want to 
        // return the payment to the sender, as it is likely a 
        // mistaken contract_id deposit.
        //
        
    }



    /////////////
    // balance //    
    /////////////
    //
    // return the balance associated with an address in a 
    // specific payment channel. The second variable submitted
    // is 1 or 2 depending on the user we are asking after
    //
    function balance(uint channel_id, uint uid) returns (uint) {
        if (uid == 1) { return address1_deposit[channel_id]; }
        if (uid == 2) { return address1_deposit[channel_id]; }
        return 0;
    }



    //////////////
    // withdraw //
    //////////////
    //
    // withdrawal attempts require uploading withdrawal information
    // from both parties, along with a signature created by signing
    // this information. The information provided by each party is:
    //
    // channel_id
    // withdrawal in WEI (for party 1)
    // sig_index (of party 1)
    // r1 (from party 1)
    // s1 (from party 1)
    // withdrawal in WEI (for party 2)
    // sig_index (of party 2)
    // r1 (from party 2)
    // s1 (from party 2)
    //
    // when a withdrawal attempt is made, we check that the sig_indexes 
    // are sequential. And that the signatures are valid given the withdrawal 
    // amounts and the sig_indexes provided.
    //
    // the logic of our payment channel is that each time someone makes
    // a payment they increment sig_index by 1 and send an authorization
    // of the withdrawal amount back to the other party along with their 
    // signature. Anyone who has received a payment signature from someone
    // else has the authority to withdraw as they can submit a proof with
    // their own incremented signature. 
    //
    function withdraw(uint channel_id, uint withdrawal1, uint sig1, bytes32 r1, bytes32 s1, uint withdrawal2, uint sig2, bytes32 r2, bytes32 s2) returns (uint) {

      //
      // sigs must be sequential
      //
      if (sig1 > sig2) {
          if (sig2+1 != sig1) { return 0; }
      } else {
          if (sig2 != sig1) {
              if (sig2 != sig1+1) { return 0; }
          }
      }
      
      //
      // ensure sigs are valid, one by one
      //
      uint valid = 0;
      
      var msg = generateMessage(withdrawal1, sig1);
      valid = validateMessage(address1[channel_id], msg, r1, s1);
      if (valid == 0) { return 0; }

      msg = generateMessage(withdrawal2, sig2);
      valid = validateMessage(address2[channel_id], msg, r2, s2);
      if (valid == 0) { return 0; }

      //
      // ensure withdrawal is not higher than the amount committed
      // to their channel. This avoids having multiple parties defraud
      // other participants sending funds to the contract
      //
      if ((address1_deposit[channel_id]+address2_deposit[channel_id]) < (withdrawal1+withdrawal2)) {
        return 0;
      }
    

      //
      // if this is our first withdrawal attempt, we set a 
      // cool-down period for when we will authorize this
      // withdrawal.
      //
      if (sigindex[channel_id] == 0) { 
        
        sigindex[channel_id] = (sig1+sig2);
        block_id[channel_id] = block.number + block_delay; // 24 hour at 15 secs
        return block_id[channel_id];
        
      } else {
      
        //
        // this is a subsequent withdrawal attempt, we see 
        // if it is better than our existing withdrawal attempt
        // and restart the countdown if that is the case
        //
        if (sigindex[channel_id] < (sig1+sig2)) {
            
          sigindex[channel_id] = (sig1+sig2);
          block_id[channel_id] = block.number + block_delay; // 24 hour at 15 secs
          return block_id[channel_id];
            
        } else {
        
          //    
          // this is a subsequent withdrawal attempt, so we 
          // check that we are in a block position to withdraw
          //
          if (block_id[channel_id] <= block.number) {
                
            // authorize withdrawals
            withdrawal[channel_id] = 1;
            address1[channel_id].transfer(withdrawal1);
            address2[channel_id].transfer(withdrawal2);
            block_id[channel_id] = block.number; // 24 hour at 15 secs

            return block_id[channel_id];

          } else {
              
              // not yet, bucko
              return block_id[channel_id];
              
          }
        }
      }
    }



    //
    // from this point on, the functions in this smart contract 
    // are utility functions which should not need to be changed
    // and can be treated as "black-boxes". They handle message-
    // signing and cryptographic verification, as well as things
    // like type-conversions.
    //


    /////////////////////////
    // generateMessageHash //
    /////////////////////////
    //
    // x = coin distribution
    // y = index signed
    //
    function generateMessage(uint x, uint y) return s (bytes32) {
        return sha256(uint2str(x), uint2str(y));
    }


    ///////////////////
    // verifyMessage //
    ///////////////////
    function validateMessage(address add1, bytes32 m, bytes32 r, bytes32 s) returns (uint) {
        if (ecrecover(m,28,r,s) == add1) { return 1; }
        if (ecrecover(m,27,r,s) == add1) { return 1; }
        return 0;
    }


    //////////
    // kill //
    //////////
    //
    // remove before production
    //
    function kill() {
      if (msg.sender == owner) { suicide(msg.sender); }
    }


    /////////////
    // utility //
    /////////////
    function uint2str(uint i) internal pure returns (string){
        if (i == 0) return "0";
        uint j = i;
        uint len;
        while (j != 0) {
            len++;
            j /= 10;
        }
        bytes memory bstr = new bytes(len);
        uint k = len - 1;
        while (i != 0){
            bstr[k--] = byte(48 + i % 10);
            i /= 10;
        }
        return string(bstr);
    }

}



