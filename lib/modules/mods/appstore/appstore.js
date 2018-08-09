//
// This module monitors the blockchain and our
// unspent transaction inputs. It creates fake
// transactions to speed up block production 
// for testing purposes.`
//
var saito = require('../../../saito');
var ModTemplate = require('../../template');
var util = require('util');
var crypto = require('crypto');
var fs          = require('fs');
var shell  = require("shelljs");



//////////////////
// CONSTRUCTOR  //
//////////////////
function AppStore(app) {

  if (!(this instanceof AppStore)) { return new AppStore(app); }

  AppStore.super_.call(this);

  this.app                  = app;
  this.name                 = "AppStore";
  this.handlesEmail         = 1;
  this.emailAppName         = "AppStore (publish)";
  this.db		    = null;
  this.currently_generating = 0;
  this.unique_no = 0;
  return this;

}
module.exports = AppStore;
util.inherits(AppStore, ModTemplate);




////////////////////
// Install Module //
////////////////////
AppStore.prototype.installModule = function installModule(app) {

  if (app.BROWSER == 1) { return; }

  var appstore_self = this;

  var sqlite3 = require('sqlite3').verbose();
  this.db = new sqlite3.Database('./data/appstore.sq3');

  var sql = 'CREATE TABLE IF NOT EXISTS mod_appstore_apps (\
                id INTEGER, \
                app_id TEXT, \
                publisher TEXT, \
                title TEXT, \
                description TEXT, \
                version TEXT, \
                tx TEXT, \
                core_app INTEGER DEFAULT 0, \
                UNIQUE (id), \
                PRIMARY KEY(id ASC) \
  )';
  appstore_self.db.run(sql, {}, function() {});

}


AppStore.prototype.initialize = function initialize(app) {

  if (app.BROWSER == 1) { return; }

  if (this.db == null) {
    var sqlite3 = require('sqlite3').verbose();
    this.db = new sqlite3.Database('./data/appstore.sq3');
  }

}




