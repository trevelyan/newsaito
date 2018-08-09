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



//////////////////
// CONSTRUCTOR  //
//////////////////
function Advert(app) {

  if (!(this instanceof Advert)) { return new Advert(app); }

  Advert.super_.call(this);

  this.app             = app;
  this.name            = "Advert";
  this.browser_active  = 1;		// enables initializeHTML function
  this.handlesEmail    = 1;
  this.emailAppName    = "Advertising";
  this.advert_img_dir  = __dirname + "/web/cache/";
  return this;

}
module.exports = Advert;
util.inherits(Advert, ModTemplate);







////////////////////
// Install Module //
////////////////////
//
// install our default advertisements
//
Advert.prototype.installModule = function installModule() {

  var advert_self = this;

  var sql = 'CREATE TABLE IF NOT EXISTS mod_advert_users (\
                id INTEGER, \
                publickey TEXT, \
                views INTEGER, \
                UNIQUE (publickey), \
                PRIMARY KEY(id ASC) \
  )';
  this.app.storage.execDatabase(sql, {}, function() {

    let sql3 = "INSERT INTO mod_advert_users (publickey, views) VALUES ($publickey, 0)";
    let params3 = { 
      $publickey : advert_self.app.wallet.returnPublicKey()
    };
    advert_self.app.storage.execDatabase(sql3, params3, function() {});

  });

  var sql2 = 'CREATE TABLE IF NOT EXISTS mod_advert_adverts (\
                id INTEGER, \
                publickey TEXT, \
                adfile TEXT, \
                views INTEGER, \
                link TEXT, \
                width INTEGER, \
                height INTEGER, \
                PRIMARY KEY(id ASC) \
  )';
  this.app.storage.execDatabase(sql2, {}, function() {

    let sql4    = "";
    let params4 = {};

    sql4     = "INSERT INTO mod_advert_adverts (publickey, adfile, views, link, width, height) VALUES ($publickey, $adfile, 0, $link, 300, 250)";
    params4  = { 
      $publickey : advert_self.app.wallet.returnPublicKey(),
      $adfile    : "1.png",
      $link      : "/remix"
    };
    advert_self.app.storage.execDatabase(sql4, params4, function() {});
    
    sql4     = "INSERT INTO mod_advert_adverts (publickey, adfile, views, link, width, height) VALUES ($publickey, $adfile, 0, $link, 300, 250)";
    params4  = { 
      $publickey : advert_self.app.wallet.returnPublicKey(),
      $adfile    : "2.png",
      $link      : "/remix"
    };
    advert_self.app.storage.execDatabase(sql4, params4, function() {});
    
    sql4     = "INSERT INTO mod_advert_adverts (publickey, adfile, views, link, width, height) VALUES ($publickey, $adfile, 0, $link, 300, 250)";
    params4  = { 
      $publickey : advert_self.app.wallet.returnPublicKey(),
      $adfile    : "3.png",
      $link      : "http://org.saito.tech"
    };
    advert_self.app.storage.execDatabase(sql4, params4, function() {});
    
    sql4     = "INSERT INTO mod_advert_adverts (publickey, adfile, views, link, width, height) VALUES ($publickey, $adfile, 0, $link, 300, 250)";
    params4  = { 
      $publickey : advert_self.app.wallet.returnPublicKey(),
      $adfile    : "4.png",
      $link      : "/r"
    };
    advert_self.app.storage.execDatabase(sql4, params4, function() {});
    
    sql4     = "INSERT INTO mod_advert_adverts (publickey, adfile, views, link, width, height) VALUES ($publickey, $adfile, 0, $link, 300, 250)";
    params4  = { 
      $publickey : advert_self.app.wallet.returnPublicKey(),
      $adfile    : "5.png",
      $link      : "/faucet"
    };
    advert_self.app.storage.execDatabase(sql4, params4, function() {});
    
    sql4     = "INSERT INTO mod_advert_adverts (publickey, adfile, views, link, width, height) VALUES ($publickey, $adfile, 0, $link, 300, 250)";
    params4  = { 
      $publickey : advert_self.app.wallet.returnPublicKey(),
      $adfile    : "6.png",
      $link      : "/facebook"
    };
    advert_self.app.storage.execDatabase(sql4, params4, function() {});
    
    sql4     = "INSERT INTO mod_advert_adverts (publickey, adfile, views, link, width, height) VALUES ($publickey, $adfile, 0, $link, 300, 250)";
    params4  = { 
      $publickey : advert_self.app.wallet.returnPublicKey(),
      $adfile    : "7.png",
      $link      : "http://saito.tech"
    };
    advert_self.app.storage.execDatabase(sql4, params4, function() {});
    
    sql4     = "INSERT INTO mod_advert_adverts (publickey, adfile, views, link, width, height) VALUES ($publickey, $adfile, 0, $link, 300, 250)";
    params4  = { 
      $publickey : advert_self.app.wallet.returnPublicKey(),
      $adfile    : "8.png",
      $link      : "/email"
    };
    advert_self.app.storage.execDatabase(sql4, params4, function() {});
    
    sql4     = "INSERT INTO mod_advert_adverts (publickey, adfile, views, link, width, height) VALUES ($publickey, $adfile, 0, $link, 300, 250)";
    params4  = { 
      $publickey : advert_self.app.wallet.returnPublicKey(),
      $adfile    : "9.png",
      $link      : "/email"
    };
    advert_self.app.storage.execDatabase(sql4, params4, function() {});
    
    sql4     = "INSERT INTO mod_advert_adverts (publickey, adfile, views, link, width, height) VALUES ($publickey, $adfile, 0, $link, 300, 250)";
    params4  = { 
      $publickey : advert_self.app.wallet.returnPublicKey(),
      $adfile    : "10.png",
      $link      : "/email"
    };
    advert_self.app.storage.execDatabase(sql4, params4, function() {});
    
    sql4     = "INSERT INTO mod_advert_adverts (publickey, adfile, views, link, width, height) VALUES ($publickey, $adfile, 0, $link, 300, 250)";
    params4  = { 
      $publickey : advert_self.app.wallet.returnPublicKey(),
      $adfile    : "11.png",
      $link      : "/email"
    };
    advert_self.app.storage.execDatabase(sql4, params4, function() {});
    
    sql4     = "INSERT INTO mod_advert_adverts (publickey, adfile, views, link, width, height) VALUES ($publickey, $adfile, 0, $link, 300, 250)";
    params4  = { 
      $publickey : advert_self.app.wallet.returnPublicKey(),
      $adfile    : "12.png",
      $link      : "http://saito.tech"
    };
    advert_self.app.storage.execDatabase(sql4, params4, function() {});
    
    sql4     = "INSERT INTO mod_advert_adverts (publickey, adfile, views, link, width, height) VALUES ($publickey, $adfile, 0, $link, 300, 250)";
    params4  = { 
      $publickey : advert_self.app.wallet.returnPublicKey(),
      $adfile    : "13.png",
      $link      : "/email"
    };
    advert_self.app.storage.execDatabase(sql4, params4, function() {});
    
    sql4     = "INSERT INTO mod_advert_adverts (publickey, adfile, views, link, width, height) VALUES ($publickey, $adfile, 0, $link, 300, 250)";
    params4  = { 
      $publickey : advert_self.app.wallet.returnPublicKey(),
      $adfile    : "14.png",
      $link      : "/facebook"
    };
    advert_self.app.storage.execDatabase(sql4, params4, function() {});
    
    sql4     = "INSERT INTO mod_advert_adverts (publickey, adfile, views, link, width, height) VALUES ($publickey, $adfile, 0, $link, 300, 250)";
    params4  = { 
      $publickey : advert_self.app.wallet.returnPublicKey(),
      $adfile    : "15.png",
      $link      : "/facebook"
    };
    advert_self.app.storage.execDatabase(sql4, params4, function() {});
    
    sql4     = "INSERT INTO mod_advert_adverts (publickey, adfile, views, link, width, height) VALUES ($publickey, $adfile, 0, $link, 300, 250)";
    params4  = { 
      $publickey : advert_self.app.wallet.returnPublicKey(),
      $adfile    : "16.png",
      $link      : "/facebook"
    };
    advert_self.app.storage.execDatabase(sql4, params4, function() {});
    
    sql4     = "INSERT INTO mod_advert_adverts (publickey, adfile, views, link, width, height) VALUES ($publickey, $adfile, 0, $link, 300, 250)";
    params4  = { 
      $publickey : advert_self.app.wallet.returnPublicKey(),
      $adfile    : "17.png",
      $link      : "/facebook"
    };
    advert_self.app.storage.execDatabase(sql4, params4, function() {});
    
    sql4     = "INSERT INTO mod_advert_adverts (publickey, adfile, views, link, width, height) VALUES ($publickey, $adfile, 0, $link, 300, 250)";
    params4  = { 
      $publickey : advert_self.app.wallet.returnPublicKey(),
      $adfile    : "18.png",
      $link      : "/faucet"
    };
    advert_self.app.storage.execDatabase(sql4, params4, function() {});
    
    sql4     = "INSERT INTO mod_advert_adverts (publickey, adfile, views, link, width, height) VALUES ($publickey, $adfile, 0, $link, 300, 250)";
    params4  = { 
      $publickey : advert_self.app.wallet.returnPublicKey(),
      $adfile    : "19.png",
      $link      : "http://saito.tech/saito-whitepaper.pdf"
    };
    advert_self.app.storage.execDatabase(sql4, params4, function() {});
    
    sql4     = "INSERT INTO mod_advert_adverts (publickey, adfile, views, link, width, height) VALUES ($publickey, $adfile, 0, $link, 300, 250)";
    params4  = { 
      $publickey : advert_self.app.wallet.returnPublicKey(),
      $adfile    : "20.png",
      $link      : "/advert"
    };
    advert_self.app.storage.execDatabase(sql4, params4, function() {});
    
    sql4     = "INSERT INTO mod_advert_adverts (publickey, adfile, views, link, width, height) VALUES ($publickey, $adfile, 0, $link, 300, 250)";
    params4  = { 
      $publickey : advert_self.app.wallet.returnPublicKey(),
      $adfile    : "21.png",
      $link      : "/email"
    };
    advert_self.app.storage.execDatabase(sql4, params4, function() {});
    
    sql4     = "INSERT INTO mod_advert_adverts (publickey, adfile, views, link, width, height) VALUES ($publickey, $adfile, 0, $link, 300, 250)";
    params4  = { 
      $publickey : advert_self.app.wallet.returnPublicKey(),
      $adfile    : "22.png",
      $link      : "http://saito.tech/saito-whitepaper.pdf"
    };
    advert_self.app.storage.execDatabase(sql4, params4, function() {});
    
    sql4     = "INSERT INTO mod_advert_adverts (publickey, adfile, views, link, width, height) VALUES ($publickey, $adfile, 0, $link, 300, 250)";
    params4  = { 
      $publickey : advert_self.app.wallet.returnPublicKey(),
      $adfile    : "23.png",
      $link      : "/r"
    };
    advert_self.app.storage.execDatabase(sql4, params4, function() {});
    
    sql4     = "INSERT INTO mod_advert_adverts (publickey, adfile, views, link, width, height) VALUES ($publickey, $adfile, 0, $link, 300, 250)";
    params4  = { 
      $publickey : advert_self.app.wallet.returnPublicKey(),
      $adfile    : "24.png",
      $link      : "http://saito.tech"
    };
    advert_self.app.storage.execDatabase(sql4, params4, function() {});
    
    sql4     = "INSERT INTO mod_advert_adverts (publickey, adfile, views, link, width, height) VALUES ($publickey, $adfile, 0, $link, 300, 250)";
    params4  = { 
      $publickey : advert_self.app.wallet.returnPublicKey(),
      $adfile    : "25.png",
      $link      : "http://saito.tech/saito-whitepaper.pdf"
    };
    advert_self.app.storage.execDatabase(sql4, params4, function() {});
    
    sql4     = "INSERT INTO mod_advert_adverts (publickey, adfile, views, link, width, height) VALUES ($publickey, $adfile, 0, $link, 300, 250)";
    params4  = { 
      $publickey : advert_self.app.wallet.returnPublicKey(),
      $adfile    : "26.png",
      $link      : "/advert"
    };
    advert_self.app.storage.execDatabase(sql4, params4, function() {});
    
    sql4     = "INSERT INTO mod_advert_adverts (publickey, adfile, views, link, width, height) VALUES ($publickey, $adfile, 0, $link, 300, 250)";
    params4  = { 
      $publickey : advert_self.app.wallet.returnPublicKey(),
      $adfile    : "27.png",
      $link      : "http://org.saito.tech"
    };
    advert_self.app.storage.execDatabase(sql4, params4, function() {});
    
    sql4     = "INSERT INTO mod_advert_adverts (publickey, adfile, views, link, width, height) VALUES ($publickey, $adfile, 0, $link, 300, 250)";
    params4  = { 
      $publickey : advert_self.app.wallet.returnPublicKey(),
      $adfile    : "28.png",
      $link      : "http://org.saito.tech"
    };
    advert_self.app.storage.execDatabase(sql4, params4, function() {});
    
  });

}






