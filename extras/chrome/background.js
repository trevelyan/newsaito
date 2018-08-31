



chrome.runtime.onMessage.addListener(function(message, callback) {
  if (message == "runContentScript"){
    chrome.tabs.executeScript({
      file: 'contentScript.js'
    });
  }
});



chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {

  switch (request.directive) {

    case "saito-email":
      chrome.tabs.create({url: chrome.extension.getURL("modules/mods/email/web/index.html")}, function() {});    
      break;

    case "saito-facebook":
      chrome.tabs.create({url: chrome.extension.getURL("modules/mods/facebook/web/index.html")}, function() {});    
      break;

    case "update_server":
      peer1   = {};
      peer1.host = request.serverhost;
      peer1.port = request.serverport;
      peer1.publickey = "";
      chrome.storage.local.get(["options"], function(items){


alert("in chrome local storage");


      if (items != null) { 
        if (items.options != null) {
          tmpoptions = JSON.parse(items.options); 
        } else {
          tmpoptions = {};
        }
      } else {
        tmpoptions = {};
      }

      // FOR NOW HARD RESET
      tmpoptions = {};

      if (tmpoptions.peers == null) {
        tmpoptions.peers = [];
      }
      tmpoptions.peers.push(peer1);
      chrome.storage.local.set({'options': JSON.stringify(tmpoptions)});

console.log("Opening Client");

      // open our email client //
      chrome.tabs.create({url: chrome.extension.getURL("modules/mods/email/web/index.html")}, function() {});

    });

    break;

  }
});

