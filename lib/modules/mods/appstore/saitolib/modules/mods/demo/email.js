var saito = require('../../../saito');
var ModTemplate = require('../../template');
var util = require('util');
var markdown = require("markdown").markdown;

//////////////////
// CONSTRUCTOR  //
//////////////////
function Email(app) {

  if (!(this instanceof Email)) { return new Email(app); }

  Email.super_.call(this);

  this.app             = app;

  this.name            = "Email";
  this.browser_active  = 0;
  this.handlesEmail    = 1;
  this.emailAppName    = "Email";

  this.sent_emails     = [];

  this.active_module   = "Email";

  return this;

}
module.exports = Email;
util.inherits(Email, ModTemplate);




Email.prototype.installModule = function installModule(app) {

  // fetch data from app
  var tmptx = new saito.transaction();
  tmptx.transaction.id          = 0;
  tmptx.transaction.ts          = new Date().getTime();
  tmptx.transaction.from        = [];
  tmptx.transaction.from[0]     = {};
  tmptx.transaction.from[0].add = "david@saito";
  tmptx.transaction.to          = [];
  tmptx.transaction.to[0]       = {};
  tmptx.transaction.to[0].add   = app.wallet.returnPublicKey();
  tmptx.transaction.msg         = {};
  tmptx.transaction.msg.module  = "Email";
  tmptx.transaction.msg.title   = "Welcome to the Saito Network (please read)";
  tmptx.transaction.msg.markdown = 0;
  tmptx.transaction.msg.data    = `Saito Mail is a decentralized email system:
  <p></p>
  1. Visit our <a style="text-decoration:underline;color:#444;text-decoration:underline;" href="/faucet?mobile=no&saito_address=${app.wallet.returnPublicKey()}">token faucet</a>.
  <p></p>
  2. Register an <span class="register_email_address" id="register_email_address" style="text-decoration:underline;cursor:pointer">email address</span>.
  <p></p>
  3. Feedback is welcome at &lt;<i>david@saito</i>&gt;.`;
  app.archives.saveTransaction(tmptx);

};


/////////////////////////
// Handle Web Requests //
/////////////////////////
Email.prototype.webServer = function webServer(app, expressapp) {

  expressapp.get('/email/', function (req, res) {
    res.sendFile(__dirname + '/web/index.html');
    return;
  });
  expressapp.get('/email/style.css', function (req, res) {
    res.sendFile(__dirname + '/web/style.css');
    return;
  });
  expressapp.get('/email/script.js', function (req, res) {
    res.sendFile(__dirname + '/web/script.js');
    return;
  });

}


////////////////////////
// Load from Archives //
////////////////////////
Email.prototype.loadFromArchives = function loadFromArchives(app, tx) { this.addMessageToInbox(tx, app); }
Email.prototype.loadAllFromArchives = function loadAllFromArchives(app) {

  var email_self = this;

  app.archives.processTransactions(20, function (err, txarray) {
    for (var bv = 0; bv < txarray.length; bv++) {
      try {
        if (txarray[bv].transaction.msg.module == "Email" || txarray[bv].transaction.msg.module == "Encrypt") {
          console.log("Adding message to Inbox")
          console.log(txarray[bv])
          email_self.addMessageToInbox(txarray[bv], app);
        }
      } catch (err) {
        console.log("ERRR: ");
        console.log(err);
      }
    }
  });
}



Email.prototype.initializeHTML = function initializeHTML(app) {
  var email_self = this;
  email_self.loadAllFromArchives(app);
  this.updateBalance(app);

  // if exists
  if (app.wallet.returnIdentifier() != "") {
    $('#saitoname').text(email_self.app.wallet.returnIdentifier());
  }


  // initialize app menu
  selobj = $('.mail-controls-apps-menu');
  selobj.empty();
  for (c = 0; c < email_self.app.modules.mods.length; c++) {
    if (email_self.app.modules.mods[c].handlesEmail == 1) {
      if ( email_self.browser_active == 1 ) {
        var modname = email_self.app.modules.mods[c].name;
        var selmod = '<li value="'+modname+'" class="mail-controls-apps-menu-option">'+email_self.app.modules.mods[c].name+'</li>';
        selobj.append(selmod);
      }
    }
  };

}



