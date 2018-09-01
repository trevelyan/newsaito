var saito = require('./../../../saito');
var ModTemplate = require('../../template');
var util = require('util');
var fs = require('fs');
var shell = require('shelljs');


//////////////////
// CONSTRUCTOR  //
//////////////////
function Remix(app) {

  if (!(this instanceof Remix)) { return new Remix(app); }

  Remix.super_.call(this);

  this.app             = app;

  this.name            = "Remix";
  this.browser_active  = 0;
  this.handlesEmail    = 0;

  this.remix_module_name = "RemixApp";
  this.module_name     = "";

  return this;

}
module.exports = Remix;
util.inherits(Remix, ModTemplate);








/////////////////////////
// Handle Web Requests //
/////////////////////////
Remix.prototype.webServer = function webServer(app, expressapp) {

  var remix_self = this;

  expressapp.get('/remix/', function (req, res) {
    if (req.query.saito_address == null) {
      res.sendFile(__dirname + '/web/index.html');
      return;
    }
  });
  expressapp.get('/remix/template.js', function (req, res) {
    res.sendFile(__dirname + '/template.js');
    return;
  });
  expressapp.get('/remix/template_email.js', function (req, res) {
    res.sendFile(__dirname + '/template_email.js');
    return;
  });
  expressapp.get('/remix/template_webapp.js', function (req, res) {
    res.sendFile(__dirname + '/template_webapp.js');
    return;
  });
  expressapp.get('/remix/template.html', function (req, res) {
    res.sendFile(__dirname + '/template.html');
    return;
  });
  expressapp.get('/remix/cache/:cacheddir/:cachefile', function (req, res) {
    var cachedfile = '/web/cache/'+req.params.cacheddir+'/'+req.params.cachefile;
    if (cachedfile.indexOf("\/") != false) { return; }
    res.sendFile(__dirname + cachedfile);
    return;
  });

  expressapp.get('/remix/submitToAppStore/:unique_no/:mname', function (req, res) {
    if (req.params.unique_no == null) { return; }
    if (req.params.mname == null) { return; }
    var unique_no = req.params.unique_no;
    var mname     = req.params.mname;

    //
    // TODO
    // 
    // make more restrictive - only numbers and letters
    //
    //
    mname.replace(/[^\x00-\x7F]/g, "");
    mname = mname.toLowerCase();

    var appstore = remix_self.app.modules.returnModule("AppStore");
    if (appstore == null) { console.log("AppStore not installed...."); return; }

    var zipfile = __dirname + "/web/cache/" + unique_no + "/" + mname + ".zip";
    var data = fs.readFileSync(zipfile, 'base64', (err, data) => {
      if (err) {
        console.log("Error Reading Options File");
        process.exit();
      }
    })

    var file_details = {};
    file_details.name = "tempname";
    file_details.size = "1";
    file_details.data = data;
    var files = [];
    files[0] = file_details;

    var tx = remix_self.app.wallet.createUnsignedTransaction(remix_self.app.wallet.returnPublicKey(), 0.0, 0.0);
    tx.transaction.msg.module                = "AppStore";
    tx.transaction.msg.request               = "upload module";
    tx.transaction.msg.title                 = mname;
    tx.transaction.msg.description           = mname;
    tx.transaction.msg.version               = "1.0.0";
    tx.transaction.msg.app_id                = remix_self.app.crypto.hash(Math.random().toString().substring(2, 15));
    tx.transaction.msg.attachments           = JSON.stringify(files);;
    tx = remix_self.app.wallet.signTransaction(tx);

    // submit to app store
    appstore.onConfirmation(null, tx, 0, remix_self.app);

    res.setHeader('Content-type', 'text/html');
    res.charset = 'UTF-8';
    res.write('Your module has been uploaded to <a href="/appstore">our locally-hosted AppStore</a>. It is listed under '+mname+'.');
    res.end();

  });
  expressapp.get('/remix/style.css', function (req, res) {
    res.sendFile(__dirname + '/web/style.css');
    return;
  });
  expressapp.post('/remix/submit', function (req, res) {

    var unique_no  = Math.random().toString().substring(2, 15);

    var cachedir = __dirname + '/web/cache/'+unique_no;

    var mname = req.body.remix_module_name; 
    var code  = req.body.code;
    var html  = req.body.html;
    var js    = "";
    var css   = "";

    //
    // TODO
    // 
    // make more restrictive - only numbers and letters
    //
    mname.replace(/[^\x00-\x7F]/g, "");
    mname = mname.toLowerCase();
    if (mname.indexOf("\/") > 0 || mname.indexOf(" ") > 0) { 
      res.write("cannot create module");
      res.end();
      return;
    }

    var codefilename = cachedir + "/" + mname + "/" + mname + ".js";
    var htmlfilename = cachedir + "/" + mname + "/web/index.html";
    var jsfilename   = cachedir + "/" + mname + "/web/script.js";
    var cssfilename  = cachedir + "/" + mname + "/web/style.css";

    var parent_dir   = cachedir + "/" + mname;
    var web_dir      = parent_dir + "/web/";

    if (!fs.existsSync(cachedir)){ fs.mkdirSync(cachedir); }
    if (!fs.existsSync(parent_dir)){ fs.mkdirSync(parent_dir); }
    if (!fs.existsSync(web_dir)){ fs.mkdirSync(web_dir); }

    fs.writeFileSync(codefilename, code, 'binary');
    fs.writeFileSync(htmlfilename, html, 'binary');
    fs.writeFileSync(jsfilename, js, 'binary');
    fs.writeFileSync(cssfilename, css, 'binary');

    // create zip file
    var zipcmd = "bash " + __dirname + "/create_zipfile '" + cachedir + "' '" + mname + "'";
console.log(zipcmd);
    if (shell.exec(zipcmd).code !== 0) {
      shell.echo('Error: made install_modules script executable');
      shell.exit(1);
      return;
    } else {
      res.setHeader('Content-type', 'text/html');
      res.charset = 'UTF-8';
      res.write('Your module has been created. <a href="/remix/cache/'+unique_no+'/'+mname+'.zip">Download it</a> or <a href="/remix/submitToAppStore/'+unique_no+'/'+mname+'">submit it to our local AppStore</a>.'); 
      res.end();
      return;
    }
  });
}