/////////////////////////
// Handle Web Requests //
/////////////////////////
AppStore.prototype.webServer = function webServer(app, expressapp) {

  var appstore_self = this;

  if (app.BROWSER == 1) { return; } 

  expressapp.get('/appstore', function (req, res) {

    var psql = "SELECT * FROM mod_appstore_apps WHERE core_app = 1";
    var pparams = { $publickey : req.params.publickey };
    appstore_self.db.all(psql, pparams, function(err, rows) {
      if (err != null) {
	console.log(err);
	return;
      }
      res.write(appstore_self.returnIndexPageHead());
      if (rows.length == 0) {
        res.write('<tr><td>There are no modules installed in this App Store</td></tr>');
      }
      for (let i = 0; i < rows.length; i++) {
       res.write(appstore_self.returnIndexPageRow(rows[i]));
      }
      res.write(appstore_self.returnIndexPageTail());
      res.end();
      return;
    });
  });
  expressapp.get('/appstore/search/:term', function (req, res) {
    var searchterm = req.params.term;
    var searchresults = {};
    var modules = [];
    var sql = "SELECT id, app_id, publisher, description, version, title FROM mod_appstore_apps WHERE (title LIKE $searchterm1 OR description LIKE $searchterm2 OR app_id = $searchterm3) AND core_app = 0";
    var params = {
      $searchterm1 : "%" + searchterm + "%",
      $searchterm2 : "%" + searchterm + "%",
      $searchterm3 : searchterm
    }
    appstore_self.db.all(sql, params, function(err, rows) {
console.log(rows + " ----> " + rows.length);
      for (let i = 0; i < rows.length; i++) {
console.log("assigning values");
        modules[i] = rows[i];
      }
      searchresults.modules = modules;
      res.write(JSON.stringify(searchresults));
      res.end();
      return;
    });
  });
  expressapp.get('/appstore/cache/:ffolder/:ffile', function (req, res) {
    var ffolder = ""; ffolder += req.params.ffolder;
    var ffile   = ""; ffile += req.params.ffile;
    if (ffolder.indexOf("\/") != -1) { return; }
    if (ffile.indexOf("\/")   != -1) { return; }
    res.sendFile(__dirname + '/web/cache/' + ffolder + '/' + ffile);
    return;
  });
  expressapp.get('/appstore/style.css', function (req, res) {
    res.sendFile(__dirname + '/web/style.css');
    return;
  });
  expressapp.get('/appstore/script.js', function (req, res) {
    res.sendFile(__dirname + '/web/script.js');
    return;
  });
  expressapp.get('/appstore/status', function (req, res) {
    var results = {};
    var packagename = req.param.package;
    if (appstore_self.currently_generating == 1 && appstore_self.unique_no == packagename) {
      results.status           = 0;
    } else {
      results.status           = 1;
    }
    res.write(JSON.stringify(results));
    res.end();
    return;
  });
  expressapp.post('/appstore/generateExtension', function (req, res) {

    if (appstore_self.currently_generating == 1) {
      res.write("Currently Generating -- please try again later (or help us make this plugin multi-user");
      res.end();
      return;
    }

    appstore_self.currently_generating = 1;

    let modules_to_use = [];

    for (var p in req.body) {
      if(req.body.hasOwnProperty(p) ) {
        modules_to_use.push(req.body[p]);
      }
    }

    if (modules_to_use.length == 0) {
      res.setHeader('Content-type', 'text/html');
      res.charset = 'UTF-8';
      res.write("No Modules Provided");
      res.end();
      return;
    }

    appstore_self.unique_no  = Math.random().toString().substring(2, 15);
    let unique_dir = __dirname + "/saitolib/" + appstore_self.unique_no;


    // feed out our temporary page
    res.setHeader('Content-type', 'text/html');
    res.charset = 'UTF-8';
    res.write(appstore_self.returnSuccessPage());
    res.end();


    try {
      fs.mkdirSync(unique_dir);
    } catch (err) {
      if (err.code !== 'EEXIST') {
        appstore_self.currently_generating = 0;
	return;
      }
    }

    // create sql
    let msql = "SELECT * FROM mod_appstore_apps WHERE app_id IN (";
    let mparams = {};
    for (let m = 0; m < modules_to_use.length; m++) {
      if (m > 0) { msql += ", "; }
      let name = "$m"+m;
      msql += name;
      mparams[name] = modules_to_use[m];
    }
    msql += ")";

console.log(msql);
console.log(mparams);

    appstore_self.db.all(msql, mparams, function(err, rows) {
      if (err) {
        appstore_self.currently_generating = 0;
        return;
      };
      appstore_self.handleZipFiles(rows, 0, appstore_self.finishCompiling);
    });
  });
}





//
// 
//
AppStore.prototype.finishCompiling = function finishCompiling() {

  var appstore_self = this;

  let oldmods   = __dirname + "/saitolib/modules/mods/";
  let newmods   = __dirname + "/saitolib/" + appstore_self.unique_no + "/*";

  let delete_cmd = "rm -rf " + oldmods + "*";;
  let move_cmd   = "mv -f " + newmods + " " + oldmods;

  if (shell.exec(delete_cmd).code !== 0) {
    shell.echo('Error: could not delete old mods');
    appstore_self.currently_generating = 0;
    shell.exit(1);
    return;
  } else {
    if (shell.exec(move_cmd).code !== 0) {
      appstore_self.currently_generating = 0;
      shell.echo('Error: could not move new mods');
      shell.exit(1);
      return;
    } else {

      // our scripts are now in the proper saitolib directory
      appstore_self.startModJS();

    }
  }
}



