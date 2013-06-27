var version = "1.0";
var debuggeeId;
var tabPort;
var openerId;

chrome.debugger.onDetach.addListener(onDetach);
chrome.debugger.onEvent.addListener(onEvent);

/* TODO: Show popup
chrome.browserAction.onClicked.addListener(function() {
  chrome.windows.getCurrent(function(win) {
    chrome.tabs.getSelected(win.id, actionClicked);
  });
});

function actionClicked(tab) {
}
*/

function onEvent(debuggeeId, method, params) {
  console.log("Got event: " + method);
  if (!tabPort) {
    console.log("Ignoring event " + method);
    return;
  }
  tabPort.postMessage({
    name: "__ld_event",
    method: method,
    params: params
  });
}

function onDetach(id) {
  if (debuggeeId && debuggeeId.tabId === id.tabId) {
    // TODO: Send detach notification
    debuggeeId = null;
  }
}

function connectToTab(tabId) {
  var newTabId = {tabId: tabId};
  chrome.debugger.attach(newTabId, version, function (id) {
    chrome.debugger.sendCommand(newTabId, "Inspector.enable", {});
    chrome.debugger.sendCommand(newTabId, "Page.enable", {});
    chrome.debugger.sendCommand(newTabId, "CSS.enable", {});
    chrome.debugger.sendCommand(newTabId, "Runtime.enable", {});
    chrome.debugger.sendCommand(newTabId, "ApplicationCache.enable", {});
    chrome.debugger.sendCommand(
      newTabId, "Debugger.enable", {}, function (id) {
        debuggeeId = newTabId;
        chrome.tabs.reload(tabId);
        tabPort = chrome.tabs.connect(openerId, {name: "BracketsLivePreviewBG"});
        tabPort.postMessage({
          name: "__ld_connected"
        });
      }
    );
  });
}

function openAndConnect(url) {
  chrome.tabs.query({url: url}, function (tabs) {
    if (tabs.length > 0) {
      // Found open tab, active it now
      chrome.tabs.update(tabs[0].id, {active: true});
      connectToTab(tabs[0].id);
    } else {
      chrome.tabs.create({url: url}, function (tab) {
        connectToTab(tab.id);
      });
    }
  });
}

function disconnect() {
  if (debuggeeId) {
    chrome.debugger.detach(debuggeeId, function () {
    });
    debuggeeId = null;
  }
}

function sendCommand(method, params) {
  if (!debuggeeId || !tabPort) {
    return;
  }
  var args = {};
  
  if (typeof params === "string") {
    args = JSON.parse(params || {});
  } else {
    args = params;
  }
  chrome.debugger.sendCommand(debuggeeId, method, args, function (ret) {
    var msg = {name: "__ld_sendCommand_response", id: params.id};
    if (ret) {
      msg.result = ret;
    } else {
      msg.error = chrome.runtime.lastError;
    }
    tabPort.postMessage(msg);
  });
}

chrome.runtime.onConnect.addListener(function (port) {
  if (port.name === "BracketsLivePreview") {
    port.onMessage.addListener(function (msg) {
      if (msg.name === "__ld_openPage") {
        openerId = msg.openerId;
        openAndConnect(msg.url);
      } else if (msg.name === "__ld_disconnect") {
        disconnect();
      } else if (msg.name === "__ld_sendCommand") {
        sendCommand(msg.method, msg.params);
      } else if (msg.name === "gettabid") {
        chrome.tabs.getSelected(function(tab) {
          if (tab) {
            port.postMessage({name: "tabid", id: tab.id});
          }
        });
      }
    });
  }
});