Email.prototype.attachMessage = function attachMessage(message, app) {

  if (app.BROWSER == 0) { return; }

  // messages decide on markdown
  var use_markdown = 1;
  if (msg.markdown != undefined) { use_markdown = msg.markdown; }

  // exit if message already exists (i.e. on page reload)
  tmp_message_id = "#message_"+message.id;

  if ($(tmp_message_id).length > 0) { return; }

  var md = markdown.toHTML(message.data);
  if (use_markdown == 0) { md = message.data; }
  console.log("++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++");
  console.log(message);
  var raw_message = JSON.stringify(message, null, 4);
  console.log(raw_message);
  message.raw = raw_message;

  var newrow = `
   <tr class="outer_message" id="message_${message.id}">
     <td class="checkbox"><input type="checkbox" class="check" name="" id="message_${message.id}_checkbox" /></td>
     <td>
       <table class="inner_message_table">
         <tr class="inner_message" id="message_${message.id}">
           <td id="message_${message.id}_from" class="from">${this.formatAuthor(message.from, app)}</td>
           <td id="message_${message.id}_title" class="title">${message.title}</td>
           <td id="message_${message.id}_time" class="time">${this.formatDate(message.time)}</td>
           <td id="message_${message.id}_module" class="module" style="display:none">${message.module}</td>
           <td id="message_${message.id}_data" class="data" style="display:none">${md}</td>
           <td id="message_${message.id}_attachments" class="attachment" style="display:none">${message.attachments}</td>
         </tr>
       </table>
     </td>
     <td id="message_${message.id}_source"><div class="message-source fa fa-ellipsis-h"></div></td>
   </tr>`;

  $('.message-table').prepend(newrow);

  this.attachEvents(app);

}


Email.prototype.addMessageToInbox = function addMessageToInbox(tx, app) {

  let txmsg = tx.returnMessage();

  if (app.BROWSER == 0) { return; }

  // fetch data from app
  msg = {};
  msg.id       = tx.transaction.sig;
  msg.time     = tx.transaction.ts;
  msg.from     = tx.transaction.from[0].add;
  msg.module   = txmsg.module;
  msg.title    = txmsg.title;
  msg.data     = txmsg.data;
  msg.markdown = txmsg.markdown;
  msg.attachments = txmsg.attachments;
  tocheck = "#message_"+msg.id;
  if ($(tocheck).length > 0) { return; }

  this.attachMessage(msg, app);

}



Email.prototype.updateBalance = function updateBalance(app) {
  if (app.BROWSER == 0) { return; }
  $('.balance-money').html(app.wallet.returnBalance().replace(/0+$/,'').replace(/\.$/,'\.0'));
}