/////////////
// On Load //
/////////////
Remix.prototype.initializeHTML = function initializeHTML(app) {}


///////////////////
// Attach Events //
///////////////////
Remix.prototype.attachEvents = function attachEvents(app) {

  var remix_self = this;

  if (app.BROWSER == 0) { return; }

  $('#js_menu').off();
  $('#js_menu').on('click', function() {
    $('#html').hide();
    $('#code').show();
    $('#code').focus();
  });

  $('#html_menu').off();
  $('#html_menu').on('click', function() {
    $('#code').hide();
    $('#html').show();
    $('#html').focus();
  });


  $('#new_module_button').off();
  $('#new_module_button').on('click', function() {

    remix_self.module_name = "";
    while (remix_self.module_name == "") {
      remix_self.module_name = prompt("Please name this module:", "NewModule");
    }
    $('#remix_module_name').val(remix_self.module_name);

    // load templates
    $.get( "/remix/template.js", function( data ) {
      remix_self.module_name = remix_self.module_name.replace(/\W/g, '');
      data = data.replace(/RemixApp/g, remix_self.module_name);
      $("#code").val(data);
      $("#code").focus();
    });
    $.get( "/remix/template.html", function( data ) {
      remix_self.module_name = remix_self.module_name.replace(/\W/g, '');
      data = data.replace(/RemixApp/g, remix_self.module_name);
      $("#html").val(data);
    });

    $('#new_module_button').hide();
    $('#ide_instructions').show();
    $('#editor').show();

  });

  

  $('#new_module_email_callbacks').off();
  $('#new_module_email_callbacks').on('click', function() {
    $.get( "/remix/template_email.js", function( data ) {
      data = data.replace(/RemixApp/g, remix_self.module_name);
      $("#code").val($("#code").val() + data);
      $("#code").focus();
      $('#new_module_email_callbacks').hide();

      $("#code").val( $("#code").val().replace("  return this;", "  this.handlesEmail = 1;\n  this.emailAppName = \"New Application\";\n  return this;"));

    });
  });



  $('#new_module_webapp_callbacks').off();
  $('#new_module_webapp_callbacks').on('click', function() {
    $.get( "/remix/template_webapp.js", function( data ) {
      data = data.replace(/RemixApp/g, remix_self.module_name);
      $("#code").val($("#code").val() + data);
      $("#code").focus();
      $('#new_module_webapp_callbacks').hide();
      $('#html_menu').show();
    });
  });

  $('#remix_submit').off();
  $('#remix_submit').on('click', function() {
    var user_code = $('.code').val();
  });

}