AppStore.prototype.startModJS = function startModJS() {

  var appstore_self = this;

  let modjscmd = "cp -f " + __dirname + "/mods.head " + __dirname + "/saitolib/modules/mods.js";

  if (shell.exec(modjscmd).code !== 0) {
    appstore_self.currently_generating = 0;
    shell.echo('Error: could not copy mods.head');
    shell.exit(1);
    return;
  } else {
    let modsdir = __dirname + "/saitolib/modules/mods/";
    var mods_installed = appstore_self.getDirectories(modsdir);
    appstore_self.appendModJS(mods_installed, 0);
  }
}
AppStore.prototype.appendModJS = function appendModJS(mods_installed, mods_index) {

  var appstore_self = this;

  if (mods_index >= mods_installed.length) {
    appstore_self.finishModJS();
  } else {

    let append_this = "this.mods.push(require('./mods/"+mods_installed[mods_index]+"/"+mods_installed[mods_index]+"')(this.app));\n";
    let modsjsf     = __dirname + "/saitolib/modules/mods.js";

    fs.appendFile(modsjsf, append_this, function (err) {
      if (err) {
        appstore_self.currently_generating = 0;
        console.log("Error: cannot append to the mods.js file");
	return;
      } else {
	appstore_self.appendModJS(mods_installed, mods_index+1);
      }
    })
  }
}
AppStore.prototype.finishModJS = function finishModJS() {

  var appstore_self = this;

  let modjscmd = "cat " + __dirname + "/mods.tail >> " + __dirname + "/saitolib/modules/mods.js";

  if (shell.exec(modjscmd).code !== 0) {
    appstore_self.currently_generating = 0;
    shell.echo('Error: could not finish copying mods.tail');
    shell.exit(1);
    return;
  } else {

    // the file is complete, so lets tell our computer to compile the browser.js
    appstore_self.compileBrowserJS();   

  }
}
AppStore.prototype.compileBrowserJS = function finishBrowserJS() {

  var appstore_self = this;

  let createcmp = "echo \"cd "+__dirname+"/saitolib/ \n\n\" >> " + __dirname + "/saitolib/compile2";

  if (shell.exec(createcmp).code !== 0) {
    appstore_self.currently_generating = 0;
    shell.echo('Error: could not create compile2');
    shell.exit(1);
    return;
  } else {

    let createcmp2 = "cat " + __dirname + "/saitolib/compile | sed 's/node_modules/\.\.\\\/\.\.\\\/\.\.\\\/\.\.\\\/node_modules/g' >> " + __dirname + "/saitolib/compile2";
    console.log(createcmp2);
    if (shell.exec(createcmp2).code !== 0) {
      appstore_self.currently_generating = 0;
      shell.echo('Error: could not append content to compile2');
      shell.exit(1);
      return;
    } else {

      let createcmp3 = "chmod +x " + __dirname + "/saitolib/compile2";
      if (shell.exec(createcmp3).code !== 0) {
        appstore_self.currently_generating = 0;
        shell.echo('Error: could not prepare compile2 for execution');
        shell.exit(1);
        return;
      } else {

        let createcmp4 = __dirname + "/saitolib/compile2";
        if (shell.exec(createcmp4).code !== 0) {
          appstore_self.currently_generating = 0;
          shell.echo('Error: could not execute compile2');
          shell.exit(1);
	  return;
        } else {
	  // we should be done          
          appstore_self.finishCompilationProcess();
        }
      }
    }
  }
}


