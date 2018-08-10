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
  element_to_edit.html(
    `<div style="height:83vh;font-size:1.15em;line-height:1.2em;">
      <pre>
        <code>${JSON.stringify(app.options, null, 4)}</code>
        <p></p>
        <code>${JSON.stringify(app.archives.messages, null, 4)}</code>
      </pre>
    </div>`
  );
}