///////////////////
// Attach Events //
///////////////////
Email.prototype.attachEvents = function attachEvents(app) {

  if (app.BROWSER == 0) { return; }

  var email_self = this;

  $('.mail-controls-apps-menu-option').off();
  $('.mail-controls-apps-menu-option').on('click', function() {
    let modname = $(this).html();
    $('#compose').click();
    email_self.app.modules.displayEmailForm(modname);
    $('#primary_nav_wrap ul ul').css('display', 'none');
    $('.mail-module-label').html(modname);
    $('.mail-module-label').show();
  });

  $('.mail-controls-apps').off();
  $('.mail-controls-apps').on('mouseover', function() {
    $('#primary_nav_wrap ul ul').css('display', 'block');
  });
  $('.mail-controls-apps').on('mouseout', function() {
    $('#primary_nav_wrap ul ul').css('display', 'none');
  });

  $('.message-source').on('click', function() {
      //console.log('gree');
      alert(this.id);
    });

  $('#mailbox_inbox').off();
  $('#mailbox_inbox').on('click', function() {

    email_self.closeMessage();

    $('#mailbox_sent').removeClass('active');
    $('#mailbox_inbox').addClass('active');
    $('.message-table').empty();

    // load archived messages
    app.archives.processTransactions(20, function (err, txarray) {
      for (var bv = 0; bv < txarray.length; bv++) {
        try {
          if (txarray[bv].transaction.msg.module == "Email" || txarray[bv].transaction.msg.module == "Encrypt") {
            if (txarray[bv].isTo(email_self.app.wallet.returnPublicKey()) == 1) {
              email_self.addMessageToInbox(txarray[bv], app);
            }
          }
        } catch (err) {
          console.log("ERRR: ");
          console.log(err);
        }
      }

      email_self.app.modules.displayEmailForm("Settings");

    });
  });


  $('#mailbox_sent').off();
  $('#mailbox_sent').on('click', function() {

    $('#mailbox_sent').addClass('active');
    $('#mailbox_inbox').removeClass('active');
    $('.message-table').empty();

    email_self.closeMessage();

    // load archived messages
    app.archives.processTransactions(20, function (err, txarray) {
      for (var bv = 0; bv < txarray.length; bv++) {
        try {
          if (txarray[bv].transaction.msg.module == "Email" || txarray[bv].transaction.msg.module == "Encrypt") {
            if (txarray[bv].isFrom(email_self.app.wallet.returnPublicKey()) == 1) {
              console.log(JSON.stringify(txarray[bv]));
              email_self.addMessageToInbox(txarray[bv], app);
            }
          }
        } catch (err) {
          console.log("ERRR: ");
          console.log(err);
        }
      }
    });

      // add any messages we have just sent
    for (let bv2 = 0; bv2 < email_self.sent_emails.length; bv2++) {
      console.log(JSON.stringify(email_self.sent_emails[bv2]));
      email_self.addMessageToInbox(email_self.sent_emails[bv2], app);
    }

  });


  $('#reply').off();
  $('#reply').on('click', function() {
    let fr = $('.lightbox_message_from_address').html();
    let to = $('.lightbox_message_to_address').html();

    if (email_self.app.keys.hasSharedSecret(to) == 1) {
      $('#lightbox_compose_to_address').css('background-color', '#f4fa58');
      $('#lightbox_compose_from_address').css('background-color', '#f4fa58');
      email_self.showEmailAlert("<span class='yellow-bg'>[encrypted email]</span>");
    }

    let tt = $('.email-title').html();
    $('#compose').click();
    $('.lightbox_compose_from_address').val(to);
    $('.lightbox_compose_to_address').val(fr);
    $('.email_title').html("Re: [" + tt + "]");
  });

  $('#mail-controls-settings').off();
  $('#mail-controls-settings').on('click', function() {
    $('#compose').click();
    email_self.app.modules.displayEmailForm("Settings");
  });


  $('#lightbox_compose_to_address').off();
  $('#lightbox_compose_to_address').on('focus', function() {
    $(this).select();
    email_self.showEmailAlert();
  });

  $('#lightbox_compose_to_address').off();
  $('#lightbox_compose_to_address').on('focus', function() {
    $(this).select();
    email_self.showEmailAlert();
    $('#lightbox_compose_to_address').css('color', '#000');
    $('#lightbox_compose_to_address').css('background-color', '#FFF');
    $('#lightbox_compose_from_address').css('color', '#000');
    $('#lightbox_compose_from_address').css('background-color', '#FFF');
  });

  $('#lightbox_compose_to_address').on('focusout', function() {
    $('#lightbox_compose_to_address').css('color', '#97A59E');
    $('#lightbox_compose_from_address').css('color', '#97A59E');

    // if this is not a public key, proactively try to
    // fetch the public key for this identifier to speed
    // up message sending....
    recipient = $('#lightbox_compose_to_address').val();
    recipient.trim();

    if (email_self.isPublicKey(recipient) == 0) {
      if (email_self.app.keys.findByIdentifier(recipient) != null) {

      // color if valid address
      $('#lightbox_compose_to_address').css('color', '#0B6121');
      $('#lightbox_compose_from_address').css('color', '#0B6121');

      // highlight if can encrypt
      recipientkeys = email_self.app.keys.findByIdentifier(recipient);

        if (email_self.app.keys.hasSharedSecret(recipientkeys.publickey) == 1) {
          $('#lightbox_compose_to_address').css('background-color', '#f4fa58');
          $('#lightbox_compose_from_address').css('background-color', '#f4fa58');
          email_self.showEmailAlert("<span class='yellow-bg'>[encrypted email]</span>");

        } else {

          // if encryption module is installed
          for (vfd = 0; vfd < email_self.app.modules.mods.length; vfd++) {
            if (email_self.app.modules.mods[vfd].name == "Encrypt") {
              email_self.showEmailAlert("<span id='encryptthismsg' style='cursor:pointer'>WARNING: plaintext email - click to encrypt</span>");
              $('#encryptthismsg').off();
              $('#encryptthismsg').on('click', function() {
                email_self.showEmailAlert();
                email_self.app.modules.displayEmailForm("Encrypt");
              });
            return;
            }
          }
        }
      return;

    } else {

      app.dns.fetchPublicKey(recipient, function(answer) {
        if (app.dns.isRecordValid(answer) == 0) {
          $('#lightbox_compose_to_address').css('color', '#8A0808');
          email_self.showEmailAlert("WARNING: cannot find publickey for "+recipient);
          return;
        }

        dns_response = JSON.parse(answer);

        email_self.app.keys.addKey(dns_response.publickey, dns_response.identifier, 0, "Email");
        email_self.app.keys.saveKeys();

        // color if valid address
        $('#lightbox_compose_to_address').css('color', '#0B6121');
        $('#lightbox_compose_from_address').css('color', '#0B6121');

        // if encryption module is installed
        for (vfd = 0; vfd < email_self.app.modules.mods.length; vfd++) {
          if (email_self.app.modules.mods[vfd].name == "Encrypt") {
            email_self.showEmailAlert("<span id='encryptthismsg' style='cursor:pointer'>WARNING: plaintext email - click to encrypt</span>");
            $('#encryptthismsg').off();
            $('#encryptthismsg').on('click', function() {
              email_self.showEmailAlert();
              email_self.app.modules.displayEmailForm("Encrypt");
            });

            return;

          }
        }

      });
    }

    } else {

      // approve address
      $('#lightbox_compose_to_address').css('color', '#0B6121');
      $('#lightbox_compose_from_address').css('color', '#0B6121');

      // highlight if can encrypt
      if (email_self.app.keys.hasSharedSecret(recipient) == 1) {
        $('#lightbox_compose_to_address').css('background-color', '#f4fa58');
        $('#lightbox_compose_from_address').css('background-color', '#f4fa58');
        email_self.showEmailAlert("<span class='yellow-bg'>[encrypted email]</span>");
      } else {

        // if encryption module is installed
        for (vfd = 0; vfd < email_self.app.modules.mods.length; vfd++) {
          if (email_self.app.modules.mods[vfd].name == "Encrypt") {
            email_self.showEmailAlert("<span id='encryptthismsg' style='cursor:pointer'>WARNING: plaintext email - click to encrypt</span>");
            $('#encryptthismsg').off();
            $('#encryptthismsg').on('click', function() {
              email_self.showEmailAlert();
              email_self.app.modules.displayEmailForm("Encrypt");
            });
            return;
          }
        }

      }
    }
  });


  $('#mail-controls-delete').off('click');
  $('#mail-controls-delete').on('click', function() {
    $('.check:checked').each(function() {
      id = $(this).attr('id');
      trclass = id.substring(0, id.length-9);
      msg_id  = trclass.substring(8);
      domobj = "#"+trclass;
      app.archives.removeMessage(msg_id);
      $(domobj).remove();
    });
  });




  $('#compose').off();
  $('#compose').on('click', function() {
    $('#lightbox_compose_to_address').css('color', '#000');
    $('#lightbox_compose_to_address').css('background-color', '#FFF');
    $('#lightbox_compose_from_address').css('color', '#000');
    $('#lightbox_compose_from_address').css('background-color', '#FFF');
    email_self.showEmailAlert();

    $('.lightbox_compose_module_select').val("Email");
    $('.lightbox_compose_payment').val(0.0);
    $('.lightbox_compose_fee').val(email_self.app.wallet.returnDefaultFee());
    email_self.resetEmailForm();

    $('.returnButton').show();
    $('.mail-controls-back').show();

    if ($(document).width() < 800) {
      $('.sidebar').hide();
    }

    $('.message-table').hide();
    $('.message').html(email_self.displayComposeEmail());
    $('.message').show();
    email_self.attachEvents(email_self.app);


    // customize module display
    selobj = $('.lightbox_compose_module_select');
    selobj.empty();
    for (c = 0; c < email_self.app.modules.mods.length; c++) {
      if (email_self.app.modules.mods[c].handlesEmail == 1) {
        if ( email_self.browser_active == 1 ) {
          selmod = '<option value="'+email_self.app.modules.mods[c].name+'">'+email_self.app.modules.mods[c].emailAppName+'</option>';
          selobj.append(selmod);
        }
      }
    };

    // show email stuff
    selobj.val("Email");
    app.modules.displayEmailForm("Email");

    to        = $('#lightbox_compose_to_address').val();
    from      = $('#lightbox_compose_from_address').val();

    if (email_self.isPublicKey(to) == 0) {
      if (email_self.app.keys.findByIdentifier(to) != null) {

        // color if valid address
        $('#lightbox_compose_to_address').css('color', '#0B6121');
        $('#lightbox_compose_from_address').css('color', '#0B6121');

        // highlight if can encrypt
        recipientkeys = email_self.app.keys.findByIdentifier(to);
        if (email_self.app.keys.hasSharedSecret(recipientkeys.publickey) == 1) {
          $('#lightbox_compose_to_address').css('background-color', '#f4fa58');
          $('#lightbox_compose_from_address').css('background-color', '#f4fa58');
          email_self.showEmailAlert("<span class='yellow-bg'>[encrypted email]</span>");
        }
      }
    } else {

      // color if valid address
      $('#lightbox_compose_to_address').css('color', '#0B6121');
      $('#lightbox_compose_from_address').css('color', '#0B6121');
      // highlight if can encrypt
      if (email_self.app.keys.hasSharedSecret(to) == 1) {
        $('#lightbox_compose_to_address').css('background-color', '#f4fa58');
        $('#lightbox_compose_from_address').css('background-color', '#f4fa58');
        email_self.showEmailAlert("<span class='yellow-bg'>[encrypted email]</span>");
      }
    }

    $('#send').off();
    $('#send').on('click', function() {

      if (email_self.app.network.isConnected() == 0) {
        alert("Browser lost connection to network: email not sent...");
        return;
      };

      var to        = $('#lightbox_compose_to_address').val();
      var from      = $('#lightbox_compose_from_address').val();
      var amount    = $('#lightbox_compose_payment').val();
      var fee       = $('#lightbox_compose_fee').val();

      total_saito_needed = parseFloat(amount)+parseFloat(fee);

      if (total_saito_needed > 0.0) {
        if (app.wallet.returnBalance() < total_saito_needed) {
          alert("Your wallet does not have enough funds: "+ total_saito_needed + " SAITO needed");
          return;
        }
      }

      // strip whitespace
      to.trim(); from.trim(); amount.trim(); fee.trim();
      // if this is not a public key

      // NON-PUBLIC KEY ADDRESSES MUST BE HANDLED BY MODULES
      if (to.indexOf("@saito") > 0) {

        // try to fetch local copy
        pk = app.keys.returnPublicKeyByIdentifier(to);

        if (pk == "") {

          // fetch publickey before sending
          app.dns.fetchPublicKey(to, function(answer) {
            if (app.dns.isRecordValid(answer) == 0) {
              dns_response = JSON.parse(answer);
              email_self.showBrowserAlert(dns_response.err);
              return;
            }

            dns_respose = JSON.parse(answer);

            myidentifier = dns_response.identifier;
            mypublickey  = dns_response.publickey;

            // add to our list of keys, email ones don't need watching
            email_self.app.keys.addKey(mypublickey, to, 0, "Email");

            // send email using local publickey
            newtx = app.wallet.createUnsignedTransactionWithDefaultFee(mypublickey, amount);
            if (newtx == null) { return; }
            modsel = email_self.active_module;
            newtx = app.modules.formatEmailTransaction(newtx, modsel);
            newtx = app.wallet.signTransaction(newtx);
            email_self.showEmailAlert("<span id='sendingthismsg'>attempting to broadcast transaction....</span>");
            app.network.propagateTransactionWithCallback(newtx, function() {
              email_self.showBrowserAlert("your message has been broadcast to the network");
              email_self.closeMessage();
            });

          });
        } else {

          // send email using local publickey
          to = pk;
          newtx = app.wallet.createUnsignedTransactionWithDefaultFee(to, amount);
          if (newtx == null) { return; }
          modsel = email_self.active_module;
          newtx = app.modules.formatEmailTransaction(newtx, modsel);
          newtx = app.wallet.signTransaction(newtx);
          email_self.showEmailAlert("<span id='sendingthismsg'>attempting to broadcast transaction....</span>");
          app.network.propagateTransactionWithCallback(newtx, function() {
            email_self.showBrowserAlert("your message has been broadcast to the network");
            email_self.closeMessage();
          });
        }
      } else {

        // send email using provided publickey
        var newtx = app.wallet.createUnsignedTransactionWithDefaultFee(to, amount);

        if (newtx == null) { return; }

        modsel = email_self.active_module;

        newtx = app.modules.formatEmailTransaction(newtx, modsel);
        newtx = app.wallet.signTransaction(newtx);

        email_self.showEmailAlert("<span id='sendingthismsg'>attempting to broadcast transaction....</span>");
        app.network.propagateTransactionWithCallback(newtx, function() {

          email_self.showBrowserAlert("your message has been broadcast to the network");
          email_self.closeMessage();
        });
      }

      $('.message').css("display", "block");
    });
  });
  $('.message-source').off();
  $('.message-source').on('click', function() {

      $('#mail-controls-back').show();

          // show email
      $('.message-table').hide();

      if ($(document).width() < 800) {
        $('.sidebar').hide();
      }

      $('.mail-balance').hide();
      $('.mail-controls-btn').hide();
      $('.mail-controls-back').show();

      $('.returnButton').show();
      $('.message').html('<pre>'+JSON.stringify(email_self.app.archives.returnTransactionBySig($(this).attr('id').split("_")[1]), null, 4)+'</pre>');

      $('.mail-module-label').html('Raw Transaction Data ID:');
      $('.mail-module-label').show();

      $('.message').show();
      email_self.attachEvents(email_self.app);
  });

  $('.inner_message').off();
  $('.inner_message').on('click', function() {

    message_id    = $(this).attr('id');
    message_class = $(this).attr('class');

    message_text_selector = "#" + message_id + " > .from";
    emailFrom = $(message_text_selector).text();

    message_text_selector = "#" + message_id + " > .to";
    emailTo = $(message_text_selector).text();
    if (emailTo == "") {
      emailTo = email_self.formatAuthor(email_self.app.wallet.returnPublicKey(), email_self.app);
    }

    message_text_selector = "#" + message_id + " > .module";
    module = $(message_text_selector).text();

    message_text_selector = "#" + message_id + " > .data";
    emailbody = $(message_text_selector).html();

    message_text_selector = "#" + message_id + " > .title";
    emailtitle = $(message_text_selector).text();

    message_text_selector = "#" + message_id + "_attachments";
    astring = $(message_text_selector).text();

    $('#mail-controls-back').show();

    // show email
    $('.message-table').hide();

    if ($(document).width() < 800) {
      $('.sidebar').hide();
    }

    $('.mail-balance').hide();
    $('.mail-controls-btn').hide();
    $('.mail-controls-back').show();

    $('.returnButton').show();
    $('.message').html(email_self.displaySelectEmail(emailFrom, emailTo, emailtitle, emailbody));
    email_self.app.modules.displayEmailMessage(message_id, module);
    email_self.app.modules.attachEmailEvents();

    $('.mail-module-label').html(emailtitle);
    $('.mail-module-label').show();

    $('.message').show();
    email_self.attachEvents(email_self.app);

  });


  $('.returnButton').off();
  $('.returnButton').on('click', () => {
    email_self.closeMessage();
    $('.sidebar').show();
  })

  // unbind the checkboxs
  $('.checkbox').off('click');

}