AppStore.prototype.finishCompilationProcess = function finishCompilationProcess() {

  var appstore_self = this;

  // make the unique directory for the cached js
  let mkdircmd = "mkdir -p " + __dirname + "/web/cache/" + appstore_self.unique_no;
  if (shell.exec(mkdircmd).code !== 0) {
    appstore_self.currently_generating = 0;
    shell.echo('Error: could not create cache subdirectory');
    shell.exit(1);
    return;
  } else {

    // and copy it into our chrome extension
    let createcmp5 = "cp -f " + __dirname + "/saitolib/saito/web/browser.js " + __dirname + "/web/cache/"+appstore_self.unique_no+"/browser.js";
    if (shell.exec(createcmp5).code !== 0) {
      appstore_self.currently_generating = 0;
      shell.echo('Error: could not copy into chrome directory');
      shell.exit(1);
      return;
    } else {

      let createcmp6 = "cp -f " + __dirname + "/saitolib/saito/web/browser.js " + __dirname + "/../../../../extras/chrome/browser.js";
      if (shell.exec(createcmp6).code !== 0) {
        appstore_self.currently_generating = 0;
        shell.echo('Error: could not copy into chrome directory');
        shell.exit(1);
        return;
      } else {

        let createcmp7 = "rm -rf " + __dirname + "/../../../../extras/chrome/modules/mods/*";
console.log(createcmp7);
        if (shell.exec(createcmp7).code !== 0) {
          appstore_self.currently_generating = 0;
          shell.echo('Error: could not delete existing mods');
          shell.exit(1);
          return;
        } else {

          let createcmp8 = "cp -rf " + __dirname + "/saitolib/modules/mods/* " + __dirname + "/../../../../extras/chrome/modules/mods/";
console.log(createcmp8);
          if (shell.exec(createcmp8).code !== 0) {
            appstore_self.currently_generating = 0;
            shell.echo('Error: could not copy mods into into chrome directory');
            shell.exit(1);
            return;
          } else {

            let createcmp9 = "chmod +x " + __dirname + "/../../../../extras/chrome/install_modules";
console.log(createcmp9);
            if (shell.exec(createcmp9).code !== 0) {
              appstore_self.currently_generating = 0;
              shell.echo('Error: made install_modules script executable');
              shell.exit(1);
              return;
            } else {

              let createcmp10 = "bash " + __dirname + "/../../../../extras/chrome/install_modules '"+__dirname +"/../../../../extras/chrome'";
              if (shell.exec(createcmp10).code !== 0) {
                appstore_self.currently_generating = 0;
                shell.echo('Error: could not run install_modules script in chrome dir');
                shell.exit(1);
                return;
              } else {

                let chromecmd = __dirname + "/../../../../node_modules/.bin/crx pack "+__dirname+"/../../../../extras/chrome -o "+__dirname+"/web/cache/"+appstore_self.unique_no+"/chrome.crx -p "+__dirname+"/../../../../extras/chrome/key.pem";
console.log(chromecmd);
                if (shell.exec(chromecmd).code !== 0) {
console.log("FAILED TO GENERATE CHROME PLUGIN");
                  appstore_self.currently_generating = 0;
                  shell.echo('Error: could not generate chrome plugin');
                  shell.exit(1);
                  return;
                } else {
console.log("GENERATED CHROME PLUGIN");

	          // and copy it into our chrome extension
    		  let copyemaildir = "cp -f " + __dirname + "/saitolib/modules/mods/email/web/* " + __dirname + "/web/cache/"+appstore_self.unique_no+"/";
    		  if (shell.exec(copyemaildir).code !== 0) {
     		    appstore_self.currently_generating = 0;
      		    shell.echo('Error: could not copy email dir into directory');
      		    shell.exit(1);
      		    return;
		  } else {

	            // and copy it into our chrome extension
    		    let copyemaildir2 = "cp -f " + __dirname + "/email.html " + __dirname + "/web/cache/"+appstore_self.unique_no+"/index.html";
    		    if (shell.exec(copyemaildir2).code !== 0) {
     		      appstore_self.currently_generating = 0;
      		      shell.echo('Error: could not copy email dir into directory');
      		      shell.exit(1);
      		      return;
		    } else {
                      appstore_self.currently_generating = 0;
		    }
		  }
                }
              }
            }
          }
        }
      }
    }
  }
  return;

}




// 
//
// 
AppStore.prototype.handleZipFiles = function handleZipFiles(rows, index_in_array) {

  var appstore_self = this;

  let unique_dir = __dirname + "/saitolib/" + appstore_self.unique_no;

  if (rows.length <= index_in_array) {
    appstore_self.finishCompiling();
  } else {
    let row       = rows[index_in_array];

    let tmptx     = row.tx;
    let tx        = new saito.transaction(tmptx);
    let txmsg     = tx.returnMessage();
    let txzipfile = null;
    let txzipsize = null;
    let txzipdata = null;

    if (txmsg.attachments != "") {

      if (txmsg.attachments == "unset" || txmsg.attachments == null) { return; }

      let txa = JSON.parse(txmsg.attachments);
      txzipfile = txa[0].filename;
      txzipsize = txa[0].size;
      txzipdata = txa[0].data;

console.log("unzipping: " + txzipfile);

      txzipdata = txzipdata.replace(/^data:application\/zip;base64,/, "");

      let zipdir   = __dirname + "/saitolib/" + appstore_self.unique_no + "/";
      let zipfiles = __dirname + "/saitolib/" + appstore_self.unique_no + "/*.zip";
      let unique_zip_no  = Math.random().toString().substring(2, 15);
      let zipfile  = __dirname + "/saitolib/" + appstore_self.unique_no + "/" + unique_zip_no + ".zip";
      zipfile_contents = fs.writeFileSync(zipfile, txzipdata, 'base64');

      let unzip_cmd = "unzip -d " + zipdir + " " + zipfiles;
      let delete_cmd = "rm -f " + zipfiles;

      if (shell.exec(unzip_cmd).code !== 0) {
        appstore_self.currently_generating = 0;
        shell.echo('Error: could not unzip files');
        shell.exit(1);
        return;
      } else {
        if (shell.exec(delete_cmd).code !== 0) {
          appstore_self.currently_generating = 0;
          shell.echo('Error: could not unzip files');
          shell.exit(1);
          return;
        } else {
          appstore_self.handleZipFiles(rows, index_in_array+1);
        }
      }
    }
  }
}







