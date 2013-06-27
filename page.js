// Connect to the extension back end
var port = chrome.runtime.connect({name: "BracketsLivePreview"});
port.onMessage.addListener(function (msg) {
  if (msg.name === "tabid") {
    tabId = msg.id;
  }
});
var tabId;

port.postMessage({name: "gettabid"});

chrome.runtime.onConnect.addListener(function(aPort) {
  if (aPort.name === "BracketsLivePreviewBG") {
    aPort.onMessage.addListener(function (msg) {
      window.postMessage(msg, "*");
    });
  }
});

window.addEventListener("message", function (event) {
  // We only accept messages from ourselves
  if (event.source != window)
    return;

  if (event.data.name === "__ld_openPage") {
    event.data.openerId = tabId;
  }
  // Forward messages to the port
  port.postMessage(event.data);
}, false);