Email.prototype.displaySelectEmail = function displaySelectEmail(from, to, title, body ) {
  var html = `
    <div class="select_email_container">
      <div class="lightbox_message_title">
        <div class="lightbox_message_reply" id="lightbox_message_reply">
          <div id="reply" class="redbutton reply">REPLY</div>
        </div>
        <div class="lightbox_message_from" id="lightbox_message_from">
          <span class="lightbox_message_from_label">FROM: </span>
          <span class="lightbox_message_from_address" id="lightbox_message_from_address" readonly>${from}</span>
        </div>
        <div class="lightbox_message_to" id="lightbox_message_to">
          <span class="lightbox_message_to_label">TO: </span>
          <span class="lightbox_message_to_address" id="lightbox_message_to_address">${to}</span>
        </div>
      </div>
      <div class="lightbox_message_text" id="lightbox_message_text">
      </div>
    </div>
  `;
  return html;
}
Email.prototype.displaySidebar = function displaySidebar() {
  var html = `
    <div class="compose" id="compose">COMPOSE</div>
    <div class="mailboxes" id="mailboxes">
      <div id="mailbox_inbox" class="mailbox active">Inbox</div>
      <div id="mailbox_sent" class="mailbox">Sent</div>
    </div>
  `;
  return html;
};
Email.prototype.displayComposeEmail = function displayComposeEmail() {
  var html = `
    <div class="compose_email_container">
    <div class="lightbox_compose_address_area">
      <div class="lightbox_compose_from" id="lightbox_compose_from">
        <span class="lightbox_compose_from_label">FROM: </span>
        <input type="text" id="lightbox_compose_from_address" class="lightbox_compose_from_address" value="${this.app.wallet.returnPublicKey()}" readonly />
      </div>
      <div class="lightbox_compose_to" id="lightbox_compose_to">
        <span class="lightbox_compose_to_label">TO: </span>
        <input type="text" id="lightbox_compose_to_address" class="lightbox_compose_to_address" value="${this.app.wallet.returnPublicKey()}" />
      </div>
    </div>
    <div class="lightbox_compose_module" id="lightbox_compose_module">
      <div class="lightbox_compose_module_box">
        <div class="lightbox_compose_fee_container" style="float:left;font-size:0.9em;">
          <span class="lightbox_compose_fee_label">fee: </span>
          <input type="text" class="lightbox_compose_fee" id="lightbox_compose_fee" value="0.0001" />
        </div>
        <div class="lightbox_compose_payment_container" style="float:left;font-size:0.9em;">
          <span class="lightbox_compose_payment_label">payment: </span>
          <input type="text" class="lightbox_compose_payment" id="lightbox_compose_payment" value="0.0" />
        </div>
      </div>
      <div class="lightbox_compose_compose">
        <div class="redbutton send" id="send">SEND</div>
      </div>
    </div>
    <div class="module_editable_space" id="module_editable_space">
      Payment Transaction
    </div>
    </div>
  `;
  return html;
}