/////////////////////
// Email Functions //
/////////////////////
AppStore.prototype.displayEmailForm = function displayEmailForm(app) {

  var appstore_self = this;

  $('.lightbox_compose_address_area').hide();

  element_to_edit = $('#module_editable_space');

  element_to_edit_html =  'TITLE: <br /><input type="text" class="app_title email_title" style="width:300px" id="app_title" value="" />';
  element_to_edit_html += '<p></p>';
  element_to_edit_html += 'APP ID: <br /><input type="text" class="app_id email_title" style="width:300px" id="app_id" value="" />';
  element_to_edit_html += '<p></p>';
  element_to_edit_html += 'VERSION: <br /><input type="text" class="app_version email_title" style="width:300px" id="app_version" value="" />';
  element_to_edit_html += '<p></p>';
  element_to_edit_html += 'DESCRIPTION: <br /><textarea class="app_description email_description" style="width:300px; height:150px" id="app_description" name="app_description"></textarea>';
  element_to_edit_html += '<p></p>';
  element_to_edit_html += '<input type="hidden" name="app_attachments" id="app_attachments">';
  element_to_edit_html += '<div id="app-file-wrap">';
  element_to_edit_html += '<div id="app-file-upload-shim" class="app-addfile">Attach Application</div></div>';
  //element_to_edit_html += '<style type="text/css"> .app-addfile { clear: both;  max-width: 140px;   color: #ffffff;   background-color: #d14836; text-align: center;  line-height: 29px;  font-weight: bold;  background-image: linear-gradient(to bottom, #dd4b39, #d14836); border: 1px solid #b0281a; cursor: pointer; } .add-addfile:hover {  background-image: linear-gradient(to bottom, #dd4b39, #c53727);  border: 1px solid #b0281a; } #app-file-wrap {  position: relative;  overflow: hidden;   display: inline-block;  min-width: 150px;  margin-top: 5px;  height: 30px;}</style>';


  $('#lightbox_compose_payment').val(0);
  $('#lightbox_compose_fee').val(app.wallet.returnDefaultFee());
  $('#lightbox_compose_to_address').val(app.wallet.returnPublicKey());


  element_to_edit.html(element_to_edit_html);
  $('#app_attachments').val("unset");
  $('.app_id').val(appstore_self.app.crypt.hash(Math.random().toString().substring(2, 15)));

  var files = {};
  var filecount = 0;
  var pfile = document.createElement('input');
  pfile.type = 'file';
  pfile.setAttribute('id', 'app_attachment');
  pfile.setAttribute('name', 'app_attachment');
  $('#app-file-wrap').append(pfile);

  $('#app_attachment').on('change', function() {
    var file_details = {};
    var upload = this.files[0];
    var file_name = document.createElement('div');
    file_name.setAttribute('class', 'file-upload');
    file_name.setAttribute('accessKey', filecount);
    $('.fancybox-inner').height($('.fancybox-inner').height() + 30);
    file_name.innerHTML = upload.name;
    file_name.addEventListener('click', function() {
      this.remove(this);
      delete files[this.accessKey];
      $('.fancybox-inner').height($('.fancybox-inner').height() - 30);
      $('#app_attachments').val(JSON.stringify(files));
    });
    element_to_edit.append(file_name);
    file_details.name = upload.name;
    file_details.size = upload.size;
    var code = "no content"
    var p = new Promise(function(resolve) {
      var reader = new FileReader();
      reader.onload = function() {
        code = reader.result;
        resolve(file_details.data = code);
        files[filecount] = file_details;
        $('#app_attachments').val(JSON.stringify(files));
        filecount += 1;
      };
      reader.readAsDataURL(upload);
    });
    this.value = "";
  });


}
AppStore.prototype.formatEmailTransaction = function formatEmailTransaction(tx, app) {

  // always set the message.module to the name of the app
  tx.transaction.msg.module                = this.name;
  tx.transaction.msg.request               = "upload module";
  tx.transaction.msg.title                 = $('#app_title').val();
  tx.transaction.msg.description           = $('#app_description').val();
  tx.transaction.msg.version               = $('#app_version').val();
  tx.transaction.msg.app_id                = $('#app_id').val();
  tx.transaction.msg.attachments           = $('#app_attachments').val();

  return tx;

}