////////////////
// Initialize //
////////////////
Advert.prototype.initialize = function initialize() {

  //
  // check to see if we are enabled
  //
  if (this.app.options.display_adverts == null) {
    this.app.options.display_adverts = 1;
  }


  if (this.browser_active == 0) { return; }

  if (this.app.BROWSER == 1) {

    var reddit_self = this;

    var rdloadtimer = setTimeout(function() {
      message                 = {};
      message.request         = "advert load adverts";
      message.data            = {};
      message.data.request    = "advert load adverts";
      message.data.publickey  = reddit_self.app.wallet.returnPublicKey();
      reddit_self.app.network.sendRequest(message.request, message.data);
    }, 500);
  }

}






/////////////////////
// Initialize HTML //
/////////////////////
Advert.prototype.initializeHTML = function initializeHTML() {

  if (this.app.options.display_adverts == 0) { return; }

  // leaderboard
  if ($('#advert-728-90').length > 0) {
    this.fetchAdvert(720,90);
  }

  // wide medium rectangle
  if ($('#advert-300-250').length > 0) {
    this.fetchAdvert(300,250);
  }

  // wide sky-scraper
  if ($('#advert-160-600').length > 0) {
    this.fetchAdvert(160,600);
  }

  // medium rectangle
  if ($('#advert-250-250').length > 0) {
    this.fetchAdvert(250,250);
  }

  // square popup
  if ($('#advert-240-400').length > 0) {
    this.fetchAdvert(248,400);
  }

  // large rectangle
  if ($('#advert-336-280').length > 0) {
    this.fetchAdvert(336,200);
  }

  // rectangle
  if ($('#advert-180-150').length > 0) {
    this.fetchAdvert(150,150);
  }

  // full banner
  if ($('#advert-468-60').length > 0) {
    this.fetchAdvert(4680,60);
  }

  // half banner
  if ($('#advert-234-80').length > 0) {
    this.fetchAdvert(234,80);
  }

  // micro bar
  if ($('#advert-88-31').length > 0) {
    this.fetchAdvert(88,31);
  }

  // button 1
  if ($('#advert-120-90').length > 0) {
    this.fetchAdvert(120,90);
  }

  // button 2
  if ($('#advert-120-60').length > 0) {
    this.fetchAdvert(120,60);
  }

  // square buttons
  if ($('#advert-125-125').length > 0) {
    this.fetchAdvert(125,125);
  }

  // vertical banner
  if ($('#advert-120-240').length > 0) {
    this.fetchAdvert(120,240);
  }

  // sky scraper 2
  if ($('#advert-120-600').length > 0) {
    this.fetchAdvert(120,600);
  }

  // half-page ad
  if ($('#advert-300-600').length > 0) {
    this.fetchAdvert(300,600);
  }


  if ($('#advert-300-250').length > 0) {
    this.fetchAdvert(300,250);
  }


  // in case we are the upload page
  var a = '/advert/upload/'+this.app.wallet.returnPublicKey()+'/300/250';
  $('#uploadForm').attr('action', a);

}


