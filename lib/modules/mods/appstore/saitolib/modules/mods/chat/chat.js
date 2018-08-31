var saito = require('../../../saito');
var ModTemplate = require('../../template');
var util = require('util');


//////////////////
// CONSTRUCTOR  //
//////////////////
function Chat(app) {

  if (!(this instanceof Chat)) { return new Chat(app); }

  Chat.super_.call(this);

  this.app             = app;

  this.name            = "Chat";
  this.browser_active  = 0;
  this.chat            = this.app.options.chat || {};

  if (this.chat.rooms == null) {
    this.chat.rooms = [];
    this.chat.records = {};
    var newfriend = {
      "host" : "",
      "port" : "",
      "protocol": "",
      "relay" : 0,
      "name" : "All",
      "publickey" : "All",
      "relay_publickey" : ""
    }
    this.chat.rooms.push(newfriend);
    this.chat.records[newfriend.publickey]=[];
  }

  return this;

}
module.exports = Chat;
util.inherits(Chat, ModTemplate);



////////////////////
// Install Module //
////////////////////
Chat.prototype.installModule = function installModule() {

  var sql = 'CREATE TABLE IF NOT EXISTS mod_chats (\
                id INTEGER, \
                tx TEXT, \
                to_address TEXT, \
		from_address TEXT, \
                UNIQUE (tx), \
                PRIMARY KEY(id ASC) \
        )';
  this.app.storage.execDatabase(sql, {}, function() {});

}



////////////////
// Initialize //
////////////////
Chat.prototype.initialize = function initialize() {

  var chat_self = this;

  /*****
  // wipe-out chat records on load
  this.app.options.chat = [];
  this.chat.rooms = [];
  this.chat.records = {};
  var newfriend = {
    "host" : "",
    "port" : "",
    "protocol": "",
    "relay" : 0,
    "name" : "All",
    "publickey" : "All",
    "relay_publickey" : ""
  }
  this.chat.rooms.push(newfriend);
  this.chat.records[newfriend.publickey]=[];
  *****/

  // try to connect to all peers
  //
  // TODO
  //
  // monitor IP address changes and update myself
  //
  for (let p = 0; p < this.chat.rooms.length; p++) {
    let cf = this.chat.rooms[p];
    if (cf.publickey != "All") {
      chat_self.app.network.addPeer(cf.host, cf.port, cf.protocol, 0, 1, 0); // only txs
    }
  }

  var rdloadtimer = setTimeout(function() {
    message                 = {};
    message.request         = "chat load posts";
    message.data            = {};
    message.data.request    = "chat load posts";
    message.data.publickey  = chat_self.app.wallet.returnPublicKey();
    chat_self.app.network.sendRequest(message.request, message.data);
  }, 1500);

}



/////////////////////////
// Handle Web Requests //
//////////////////////////
Chat.prototype.webServer = function webServer(app, expressapp) {
  expressapp.get('/chat/', function (req, res) {
    res.sendFile(__dirname + '/web/splash.html');
    return;
  });
  expressapp.get('/chat/img/mailchat.jpg', function (req, res) {
    res.sendFile(__dirname + '/web/img/mailchat.jpg');
    return;
  });
  expressapp.get('/chat/index.html', function (req, res) {
    res.sendFile(__dirname + '/web/index.html');
    return;
  });
  expressapp.get('/chat/script.js', function (req, res) {
    res.sendFile(__dirname + '/web/script.js');
    return;
  });
  expressapp.get('/chat/style.css', function (req, res) {
    res.sendFile(__dirname + '/web/style.css');
    return;
  });
}