//////////////////
// Confirmation //
//////////////////
AppStore.prototype.onConfirmation = function onConfirmation(blk, tx, conf, app) {

  var appstore_self = app.modules.returnModule("AppStore");

  if (app.BROWSER == 1) {
    if (conf == 0) {
      if (tx.transaction.from[0].add == app.wallet.returnPublicKey()) {
        if (app.modules.returnModule("Email") != null) {
          var newtx = app.wallet.createUnsignedTransaction(app.wallet.returnPublicKey(), 0.0, 0.0);
          if (newtx == null) { return; }
          newtx.transaction.msg.module  = "Email";
          newtx.transaction.msg.title   = tx.transaction.msg.title + " Application Submitted";
          newtx.transaction.msg.data    = "You have submitted an application into the Saito Application Network.\n\nTITLE: "+tx.transaction.msg.title+"\n\nDESCRIPTION: "+tx.transaction.msg.description+"\n\nVERSION: "+tx.transaction.msg.version+"\n\nAPP ID: "+tx.transaction.msg.app_id+"\n\nIf you ever need to update this application, be sure to publish it from this same address and use the exact same Application Id.";
          newtx = app.wallet.signTransaction(newtx);
          app.archives.saveTransaction(newtx);
          if (app.modules.returnModule("Email") != null) {
            app.modules.returnModule("Email").addMessageToInbox(newtx, app);
          }
        }
      }
    }
    return;
  }


  // servers 
  if (conf == 0) {

    var myappstore = app.modules.returnModule("AppStore");
    var txmsg = tx.returnMessage();

    // app submission
    if (txmsg.request == "upload module") {

      var publisher   = tx.transaction.from[0].add;
      var title       = txmsg.title;
      var description = txmsg.description;
      var version     = txmsg.version;
      var app_id      = txmsg.app_id;

      var sql    = "INSERT INTO mod_appstore_apps (app_id, publisher, title, description, version, tx) VALUES ($app_id, $publisher, $title, $description, $version, $tx)";
      var params = {
        $app_id      : app_id,
        $publisher   : publisher,
        $title       : title,
	$description : description,
	$version     : version,
        $tx          : JSON.stringify(tx.transaction)
      }
      appstore_self.db.run(sql, params, function(err) {});
    }
  }
}