////////////////////////
// Display Email Form //
////////////////////////
Email.prototype.resetEmailForm = function resetEmailForm() {
  $('.lightbox_compose_address_area').show();
  $('.lightbox_compose_module').show();
  $('#send').show();
}
Email.prototype.displayEmailForm = function displayEmailForm(app) {
  email_self = this;

  email_self.showBrowserAlert("");

  element_to_edit = $('#module_editable_space');
  element_to_edit_html = '<input type="text" class="email_title" id="email_title" value="" /><p></p><textarea class="email_body" id="email_body" name="email_body"></textarea>';
  element_to_edit_html += '<input type="hidden" name="email_attachments" id="email_attachments">';
  element_to_edit_html += '<div id="file-wrap">';
  element_to_edit_html += '<div id="file-upload-shim" class="addfile">Add file</div></div>';
  element_to_edit.html(element_to_edit_html);
  $('#email_attachments').val("unset");

  var files = {};
  var filecount = 0;
  var pfile = document.createElement('input');
  pfile.type = 'file';
  pfile.setAttribute('id', 'email_attachment');
  pfile.setAttribute('name', 'email_attachment');
  $('#file-wrap').append(pfile);

  $('#email_attachment').on('change', function() {
    email_self.showEmailAlert("copying file into message....");
    var file_details = {};
    var upload = this.files[0];
    var file_name = document.createElement('div');
    file_name.setAttribute('class', 'file-upload');
    file_name.setAttribute('accessKey', filecount);
    file_name.innerHTML = upload.name;
    file_name.addEventListener('click', function() {
      this.remove(this);
      delete files[this.accessKey];
      $('#email_attachments').val(JSON.stringify(files));
    });

    element_to_edit.append(file_name);
    //email_self.showEmailAlert("uploading file....");
    file_details.name = upload.name;
    file_details.size = upload.size;
    var code = "no content"
    var p = new Promise(function(resolve) {
      var reader = new FileReader();
      reader.onload = function() {
        code = reader.result;
        resolve(file_details.data = code);
        files[filecount] = file_details;
        $('#email_attachments').val(JSON.stringify(files));
        filecount += 1;
        email_self.showEmailAlert("file copied into message....");
      };
      reader.readAsDataURL(upload);
    });
    this.value = "";
  });
}