Advert.prototype.fetchAdvert = function fetchAdvert(width, height) {

  $.getJSON('/advert/'+this.app.wallet.returnPublicKey()+'/'+width+'/'+height, function (data) {
    if (data.id != null) {
      htmlToInsert = '<a href="'+data.link+'" target="_blank"><img style="border:1px solid #39579a;width:'+width+'px;height:'+height+'px" src="/advert/cache/'+data.adfile+'" /></a>';
    } else {
      htmlToInsert = '<a href="/advert/"><img style="width:'+width+'px;height:'+height+'px" src="/advert/web/001.png" /></a>';
    }
    let divname = "#advert-"+width+"-"+height;
    $(divname).html(htmlToInsert);
  });

}











/////////////////////////
// Handle Web Requests //
/////////////////////////
Advert.prototype.webServer = function webServer(app, expressapp) {

  var advert_self = this;

  expressapp.get('/advert', function (req, res) {
    res.sendFile(__dirname + '/web/index.html');
    return;
  });
  expressapp.get('/advert/style.css', function (req, res) {
    res.sendFile(__dirname + '/web/style.css');
    return;
  });
  expressapp.get('/advert/cache/:imagefile', function (req, res) {
    var imgf = '/web/cache/'+req.params.imagefile;
console.log("\n\n\nHERE: " + imgf);
    if (imgf.indexOf("\/") != false) { return; }
    res.sendFile(__dirname + imgf);
    return;
  });
  expressapp.post('/advert/upload/:publickey/:width/:height', function (req, res) {

    if (!req.files) { return res.status(400).send('No files were uploaded.'); }

    var uploadUrl  = req.body.uploadUrl;
    var sampleFile = req.files.sampleFile;
    var pkey       = req.params.publickey;
    var width      = req.params.width;
    var height     = req.params.height;
    var auth       = req.body.auth;
    var user       = req.body.pkey;

console.log(auth + " -- " + user);


    if (uploadUrl == "" || sampleFile == undefined || pkey == "" || width == "" || height == "" || auth == "" || user == "") {
      res.send('You did not provide the necessary data.');
      res.end();
      return;
    }

    if (advert_self.app.crypt.hash(auth) != "7827cdd51947b678b4ac382820a96b8035ade259fd4a5a29212c6c29da7af691") {
      res.send('Authentication Password Incorrect');
      res.end();
      return;
    }

    // insert into database
    var sql = "INSERT OR IGNORE INTO mod_advert_adverts (publickey, link, views, height, width) VALUES ($pkey, $link, 0, $width, $height)";
    var params = { $pkey : user , $link : uploadUrl , $width : width , $height : height };
    advert_self.app.storage.db.run(sql, params, function(err, row) {

      var newFileName = advert_self.advert_img_dir + this.lastID + ".png";
      if (sampleFile != undefined) {
        sampleFile.mv(newFileName, function(err) {
          if (err) { return res.status(500).send(err); }
          res.send('File uploaded: <a href="/advert">Click here</a> and wait a moment for your new advertisement to load');
	  res.end();
  	  return;
        });
      }
    });
  });
  expressapp.get('/advert/:publickey/:width/:height', function (req, res) {

    if (req.params.publickey == null) { return; }

    var publickey = req.params.publickey;
    var width = req.params.width;
    var height = req.params.height;

    var psql = "SELECT count(*) AS count FROM mod_advert_users WHERE publickey = $publickey";
    var pparams = { $publickey : req.params.publickey };
    advert_self.app.storage.queryDatabase(psql, pparams, function(perr, prow) {

      if (perr != null) {
        console.log(JSON.stringify(perr));
	return;
      }

      if (prow == null) {
        var psql2 = "SELECT * FROM mod_advert_adverts WHERE width = $width AND height = $height ORDER BY RANDOM() LIMIT 1";
        var pparams2 = { $width : width , $height : height };
        advert_self.app.storage.queryDatabase(psql2, pparams2, function(perr2, prow2) {
	  advert_self.sendAdvert(prow2, res);
	});
      }

      if (prow.count == 0) {

        var sql = "INSERT OR IGNORE INTO mod_advert_users (publickey, views) VALUES ($publickey, $views)";
        var params = { $publickey : req.params.publickey , $views : 0 };
        advert_self.app.storage.db.run(sql, params, function(err) {

          if (err != null) { return; }
          if (this.lastID > 0) {

	    //////////////////
            // send payment //
	    //////////////////
            newtx = advert_self.app.wallet.createUnsignedTransactionWithDefaultFee(publickey, 30.0);
            if (newtx == null) { return; }
            newtx.transaction.msg.module = "Email";
            newtx.transaction.msg.title  = "Saito Advertising - Transaction Receipt";
            newtx.transaction.msg.data   = 'You have received 30 tokens from the Saito Advertising Network for viewing your first advertisement. In the future, you will receive a payment at random roughly once for every 1000 advertisements you view. If you would like to post an advertisement on our network, please send a message to david@saito';
            newtx = advert_self.app.wallet.signTransaction(newtx);
            advert_self.app.mempool.addTransaction(newtx);

          }
        });
      } else {

	if (advert_self.app.wallet.returnBalance() > 200) {
	  if (Math.random() < 0.001) {

	    //////////////////////////////////////////////
            // send payment every 1000 times on average //
	    //////////////////////////////////////////////
            newtx = advert_self.app.wallet.createUnsignedTransactionWithDefaultFee(publickey, 100.0);
            if (newtx == null) { return; }
            newtx.transaction.msg.module = "Email";
            newtx.transaction.msg.title  = "Saito Advertising - Bonus Payment";
            newtx.transaction.msg.data   = 'You have received 100 tokens from the Saito Advertising Network.';
            newtx = advert_self.app.wallet.signTransaction(newtx);
            advert_self.app.mempool.addTransaction(newtx);

          }
        }

      }

      var sql2 = "UPDATE mod_advert_users SET views = views+1 WHERE publickey = $publickey";
      var params2 = { $publickey : req.params.publickey };
      advert_self.app.storage.execDatabase(sql2, params2, function(err) {

        var psql2 = "SELECT * FROM mod_advert_adverts ORDER BY RANDOM() LIMIT 1";
        advert_self.app.storage.queryDatabase(psql2, {}, function(perr2, prow2) {
	  advert_self.sendAdvert(prow2, res);
	});

      });
    });
  });
}
Advert.prototype.sendAdvert = function sendAdvert(prow, res) {

  res.setHeader('Content-type', 'text/html');
  res.charset = 'UTF-8';
  if (prow != null) { res.write(JSON.stringify(prow)); }
  res.end();
  return;

}