/////////////////////
// Initialize HTML //
/////////////////////
Chat.prototype.initializeHTML = function initializeHTML(app) {

  var chat_self = this;

  // load archived messages
  app.archives.processTransactions(30, function (err, txarray) {
    if (txarray.length > 0) {
      for (let bv = 0; bv < txarray.length; bv++) {
        try {

          if (txarray[bv].transaction == undefined) {
	    console.log("Undefined Transaction in Local Storage: ");
	    console.log(JSON.stringify(txarray[bv]));
	  } else {

            var {msg, sig} = txarray[bv].transaction;
            if (msg.module == "Chat") {

	      var tx = txarray[bv];
              var publickey = tx.transaction.from[0].add;
              var author = tx.transaction.from[0].add;
              var message = msg.message;
              var chatRoom = 0;

	      for (let v = 0; v < chat_self.chat.rooms.length; v++) {
	        if (chat_self.chat.rooms[v].publickey == author) {
	 	   chatRoom = v;
 	  	   v = chat_self.chat.rooms[v].length+1;
	         }
              };
              var newmsg = { id: sig, author, message };

              if (chat_self.chat.records[publickey] == null) {
                chat_self.chat.records[publickey] = [newmsg];
              } else {
                newmsg.author = chat_self.chat.rooms[chatRoom].name;
                chat_self.chat.records[chatRoom].push(newmsg);
              }
	    }
          }
        } catch (err) {
          console.log("ERRR: ");
          console.log(err);
          console.log(txarray[bv]);
        }
      }
      if (chat_self.chat.records["All"] == null) {
        chat_self.chat.records["All"] = [];
      }
      if (chat_self.chat.records["All"].length == 0) {
        chat_self.chat.records["All"].unshift({ author: "", message: "<p>Welcome to Saito!</p><pre style=\"padding-top:10px;padding-left:20px\">add david@saito<br style\"margin-top:4px;\"/>add 22AgiGAQREjEZJeZV4xUhZyJLkHxMpYgHvJ5EFDoErTdv</pre><p style=\"margin-top:10px;\">Add friends as above, or type \"help\" for help.</p></span>"});
      }
    } else {
      chat_self.chat.records["All"] = [{ author: "BearGuy", message: "Welcome to Saito!" }];
    }
    chat_self.renderMessagesToDOM('All');
  });

  // load chat rooms
  for (let i = 0; i < chat_self.chat.rooms.length; i++) {
    chat_self.addChatRoom(i);
  }
}

Chat.prototype.addChatRoom = function addChatRoom(i) {
  var chat_self = this;
  $('.chat_chat-room-selector').append(`<option class="chat_chat-room-option" value="${chat_self.chat.rooms[i].publickey}">${chat_self.chat.rooms[i].name}</option>`)
}