AppStore.prototype.returnIndexPageHead = function returnIndexPageHead() {

  var html = '<html> \
  <head> \
    <meta charset="utf-8"> \
    <meta http-equiv="X-UA-Compatible" content="IE=edge"> \
    <meta name="viewport" content="width=device-width, initial-scale=1"> \
    <title>Saito AppStore:</title> \
    <script type="text/javascript" src="/jquery/jquery-3.2.1.min.js"></script> \
    <link rel="stylesheet" type="text/css" href="/appstore/style.css" /> \
  </head> \
  <body> \
    <div id="AppStore_browser_active"></div> \
    <div class="header"> \
      <a href="/" style="text-decoration:none;color:inherits"> \
        <img src="/img/saito_logo_black.png" class="logo" /> \
        <div class="logo_text">saito appstore</div> \
      </a> \
    </div> \
    <div class="main" class="main"> \
      <div id="left"> \
         <form method="post" action="/appstore/generateExtension"> \
           <input style="float:left" type="submit" class="generate_extension_button" value="Generate Extension" /> \
           <div id="core_modules_box"> \
             <h2>Core Modules</h2> \
             <div class="core_instructions">Select your basic modules from our list of core modules and click "Generate Extension" below to compile your custom extension.</div> \
             <table id="core_modules"> \
  ';

  return html;

}
AppStore.prototype.returnIndexPageRow = function returnIndexPageRow(row) {

  return ' \
              <tr id="core_app_'+row.app_id+'" class="module_row"> \
                <td class="module_checkbox"><input type="checkbox" name="app_'+row.id+'" value="'+row.app_id+'" checked /></td> \
                <td><div class="module_info"> \
                  <div class="module_info_title">'+row.title+'</div> \
                  <div class="module_info_version">(v. '+row.version+')</div> \
                  <div class="module_info_description">'+row.description+'</div> \
                </td> \
              </tr>';

}
AppStore.prototype.returnIndexPageTail = function returnIndexPageTail() {

  return ' \
           </table> \
         </div> \
       </form> \
     </div> \
     <div id="right"> \
       <h2>Optional Modules</h2> \
       <input type="text" name="search" id="search" class="modsearch" /> \
       <input type="button" name="search_button" id="search_button" class="modsearch_button" value="search" /> \
       <div class="optional_instructions">Search our repository of user-published modules. Click on a module to add it to your list of core modules.</div> \
       <table id="optional_modules"> \
       </table> \
     </div> \
  </div> \
  <script src="/appstore/script.js"></script> \
  </body> \
  </html> \
';

}

AppStore.prototype.returnSuccessPage = function returnSuccessPage() {

  var appstore_self = this;

  var html = ' \
<html> \
<head> \
  <meta charset="utf-8"> \
  <meta http-equiv="X-UA-Compatible" content="IE=edge"> \
  <title>Saito AppStore: Generating Custom Install</title> \
  <script type="text/javascript" src="/jquery/jquery-3.2.1.min.js"></script> \
  <link rel="stylesheet" href="/jquery/jquery-ui.min.css" type="text/css" media="screen" /> \
  <link rel="stylesheet" type="text/css" href="/appstore/style.css" /> \
</head> \
<body> \
 \
  <div id="AppStore_browser_active"></div> \
  <div class="header"> \
    <a href="/" style="text-decoration:none;color:inherits"> \
      <img src="/img/saito_logo_black.png" style="width:35px;margin-top:5px;margin-left:25px;margin-right:10px;float:left;" /> \
      <div style="font-family:Georgia;padding-top:5px;font-size:1.2em;color:#444;">saito appstore</div> \
    </a> \
  </div> \
 \
  <div class="loader" style="loader"> \
    We are generating your custom Saito client.... \
    <p></p> \
    Please be patient, this can take up to around 20 seconds.... \
  </div> \
 \
  <div class="main" style="display:none"> \
    We have generated a custom Saito javascript file and chrome extension. Download below: \
    <p></p> \
    <a href="/appstore/cache/'+appstore_self.unique_no+'/index.html" id="link_browserjs">try live in browser</a> \
    <br /> \
    <a href="/appstore/cache/'+appstore_self.unique_no+'/chrome.crx" id="link_chrome">download chrome extension</a> \
    <br /> \
    <a href="/appstore/cache/'+appstore_self.unique_no+'/browser.js" id="link_browserjs">download custom javascript (developers)</a> \
    <p></p> \
    To install your chrome extension, open Chrome, visit the URL "chrome://extensions" and drag-and-drop the downloaded .crx file into your browser. \
    </div> \
  </div> \
 \
  <script type="text/javascript"> \
    var timer = setInterval(function() { \
      var x = $.getJSON("/appstore/status", { package : "'+appstore_self.unique_no+'" }, function(data) { \
        if (data.status == 1) { \
          $(\'.loader\').hide(); \
          $(\'.main\').show(); \
        } \
        console.log("FETCHED DATA: "+JSON.stringify(data)); \
        console.log("FETCHED DATA2: "+data); \
      }); \
    }, 2000); \
  </script> \
 \
</body> \
</html>';

  return html;
}




AppStore.prototype.getDirectories = function getDirectories(path) {
  return fs.readdirSync(path).filter(function (file) {
    return fs.statSync(path+'/'+file).isDirectory();
  });
}