//////////////////////////
// Handle Peer Requests //
//////////////////////////
Advert.prototype.handlePeerRequest = function handlePeerRequest(app, message, peer, mycallback) {

    ///////////////////////
    // server -- adverts //
    ///////////////////////
    if (message.request === "advert load adverts") {

      var pkey   = message.data.publickey;
      var sql    = "SELECT * FROM mod_advert_adverts WHERE publickey = $pkey";
      var params = { $pkey : pkey };

      app.storage.queryDatabaseArray(sql, params, function(err, rows) {
        if (rows != null) {
          for (var fat = rows.length-1; fat >= 0; fat--) {
            var message                 = {};
            message.request         = "advert load response";
            message.data            = {};
            message.data.id         = rows[fat].adfile;
            message.data.link       = rows[fat].link;
            message.data.height     = rows[fat].height;
            message.data.width      = rows[fat].width;
            peer.sendRequest(message.request, message.data);
          }
        }
      });
      return;
    }




    ///////////////////////
    // client -- adverts //
    ///////////////////////
    if (message.request === "advert load response") {

      var advert_id   = message.data.id;
      var advert_link = message.data.link;

      var toInsert = '<div><img src="/advert/cache/'+adfile+'" style="height:300px;width:250px;" /><a style="margin-left:10px" href="'+advert_link+'">'+advert_link+'</a></div>';

      $('#adverts').append(toInsert);
      $('#adverts').css('display','block');

      return;
    }

}