///////////////////////
// handlePeerRequest //
///////////////////////
//
// zero-fee transactions sent directly to us by chat-peers end up
// here. we handle them just like paid transactions sent over the
// blockchain. paid & free are interchangeable.
//
Chat.prototype.handlePeerRequest = function handlePeerRequest(app, req, peer, mycallback) {

  var chat_self = this;

  if (req.request == null) { return; }
  if (req.data == null) { return; }

  if (req.request == "chat load posts") {

    // browsers cannot do this
    if (app.BROWSER == 1) { return; }

    let publickey = req.data.publickey;

    let sql1 = "SELECT * FROM mod_chats WHERE to_address = $publickey";
    let params1 = {
      $publickey : publickey
    }
    chat_self.app.storage.queryDatabaseArray(sql1, params1, function(err, rows) {

      if (rows != null) {
        for (let b = 0; b < rows.length; b++) {
	  var tx   = rows[b].tx;
	  var to   = rows[b].to_address;
	  var from = rows[b].from_address;

          var relreq = {};
          relreq.request = "chat send message";
          relreq.data = {};
          relreq.data.tx = tx;
          relreq.data.counter = 1;
          peer.sendRequest(relreq.request, relreq.data);

          let sql2 = "DELETE FROM mod_chats WHERE id = $id";
          let params2 = { $id : rows[b].id }
	  chat_self.app.storage.execDatabase(sql2, params2, function() {});

        }
      }
    });
  }


  var tx = new saito.transaction(req.data.tx);

  if (tx == null) { return;}

  ///////////////////////
  // chat send message //
  ///////////////////////
  if (req.request === "chat send message") {

console.log("received a chat send message request!");

    if (req.data.counter == null) {
      console.log("ERROR: counter not defined");
      return;
    }

    /////////////////////
    // relay message ? //
    /////////////////////
    tx.decryptMessage(chat_self.app);
    var txmsg = tx.returnMessage();

console.log("\n\n\nCHAT SEND MESSAGE 1: " + JSON.stringify(txmsg));

    let from = txmsg.from;
    let to = txmsg.to;
    let relay = txmsg.relay;
    let message = txmsg.message;
    let sig = txmsg.sig;

    if (from == chat_self.app.wallet.returnPublicKey()) { return; }


    if (relay == 1 && to != chat_self.app.wallet.returnPublicKey()) {

      //
      // zero fee tx
      //
      var newtx = app.wallet.createUnsignedTransaction(to, 0.0, 0.0);

console.log("Creating unsigned transaction to relay this message...");

      if (newtx == null) { return; }

console.log("Creating unsigned transaction to relay this message 2...");

      newtx.transaction.msg.module  = "Chat";
      newtx.transaction.msg.request = "chat send message";
      newtx.transaction.msg.from    = from;
      newtx.transaction.msg.to      = to;
      newtx.transaction.msg.relay   = 1;
      newtx.transaction.msg.message = message;
      newtx.transaction.msg.sig     = sig;
      newtx.transaction.msg.tx      = JSON.stringify(tx.transaction);
      newtx.transaction.msg       = app.keys.encryptMessage(to, newtx.transaction.msg);
      newtx = app.wallet.signTransaction(newtx);

      if (chat_self.app.network.isPeerConnected(to) == 1) {

console.log("We are connected to the peer, and going to send....");

        var peers = chat_self.app.network.peers;
        for (let p = 0; p < peers.length; p++) {
          if (peers[p].peer.publickey == to) {

console.log("We are sending to the peer...");

            relreq = {};
            relreq.request = "chat send message";
            relreq.data = {};
            relreq.data.tx = JSON.stringify(newtx.transaction);
            relreq.data.counter = 1;
            peers[p].sendRequest(relreq.request, relreq.data);

            return;
          }
        }
        return;

      } else {

        if (app.BROWSER == 0) { 

          var sql = "INSERT OR IGNORE INTO mod_chats (to_address, from_address, tx) VALUES ($to, $from, $tx)";
          var params = {
	    $to   : to,
	    $from : from,
	    $tx   : JSON.stringify(newtx.transaction)
          }
          chat_self.app.storage.execDatabase(sql, params, function() {});
	  console.log("\n\n\nSAVE THIS MESSAGE FOR LATER RELAY\n\n\n");

        }
      }
    }

    chat_self.onConfirmation(null, tx, 0, app);

  }


  ///////////////////
  // chat add user //
  ///////////////////
  if (req.request === "chat add user") {
    email_self.onConfirmation(null, tx, 0, app);
  }

}


////////////////////
// onConfirmation //
////////////////////
//
// paid transactions sent over the blockchain end up here. we
// handle them just like zero-fee transactions sent peer-to-peer
//
// zero-fee transactions are sent in here with BLK=null and conf==0
// so do not edit this to require the chat functionality to require
// anything else.
//
Chat.prototype.onConfirmation = function onConfirmation(blk, tx, conf, app) {

  var chat_self = app.modules.returnModule("Chat");

  if (conf == 0) {

    if (tx.transaction.to[0].add == app.wallet.returnPublicKey()) {

      var txmsg = tx.returnMessage();
      var counter = txmsg.counter;

      if (txmsg.request == "chat add user") {
        console.log("\n\n\n\n\n\n\nCHAT INSIDE onConfirmation", tx.transaction)
        chat_self.receiveChatAddUser(tx, app, counter, 1, tx.transaction.from[0].add);
        return;
      }
      if (txmsg.request == "chat send message") {
console.log("\n\n\nCHAT SEND MESSAGE 2:");
        chat_self.receiveChatSendMessage(tx, app);
        return;
      }
    }
  }
}


