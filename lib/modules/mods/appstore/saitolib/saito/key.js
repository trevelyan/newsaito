const saito         = require('../saito');


/////////////////
// Constructor //
/////////////////
function Key() {

  if (!(this instanceof Key)) {
    return new Key();
  }

  this.publickey      = "";
  this.tags           = [];
  this.identifiers    = [];
  this.watched        = 0;
  this.lock_block     = 0; // after this bid, identifier is locked
  this.aes_publickey  = "";
  this.aes_privatekey = "";
  this.aes_secret     = "";

  return this;

}
module.exports = Key;


////////////
// addTag //
////////////
//
// a tag is a random keyword we can associate with
// addresses, and then filter on.
//
// @params {string} tag
//
Key.prototype.addTag = function addTag(tag) {
  if (this.isTagged(tag) == 0) { this.tags.push(tag); }
}


///////////////////
// addIdentifier //
///////////////////
//
// an identifier is an address that can be registered 
// through our DNS system and used in lieu of a pkey
//
// @params {string} identifier
//
Key.prototype.addIdentifier = function addIdentifier(identifier) {
  if (this.isIdentifier(identifier) == 0) { this.identifiers.push(identifier); }
}


///////////////////
// addIdentifier //
///////////////////
//
// return 1 if we have a shared secret with this key
// that we can use to encrypt communications
//
Key.prototype.hasSharedSecret = function hasSharedSecret() {
  if (this.aes_secret != "") { return 1; }
  return 0;;
}


//////////////////
// isIdentifier //
//////////////////
//
// return 1 if we have a shared secret with this key
// that we can use to encrypt communications
//
Key.prototype.isIdentifier = function isIdentifier(identifier) {
  for (let x = 0; x < this.identifiers.length; x++) {
    if (this.identifiers[x] == identifier) { return 1; }
  }
  return 0;
}


///////////////
// isWatched //
///////////////
//
// return 1 if this public key is watched
//
// @params {string] public key
// @returns {boolean} is key watched?
//
Key.prototype.isWatched = function isWatched(publickey) {
  return this.watched;
}


//////////////
// isTagged //
//////////////
//
// return 1 if this public key is watched
//
// @params {string] public key
// @returns {boolean} is key watched?
//
Key.prototype.isTagged = function isTagged(tag) {
  for (let x = 0; x < this.tags.length; x++) {
    if (this.tags[x] == tag) { return 1; }
  }
  return 0;
}


//////////////////////
// removeIdentifier //
//////////////////////
//
// remove identifier from key
//
// @params {string] identifier
//
Key.prototype.removeIdentifier = function removeIdentifier(identifier) {
  if (this.isIdentifier(identifier) == 0) { return; }
  for (let x = this.identifiers.length-1; x >= 0; x++) {
    if (this.identifiers[x] == identifier) {
      this.identifiers.splice(x, 1);
    }
  }
}


///////////////
// removeTag //
///////////////
//
// remove tag from key
//
// @params {string] tag
//
Key.prototype.removeTag = function removeTag(tag) {
  if (this.isTagged(tag) == 0) { return; }
  for (let x = this.tags.length-1; x >= 0; x++) {
    if (this.tags[x] == tag) {
      this.tags.splice(x, 1);
    }
  }
}