////////////////////////////////
// Email Client Interactivity //
////////////////////////////////
Advert.prototype.displayEmailForm = function displayEmailForm(app) {

  element_to_edit = $('#module_editable_space');

  element_to_edit_html = ' \
\
<div id="module_instructions" class="module_instructions"> \
    <b>Advertising Settings:</b> \
\
    <p></p> \
\
    Your browser has the Saito advertising module installed. This will send you tokens periodically if you use other Saito modules that provide places for you to view advertising. To enable or disable advertising, toggle this switch: \
\
    <p></p> \
\
';

  if (app.options.display_adverts == 0) {
    element_to_edit_html += ' \
      <input type="button" value="Enable Module" name="enable_advertising" id="enable_advertising" class="enable_advertising" /> \
    ';
  } else {
    element_to_edit_html += ' \
      <input type="button" value="Disable Module" name="disable_advertising" id="disable_advertising" class="disable_advertising" /> \
    ';
  }

  element_to_edit_html += ' \
    <p></p> \
  </div> \
  ';


  element_to_edit.html(element_to_edit_html);
  
  // auto-input correct address and payment amount
  $('#lightbox_compose_to_address').val(app.wallet.returnPublicKey());
  $('#lightbox_compose_payment').val(0.0);
  $('#lightbox_compose_fee').val(app.wallet.returnDefaultFee());
  $('.lightbox_compose_address_area').hide();
  $('.lightbox_compose_module').hide();
  $('#module_textinput').focus();
  $('#module_instructions').css('padding-top','4px');

  this.attachAdvertEvents(app);

}

Advert.prototype.attachAdvertEvents = function attachAdvertEvents(app) {

  var advert_self = this;

  $(".enable_advertising").off();
  $(".enable_advertising").on('click', function() {
    app.options.display_adverts = 1;
    app.storage.saveOptions();
    advert_self.app.modules.returnModule("Email").closeMessage();
  });

  $(".disable_advertising").off();
  $(".disable_advertising").on('click', function() {
    app.options.display_adverts = 0;    
    app.storage.saveOptions();
    advert_self.app.modules.returnModule("Email").closeMessage();
  });


}