////////////////////////
// receiveChatAddUser //
////////////////////////
Chat.prototype.receiveChatAddUser = function receiveChatAddUser(tx, app, counter=0, setCounter=1, toAddress) {

  var chat_self = this;

  ///////////////////////////
  // save remote user info //
  ///////////////////////////
  //
  // tx will be null if we are calling this
  // to SEND the initial message, in which
  // case counter = 1 (reply_needed) and
  // setCounter = 1 (demand reply from peer)
  //
  if (tx != null) {

    let txmsg = tx.returnMessage();
    let remote_relay        = txmsg.relay;
    let remote_host         = txmsg.host;
    let remote_port         = txmsg.port;
    let remote_protocol     = txmsg.protocol;
    let remote_relay_pubkey = txmsg.publickey;
    let remote_user_pubkey  = tx.transaction.from[0].add;

    if (remote_relay_pubkey == undefined) { remote_relay_pubkey = ""; }

    var newfriend = {
      "host" : remote_host,
      "port" : remote_port,
      "protocol" : remote_protocol,
      "relay" : remote_relay,
      "name" : remote_user_pubkey,
      "publickey" : tx.transaction.from[0].add,
      "relay_publickey" : remote_relay_pubkey
    }

console.log("New Friend: " + JSON.stringify(newfriend));

    if (this.chat.rooms == null) { this.chat.rooms = []; }
    let nfexists = 0;
    for (let i = 0; i < this.chat.rooms.length; i++) {
      if (newfriend.publickey == this.chat.rooms[i].publickey) { nfexists = 1; }
    }
    if (nfexists == 0) {

console.log("New Friend 2: " + JSON.stringify(newfriend));

      let inserted_chatroom_idx = -1;
      let inserted_pubkey = "";


      // DNS entry
      newfriend.name = newfriend.publickey.substring(0,8);
      var newmsg = {
        id: tx.transaction.msig,
        author: newfriend.name,
        message: "opens chat channel"
      };
      newmsg.author = newfriend.name;
      chat_self.chat.rooms.push(newfriend);
      inserted_chatroom_idx = chat_self.chat.rooms.length-1;
      chat_self.chat.records[newfriend.publickey] = [];
      inserted_pubkey = newfriend.publickey;
      chat_self.addChatRoom(chat_self.chat.rooms.length-1);
      chat_self.chat.records["All"].push(newmsg);
      chat_self.renderMessagesToDOM("All");
      chat_self.saveChat();
console.log("saved chat...");

      chat_self.app.dns.fetchIdentifier(newfriend.publickey, function (answer) {

        console.log("\n\n\nUpdating Chat App with NAME");
        if (chat_self.app.dns.isRecordValid(answer) == 0) { return; }

        dns_response = JSON.parse(answer);

	// update the information we just inserted
        if (dns_response.identifier != "") {
          chat_self.chat.rooms[inserted_chatroom_idx].name = dns_response.identifier;
          chat_self.renderMessagesToDOM(inserted_pubkey);
          chat_self.saveChat();
        }


	// update selector
        $('.chat_chat-room-option').each(function() {
          if ($(this).val() == inserted_pubkey) {
            console.log("\n\n\nMATCH ON: " + $(this).val() + " -- " + $(this).html());
	    $(this).html(dns_response.identifier);
	  }
        });
	$('.chat_chat-room-selector').val(inserted_pubkey);
        $('.chat_chat-room-selector').change();

      });
    }
  }


  let reply_needed = 0;
  let reply_port   = "11991";
  let reply_host   = "unset_chat_replyhost.com";
  let reply_pubkey = "";
  let reply_relay  = 0;
  let reply_protocol = "http";

  if (counter == 0 ) { reply_needed = 1; }


  /////////////
  // browser //
  /////////////
  if (app.BROWSER == 1) {

    //
    // TODO
    //
    // we assume our first peer is a server if we are a browser, but
    // lite-clients will eventually want to be able to decide which
    // peers are relaying chat messages for them. we just currently
    // default to the first peer as most lite-clients will only have
    // a single peer --- the server feeding out modules to them.
    //

console.log("sending return information... 1 ");

    if (this.app.network.peers == null) { return; }
    if (this.app.network.peers[0] == null) { return; }

    reply_host   = this.app.network.peers[0].peer.host;
    reply_port   = this.app.network.peers[0].peer.port;
    reply_pubkey = this.app.network.peers[0].peer.publickey;
    reply_protocol = this.app.network.peers[0].peer.protocol;

console.log("sending return information... 2 " + reply_pubkey );

    if (reply_pubkey == undefined) { reply_pubkey = ""; }

    reply_relay  = 1;  // 1 = this is a relay, not us


  ////////////
  // server //
  ////////////
  } else {

console.log("sending return information... 3 " + reply_pubkey );

    if (chat_self.app.server == null) { return; }
    if (chat_self.app.server.server == null) { return; }

    reply_host   = chat_self.app.server.server.host;
    reply_port   = chat_self.app.server.server.port;
    reply_pubkey = chat_self.app.server.server.publickey;
    reply_protocol = chat_self.app.server.server.protocol;

    if (reply_pubkey == undefined) { reply_pubkey = ""; }

    reply_relay  = 0; // 0 = this is us

  }

console.log("sending return information... 4 " + reply_needed );

  //
  // by this point we have decided whether we need to send
  // a reply with our own connection information, and what
  // that information is. And so we send it if needed....
  //
  if (reply_needed == 1) {
console.log("Sending reply with default fee... 1");
    var newtx = app.wallet.createUnsignedTransactionWithDefaultFee(toAddress, 0.0)
    newtx.transaction.msg.module = "Chat";
    newtx.transaction.msg.request = "chat add user";
    newtx.transaction.msg.counter = setCounter; // 1 = replying
    newtx.transaction.msg.relay = reply_relay;
    newtx.transaction.msg.host = reply_host;
    newtx.transaction.msg.port = reply_port;
    newtx.transaction.msg.protocol = reply_protocol;
    newtx.transaction.msg.publickey = reply_pubkey;
    newtx.transaction.msg 	= app.keys.encryptMessage(toAddress, newtx.transaction.msg);
    newtx = app.wallet.signTransaction(newtx);
console.log("Sending reply with default fee... 2");
console.log(JSON.stringify(newtx));
    app.network.propagateTransaction(newtx);
  }
}