/////////////////////
// Display Message //
/////////////////////
Email.prototype.displayEmailMessage = function displayEmailMessage(message_id, app) {

  if (app.BROWSER == 1) {
    message_text_selector = "#" + message_id + " > .data";
    emailbody = $(message_text_selector).html();

    message_text_selector = "#" + message_id + " > .title";
    emailtitle = $(message_text_selector).text();

    message_text_selector = "#" + message_id + "_attachments";
    astring = $(message_text_selector).text();

    // experiment with title in label
    //inserthtml = '<div class="message_title">' + emailtitle + '</div><div class="message_body">' + emailbody + '</div>';
    inserthtml = '<div class="message_body">' + emailbody + '</div>';

    insertcss = '<style type="text/css">.message_title {font-weight: bold; margin-bottom: 20px; font-size:1.2em; margin-top:10px; } .message_body {} .message_attachment{overflow:auto;}</style>';
    $('#lightbox_message_text').html(inserthtml + insertcss);
    $('#lightbox_message_text').html(inserthtml + insertcss);

    if (astring.length > 25) {
      var rfa = JSON.parse(astring);
      for (var i = 0; i < Object.keys(rfa).length; i++) {
        var fileobj = {};
        fileobj = rfa[Object.keys(rfa)[i]];
        var element = document.createElement('a');
        element.setAttribute('href', fileobj.data);
        element.setAttribute('download', fileobj.name);
        element.setAttribute('id', 'attachment_dl' + i);
        element.setAttribute('class', 'file-download');
        element.setAttribute('target', '_blank')
        element.innerHTML = fileobj.name;
        $('#lightbox_message_text').append(element);
      }
    }
  }
}

