var saito = require('../../../saito');
var ModTemplate = require('../../template');
var util = require('util');


//////////////////
// CONSTRUCTOR  //
//////////////////
function Debug(app) {

  if (!(this instanceof Debug)) { return new Debug(app); }

  Debug.super_.call(this);

  this.app             = app;

  this.name            = "Debug";
  this.handlesEmail    = 1;
  this.emailAppName    = "Debug";

  return this;

}
module.exports = Debug;
util.inherits(Debug, ModTemplate);




/////////////////////
// Email Functions //
/////////////////////
Debug.prototype.displayEmailForm = function displayEmailForm(app) {

  $('.lightbox_compose_address_area').hide();
  $('.lightbox_compose_module').hide();

  element_to_edit = $('#module_editable_space');
  element_to_edit.html('<div style="min-height:100px;padding-top:120px;padding:40px;font-size:1.15em;line-height:1.2em;"><pre><code></code>'+JSON.stringify(app.options, null, 4)+'</pre></div>');
  //element_to_edit.html('<div style="min-height:100px;padding-top:120px;padding:40px;font-size:1.15em;line-height:1.2em;"><pre><code></code>'+JSON.stringify(app.options, null, 4)+'</pre></div><p></p>'+JSON.stringify(app.blockchain.index, null, 4)+'</pre></div>');

}