////////////////////////////
// receiveChatSendMessage //
////////////////////////////
Chat.prototype.receiveChatSendMessage = function receiveChatSendMessage(tx, app) {
console.log("TRANSACTION RECEIVED: " + JSON.stringify(tx));
  this.attachMessage(tx, app);
}


//////////////////
// attachEvents //
//////////////////
Chat.prototype.attachEvents = function attachEvents(app) {

  var chat_self = this;

  $('.chat_new-message-input').off();

  $('.chat_new-message-input').on('keypress', function(e) {
    if (e.which == 13 || e.keyCode == 13) {

      var msg = $('.chat_new-message-input').val();
      var chatRoomPublicKey = $('.chat_chat-room-selector').val();
      var chatRoom;

      $('.chat_new-message-input').val("");

      for (let y = 0; y < chat_self.chat.rooms.length; y++) {
        if (chatRoomPublicKey == chat_self.chat.rooms[y].publickey) {
	        chatRoom = y;
	        y = chat_self.chat.rooms.length+1;
        }
      }

      if (msg == '') { return }

      // All
      if (chatRoomPublicKey == "All") {
        chat_self.chat.records["All"].push({ author: "", message: "<div style=\"line-height:26px\"><b>Messages posted in this channel are not sent to your contacts.</b> To communicate with a friend, post in their dedicated chat.</div>"});
        chat_self.renderMessagesToDOM('All');
        //return;
      }

      // help
      if (msg.substring(0,4) == "help") {
        chat_self.chat.records["All"].push({ author: "", message: "<div style=\"line-height:26px\">This is a decentralized chat application. Users exchange connection information over the blockchain, and then exchange messages off-blockchain as fee-free transactions.<p style=\"margin-top:8px\"></p>To add a user, use the \"add\" keyword followed by either their publickey or Saito email address. A private channel will be opened using a single onchain transaction. Once a channel is created you MUST post messages for this user in the channel to guarantee deliverability.<p style=\"margin-top:8px\"></p>Please note: if you have exchanged secret keys with someone using the Saito email client, this application will use that shared secret to encrypt your communications with that user.</div>"});
        chat_self.renderMessagesToDOM('All');
        return;
      }
      //
      // add users 
      //
      // "add 21959827AE41923837D498234CE4719238123"
      // "add chrome@saito"
      //
      if (msg.substring(0,3) == "add" && msg.length > 4) {

        var pubkey_to_add = msg.substring(4);
        var is_public_key = chat_self.app.crypto.isPublicKey(pubkey_to_add);

        if (is_public_key == 1) {
          console.log("ADDING: " + pubkey_to_add);
          chat_self.receiveChatAddUser(null, app, 0, 0, pubkey_to_add); // null = tx
									// 0=counter (reply_needed)
									// 0=set counter as 0
          $('.chat_new-message-input').val('');
	  return;

        } else {

          chat_self.app.dns.fetchPublicKey(pubkey_to_add, function(answer) {
            if (chat_self.app.dns.isRecordValid(answer) == 0) {
              alert("We cannot find the public key of that address");
              return;
            }
            dns_response = JSON.parse(answer);
            chat_self.receiveChatAddUser(null, app, 0, 0, dns_response.publickey); 	// null = tx
									// 0=counter (reply_needed)
									// 0=set counter as 0
            $('.chat_new-message-input').val('');
	    return;
          });

	  return;
        }

      }

      //
      // if we reach this part of the function, we are NOT adding
      // a new user to our chat application, which means we want
      // to send a message to whatever Room we are in through an
      // off-chain peer-to-peer message
      //
      // note the inclusion of the "chat send message" request within
      // the transaction as well as outside in the request. This is a
      // convenience so we can use the same function to handle off-chain
      // and onchain messages.
      //
      // TODO
      //
      // we need to get the public key of the person we are sending stuff to
      //
      let dest_port            = chat_self.chat.rooms[chatRoom].port;
      let dest_host            = chat_self.chat.rooms[chatRoom].host;
      let dest_protocol        = chat_self.chat.rooms[chatRoom].protocol;
      let dest_publickey       = chat_self.chat.rooms[chatRoom].publickey;
      let dest_relay           = chat_self.chat.rooms[chatRoom].relay;
      let dest_relay_publickey = chat_self.chat.rooms[chatRoom].relay_publickey;

      let addy = dest_publickey;
      if (dest_relay == 1 && dest_relay_publickey != "") { addy = dest_relay_publickey; }
      if (addy == "") { addy = chat_self.app.wallet.returnPublicKey(); }

      // create tx to send to user
      var newtx = app.wallet.createUnsignedTransaction(addy, 0.0, 0.0);
      if (newtx == null) { return; }
      newtx.transaction.msg.module  = "Chat";
      newtx.transaction.msg.request = "chat send message";
      newtx.transaction.msg.from    = app.wallet.returnPublicKey();
      newtx.transaction.msg.to      = dest_publickey;
      newtx.transaction.msg.relay   = dest_relay;
      newtx.transaction.msg.message = app.keys.encryptMessage(dest_publickey, msg);
      newtx.transaction.msg 	= app.keys.encryptMessage(addy, newtx.transaction.msg);
      newtx.transaction.msg.sig     = chat_self.app.wallet.signMessage(msg);
      newtx = app.wallet.signTransaction(newtx);

      var data = {};
      data.tx = JSON.stringify(newtx.transaction); // send only tx part
      data.counter = 0;
      var author = app.wallet.returnPublicKey().substring(0,8);
      if (app.wallet.returnIdentifier() != "") { author = app.wallet.returnIdentifier(); }
      for (let v = 0; v < chat_self.chat.rooms.length; v++) {
        if (chat_self.chat.rooms[v].publickey == chat_self.app.wallet.returnPublicKey()) {
          chatRoom = v;
          author = chat_self.chat.rooms[v].name;
        }
      }

      var newmsg = {
        id:newtx.transaction.sig,
	author:author,
        message:msg
      };

      // render and scroll
      chat_self.chat.records[chatRoomPublicKey].push(newmsg);
      var mllist = `#chat_main #${chatRoomPublicKey}`;
      var messageList = $(mllist);
      if (messageList.length != 0) { messageList.append(chat_self.formatMessage(newmsg)); }
      //chat_self.renderMessagesToDOM(chatRoomPublicKey);
      chat_self.scrollToBottom();
      chat_self.saveChat();


      if (chatRoom == "All") {
        app.network.sendRequest("chat send message", data);
      } else {
	for (let ii = 0; ii < app.network.peers.length; ii++) {
	  if (app.network.peers[ii].peer.host == dest_host) {
            app.network.peers[ii].sendRequest("chat send message", data);
	    ii = app.network.peers.length+1;
	  }
	}

      }

      $('.chat_new-message-input').val('');
      //
      // TODO
      //
      // do we really want to save these chat messages we
      // are sending?
      //
      app.archives.saveTransaction(newtx);
    }
  });

  $('.chat_chat-room-selector').off();
  $('.chat_chat-room-selector').change(function(){
    console.log($(this).val());
    chat_self.renderMessagesToDOM($(this).val());
  });


  $('.chat_message').off();
  $('.chat_message').on('click', function() {
    let thisid = $(this).attr('id');
    let spl = thisid.split("_");
    let au  = spl[3];

    for (let p = 0; p < chat_self.chat.rooms.length; p++) {
      var cf = chat_self.chat.rooms[p];
      if (cf.publickey == au) {
	$('.chat_chat-room-selector').val(cf.publickey);
        chat_self.renderMessagesToDOM(cf.publickey);
	return;
      }
    }
  });

}



