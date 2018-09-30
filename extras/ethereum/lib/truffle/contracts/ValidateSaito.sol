pragma solidity ^0.4.16;


//
// two-party payment contract
//
// (c) David Lancashire, Proclus Technologies (July 31, 2018)
//
contract ValidateSaito {
    
    address owner;

    mapping (uint => string)    private publickey1;
    mapping (uint => string)    private publickey2;
    mapping (uint => uint)      private deposit;
    mapping (uint => uint)      private withdrawal;
    mapping (uint => uint)      private sigindex;

    bytes32 m       = 0xafa683ca78e466e120163fd97174907382fccd2a6946e9cbdff907c7cee2dc06;
    bytes32 r       = 0x796c96382e06fa54b4b425f26b8645a43f5cdcb2375f7c586a0b5d01aa8e1efa; 
    bytes32 s       = 0x0fded7b2942022d3a409240689294205ba26df0dc216b221fab19c3de9638d3e;

    string message = "THIS IS OUR MESSAGE";
    
    
    /////////////////
    // constructor //
    /////////////////
    function ValidateSaito() {
        owner = msg.sender;
    }


    ////////////////////
    // create channel //
    ////////////////////
    //
    // create a two-party channel by submitting an array containing:
    //
    // publickey of party1
    // publickey of party2
    // ... and a deposit
    //
    function createChannel(string pkey1, string pkey2) {
      
	// what is our index
	uint idx        = 0;
   
        // users
	publickey1[idx] = pkey1;
	publickey2[idx] = pkey2;

        // initialize 
	deposit[idx]    = 0;
	withdrawal[idx] = 0;
	sigindex[idx]   = 0;

    }

    //////////////
    // withdraw //    
    //////////////
    //
    // withdrawal attempts require uploading signatures
    // from both parties. If the sigindex is 0, a waiting
    // period is established. If the sigindex is greater
    // than 0, we are responding to a withdrawal attempt
    // and get instant payment.
    //
    function withdraw(uint contract_id, uint withdrawal1, uint sig1, bytes32 m1, bytes32 r1, bytes32 s1, uint withdrawal2, uint sig2, bytes32 m2, bytes32 r2, bytes32 s2) {

//
//
// must be careful one cannot submit multiple requests
//
//

      var msg1 = generateMessage(withdrawal1, sig1);
      var valid1 = validateMessage(publickey1[contract_id], msg1, r1, s1);

      //var msg2 = generateMessage(withdrawal2, sig2);
      //var valid2 = validateMessage(publickey2[contract_id], msg2, r2, s2);


      if (valid1 == 1) {



      }


    }



    /////////////////////////
    // generateMessageHash //
    /////////////////////////
    //
    // x = coin distribution
    // y = index signed
    //
    function generateMessage(uint x, uint y) returns (bytes32) { 
        return sha256(x, y);
    }



    ///////////////////
    // verifyMessage //
    ///////////////////
    function validateMessage(address add1, bytes32 m, bytes32 r, bytes32 s) returns (uint) {
        if (ecrecover(m,28,r,s)==add1) { return 1; }
        if (ecrecover(m,27,r,s)==add1) { return 1; }
        return 0;
    }


    //
    // should be removed before production
    //
    function kill() {
      if (msg.sender == owner) { suicide(msg.sender); }
    }
    
    
    
    



    
    ////////////////////////
    // utility functions //
    ///////////////////////
     function bytes32ToUInt(bytes32 x) constant returns (uint) {
        return stringToUInt(bytes32ToString(x));
    }
    function bytes32ToString(bytes32 x) constant returns (string) {
        bytes memory bytesString = new bytes(32);
        uint charCount = 0;
        for (uint j = 0; j < 32; j++) {
            byte char = byte(bytes32(uint(x) * 2 ** (8 * j)));
            if (char != 0) {
                bytesString[charCount] = char;
                charCount++;
            }
        }
        bytes memory bytesStringTrimmed = new bytes(charCount);
        for (j = 0; j < charCount; j++) {
            bytesStringTrimmed[j] = bytesString[j];
        }
        return string(bytesStringTrimmed);
    }

    function stringToUInt(string s) constant returns (uint result) {
        bytes memory b = bytes(s);
        uint i;
        result = 0;
        for (i = 0; i < b.length; i++) {
            uint c = uint(b[i]);
            if (c >= 48 && c <= 57) {
                result = result * 10 + (c - 48);
            }
        }
    }
    function stringToAddress(string _a) constant returns (address){
     bytes memory tmp = bytes(_a);
     uint160 iaddr = 0;
     uint160 b1;
     uint160 b2;
     for (uint i=2; i<2+2*20; i+=2){
         iaddr *= 256;
         b1 = uint160(tmp[i]);
         b2 = uint160(tmp[i+1]);
         if ((b1 >= 97)&&(b1 <= 102)) b1 -= 87;
         else if ((b1 >= 48)&&(b1 <= 57)) b1 -= 48;
         if ((b2 >= 97)&&(b2 <= 102)) b2 -= 87;
         else if ((b2 >= 48)&&(b2 <= 57)) b2 -= 48;
         iaddr += (b1*16+b2);
     }
     return address(iaddr);
    }

    
    
}