////////////////////////
// Format Transaction //
////////////////////////
Email.prototype.formatEmailTransaction = function formatEmailTransaction(tx, app) {

  // always set the message.module to the name of the app
  tx.transaction.msg.module = this.name;
  tx.transaction.msg.data  = $('#email_body').val();
  tx.transaction.msg.title  = $('#email_title').val();
  tx.transaction.msg.attachments = $('#email_attachments').val();
  //tx.transaction.msg.attachment_name = $('#email_attachment_name').val();

  // convert msg into encrypted string
  tmpmsg = app.keys.encryptMessage(tx.transaction.to[0].add, tx.transaction.msg);
  tx.transaction.msg = tmpmsg;

  return tx;

}

//////////////////
// Confirmation //
//////////////////
Email.prototype.onConfirmation = function onConfirmation(blk, tx, conf, app) {

  if (tx == null) { return; }

  let txmsg = tx.returnMessage();
  if (txmsg == null) { return; }
  if (txmsg.module != "Email") { return; }

  if (conf == 0) {
    if (tx.isFrom(app.wallet.returnPublicKey())) {
      app.archives.saveTransaction(tx);
      if (tx.transaction.to[0].add != app.wallet.returnPublicKey()) { return; } else {
        app.modules.returnModule("Email").addMessageToInbox(tx, app);
      }
    } else {
      if (app.BROWSER == 1) {
        if (tx.isTo(app.wallet.returnPublicKey())) {
          app.modules.returnModule("Email").addMessageToInbox(tx, app);
          app.archives.saveTransaction(tx);
        }
      }
    }
  }

}
