Chat.prototype.formatMessage = function formatMessage({id, author, message}){
  if (author == "") {
    return `
    <p id="#message_id_${id}" class="chat_message">
      ${message}
    </p>
  `;
  }
  return `
  <p id="#message_id_${id}" class="chat_message">
    <i>${author}</i>: ${message}
  </p>
  `;
}


Chat.prototype.attachMessage = function attachMessage(tx, app) {

  var chat_self = this;

  // browsers only
  if (app.BROWSER == 0) { return; }

  tx.decryptMessage();
  var txmsg = tx.returnMessage();

  // force decryption if key exists
  // no sanity check
  var message = txmsg.message;
  if (txmsg.to != "All") { message = app.keys.decryptString(txmsg.from, txmsg.message); }
  var sig     = txmsg.sig;
  var from    = txmsg.from;
  var to      = txmsg.to;
  var sig     = txmsg.sig;

  // fetch chatroom from rooms
  var chatRoom = 0;
  var chatRoomPublicKey = null;

  if (to != app.wallet.returnPublicKey()) {
    chatRoomPublicKey = to;
  } else {
    chatRoomPublicKey = from;
  }

  var author   = from;
  var roomName = from.substring(0,8);
  var chatRoom = 0;

  for (let v = 0; v < chat_self.chat.rooms.length; v++) {
    if (chat_self.chat.rooms[v].publickey == author) {
      chatRoom = v;
      roomName = chat_self.chat.rooms[v].name;
      v = chat_self.chat.rooms[v].length+1;
    }
  }

  // add message to chat room
  var newmsg = { id: tx.transaction.sig, author: roomName, message };
  this.chat.records[chatRoomPublicKey].push(newmsg);

  // render if in chat room
  if ($('.chat_chat-room-selector').val() == chatRoomPublicKey) {
    var mllist = `#chat_main #${chatRoomPublicKey}`;
    var messageList = $(mllist);
    messageList.append(chat_self.formatMessage(newmsg));
  }

  // add notice to ALL
  let notification = { id: `notification_${chatRoomPublicKey}`, author: roomName, message: message }
  this.chat.records["All"].push(notification)

  if ($('.chat_chat-room-selector').val() == "All") {
    var mllist = '.chat_messages-list#All';
    var messageList = $(mllist);
    messageList.append(chat_self.formatMessage(newmsg));
  }

  this.saveChat();


  // scroll to bottom
  chat_self.scrollToBottom();
  this.attachEvents(app);
}

Chat.prototype.scrollToBottom = function scrollToBottom() {
  $("#chat_main").animate({ scrollTop: $('#chat_main').prop("scrollHeight")}, 1000);
}


Chat.prototype.renderMessagesToDOM = function renderMessagesToDOM(chatRoomPublicKey){
  var chat_self = this;
  var messageListParent = $('.chat_messages-list').parent();
  $('.chat_messages-list').remove()
  var messageList = $(`<ul class="chat_messages-list" id=${chatRoomPublicKey}></ul>`);

  console.log(chat_self.chat.records)
  console.log("This is the chatRoomPublicKey", chatRoomPublicKey)

  chat_self.chat.records[chatRoomPublicKey].forEach(function(message){
    messageList.append(chat_self.formatMessage(message));
  })

  chat_self.scrollToBottom();

  messageListParent.append(messageList);


}




Chat.prototype.saveChat = function saveChat() {

  for (var obj in this.chat.records) {
    if (this.chat.records[obj].length >= 8) {
      this.chat.records[obj].reverse();
      this.chat.records[obj] = this.chat.records[obj].splice(0, 8);
      this.chat.records[obj].reverse();
    }    
  }

  this.app.options.chat = this.chat;
  this.app.storage.saveOptions();
}

