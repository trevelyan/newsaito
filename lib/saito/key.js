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
  this.watched        = false;
  this.lock_block     = false; // after this bid, identifier is locked
  this.aes_publickey  = "";
  this.aes_privatekey = "";
  this.aes_secret     = "";

  return this;

}
module.exports = Key;


/**
 * A tag is a random keyword we can associate with addresses, and then filter on.
 * @param {string} tag
 */
Key.prototype.addTag = function addTag(tag) {
  if (!this.isTagged(tag)) { this.tags.push(tag); }
}


/**
 * An identifier is an address that can be registered
 * through our DNS system and used in lieu of a pkey
 *
 * @param {string} identifier
 */
Key.prototype.addIdentifier = function addIdentifier(identifier) {
  if (!this.isIdentifier(identifier)) { this.identifiers.push(identifier); }
}


/**
 * Checks if a key contains an aes secret used to encrypt communications
 *
 * @returns {boolean} has shared secret?
 */
Key.prototype.hasSharedSecret = function hasSharedSecret() {
  if (this.aes_secret != "") { return true; }
  return false;
}


/**
 * Return 1 if we have a shared secret with this key
 * that we can use to encrypt communications
 *
 * @param {string} identifier
 * @returns {boolean} is identifier?
 */
Key.prototype.isIdentifier = function isIdentifier(identifier) {
  for (let x = 0; x < this.identifiers.length; x++) {
    if (this.identifiers[x] == identifier) { return true; }
  }
  return false;
}


/**
 * Return true if this public is watched
 *
 * @param {string} publickey
 * @returns {boolean} is key watched?
 */
Key.prototype.isWatched = function isWatched(publickey) {
  return this.watched;
}


/**
 * Return true if the public key is tagged
 *
 * @param {string} tag
 * @returns {boolean} is key tagged?
 */
Key.prototype.isTagged = function isTagged(tag) {
  for (let x = 0; x < this.tags.length; x++) {
    if (this.tags[x] == tag) { return true; }
  }
  return false;
}


/**
 * Remove identifier from key
 *
 * @param {string} identifier
 */
Key.prototype.removeIdentifier = function removeIdentifier(identifier) {
  if (!this.isIdentifier(identifier)) { return; }
  for (let x = this.identifiers.length-1; x >= 0; x++) {
    if (this.identifiers[x] == identifier) {
      this.identifiers.splice(x, 1);
    }
  }
}

/**
 * Removes tag from key
 *
 * @param {string} tag
 */
Key.prototype.removeTag = function removeTag(tag) {
  if (!this.isTagged(tag)) { return; }
  for (let x = this.tags.length-1; x >= 0; x++) {
    if (this.tags[x] == tag) {
      this.tags.splice(x, 1);
    }
  }
}