Email.prototype.attachEmailEvents = function attachEmailEvents() {

  var email_self = this;
  if (this.app.BROWSER == 1) {
    // hack to make the default welcome email responsive
    $('.register_email_address').off();
    $('.register_email_address').on('click', function() {
      email_self.closeMessage();
      $('#compose').click();
      email_self.app.modules.displayEmailForm("Registry");
    });

    // hack to make identifier registration work
    $('.register_email_address_success').off();
    $('.register_email_address_success').on('click', function() {
      email_self.closeMessage();
      email_self.app.dns.fetchIdentifier(email_self.app.wallet.returnPublicKey(), function (answer) {
	if (email_self.app.dns.isRecordValid(answer) == 0) {
          alert(answer);
          return;
        }

	dns_response = JSON.parse(answer);

        if (dns_response.identifier != "") {
          if (dns_response.publickey != "") {
            email_self.app.keys.addKey(dns_response.publickey, dns_response.identifier, 0, "Email");
            email_self.app.keys.saveKeys();
          }
          email_self.app.wallet.updateIdentifier(dns_response.identifier);
          $('#saitoname').text(email_self.app.wallet.returnIdentifier());
          email_self.app.wallet.saveWallet();
        }
      });
    });
  }

}




Email.prototype.showBrowserAlert = function showBrowserAlert(message="your message has been broadcast to the network") {
  $('#mail-alertbox').text(message);
  $('#mail-alertbox').show();
  setTimeout(function() {
    $('#mail-alertbox').fadeOut(1000);
  }, 3000);
}
Email.prototype.showEmailAlert = function showEmailAlert(message="") {
  $('#mail-alertbox').html(message);
  $('#mail-alertbox').show();
}


Email.prototype.formatDate = function formateDate(unixtime) {

  // not unixtime? return as may be human-readable date
  if (unixtime.toString().length < 13) { return unixtime; }

  x    = new Date(unixtime);
  nowx = new Date();

  y = "";

  if (x.getMonth()+1 == 1) { y += "Jan "; }
  if (x.getMonth()+1 == 2) { y += "Feb "; }
  if (x.getMonth()+1 == 3) { y += "Mar "; }
  if (x.getMonth()+1 == 4) { y += "Apr "; }
  if (x.getMonth()+1 == 5) { y += "May "; }
  if (x.getMonth()+1 == 6) { y += "Jun "; }
  if (x.getMonth()+1 == 7) { y += "Jul "; }
  if (x.getMonth()+1 == 8) { y += "Aug "; }
  if (x.getMonth()+1 == 9) { y += "Sep "; }
  if (x.getMonth()+1 == 10) { y += "Oct "; }
  if (x.getMonth()+1 == 11) { y += "Nov "; }
  if (x.getMonth()+1 == 12) { y += "Dec "; }

  y += x.getDate();

  if (x.getFullYear() != nowx.getFullYear()) {
    y += " ";
    y += x.getFullYear();
  } else {
    if (x.getMonth() == nowx.getMonth() && x.getDate() == nowx.getDate()) {

      am_or_pm = "am";

      tmphour = x.getHours();
      tmpmins = x.getMinutes();

      if (tmphour >= 12) {
        if (tmphour > 12) {
          tmphour -= 12;
        };
        am_or_pm = "pm";
      }
      if (tmphour == 0) {
        tmphour = 12;
      };
      if (tmpmins < 10) {
        y = tmphour + ":0" + tmpmins + " " + am_or_pm;
      } else {
        y = tmphour + ":" + tmpmins + " " + am_or_pm;
      }

    }
  }

  return y;

}

Email.prototype.formatAuthor = function formatAuthor(author, app) {

  x = this.app.keys.findByPublicKey(author);
  if (x != null) { if (x.identifiers.length > 0) { return x.identifiers[0]; } }

  if (x == this.app.wallet.returnPublicKey()) {
    if (this.app.wallet.returnIdentifier() == "") { return "me"; }
  }

  var email_self = this;

  if (this.isPublicKey(author) == 1) {
    app.dns.fetchIdentifier(author, function(answer) {

      if (app.dns.isRecordValid(answer) == 0) {
	      return author;
      }

      dns_response = JSON.parse(answer);

      // add to keylist
      email_self.app.keys.addKey(dns_response.publickey, dns_response.identifier, 0, "Email");
      email_self.app.keys.saveKeys();

      $('.from').each(function() {
        pkey = $(this).text();
        if (pkey == dns_response.publickey) { $(this).text(dns_response.identifier); }
      });

    });
  }

  return author;

}



Email.prototype.isPublicKey = function isPublicKey(publickey) {
  if (publickey.length == 44 || publickey.length == 45) {
    if (publickey.indexOf("@") > 0) {} else {
      return 1;
    }
  }
  return 0;
}



Email.prototype.closeMessage = function closeMessage() {
  $('.message').hide();
  $('.message-table').show();
  $('.mail-module-label').hide();
  $('.mail-balance').show();
  $('.mail-controls-btn').show();
  $('.mail-controls-back').hide();
}
