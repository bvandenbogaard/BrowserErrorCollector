var BrowserErrorCollector = {
  observerService: null,
  consoleService: null,
  errorList: [],
  collectedErrors: {
    list: "[]",
    __exposedProps__: {
      list: "rw"
    }
  },
  onLoad: function(event) {
    this.initialize();
    
    var windowContent = window.getBrowser();
    windowContent.addEventListener("load", this.onBrowserPageLoad, true);
  },
  onUnLoad: function(event) {
    // initialization code
    var windowContent = window.getBrowser();
    windowContent.removeEventListener("load", this.onBrowserPageLoad, true);
  },
  initialize: function() {
    this.observerService = Components.classes["@mozilla.org/observer-service;1"].getService(Components.interfaces.nsIObserverService);

    if (this.observerService)
    {
      this.observerService.addObserver(this.NetErrorListener, "http-on-examine-response", false);
      this.observerService.addObserver(this.NetErrorListener, "http-on-examine-merged-response", false);
    }

    this.consoleService = Components.classes["@mozilla.org/consoleservice;1"].getService().QueryInterface(Components.interfaces.nsIConsoleService);
    if (this.consoleService)
    {
      this.consoleService.registerListener(this.JSErrorListener);
    }
  },
  dispose: function() {
    if (this.observerService)
    {
      this.observerService.removeObserver(this.NetErrorListener, "http-on-examine-response", false);
      this.observerService.removeObserver(this.NetErrorListener, "http-on-examine-merged-response", false);
    }

    if (this.consoleService)
    {
      this.consoleService.unregisterListener(this.JSErrorListener);
    }

    this.observerService = null;
    this.consoleService = null;
  },
  onBrowserPageLoad: function(event) {
    var browser = window.getBrowser();
    if (browser) {
      var contentWindow = browser.selectedBrowser.contentWindow;
      if (contentWindow && !contentWindow.wrappedJSObject.BrowserErrorCollector) {
        contentWindow.wrappedJSObject.BrowserErrorCollector = this.collectedErrors;
      }
    }
  },
  updateError: function(error) {
    var browser = window.getBrowser();
    if (browser) {
      var contentWindow = browser.selectedBrowser.contentWindow;
      if (contentWindow) {
        if (error) {
          this.errorList.push(error);
        }
        contentWindow.wrappedJSObject.BrowserErrorCollector = this.collectedErrors;
        contentWindow.wrappedJSObject.BrowserErrorCollector.list = JSON.stringify(this.errorList);
      }
    }

    var labelField = document.getElementById("BrowserErrorCollector-nb");
    labelField.nb = this.errorList.length;
    labelField.value = labelField.nb;
  },
  NetErrorListener: {
    onExamineResponse: function(httpChannel) {
      if (!httpChannel.requestSucceeded && httpChannel.responseStatus >= 400) {
        BrowserErrorCollector.updateError(
                {
                  type: "HTTP Request",
                  responseStatus: httpChannel.responseStatus,
                  responseStatusText: httpChannel.responseStatusText,
                  requestMethod: httpChannel.requestMethod,
                  URI: httpChannel.URI.spec,
                  referrer: httpChannel.referrer
                }
        );
      }
    },
    observe: function(subject, topic, data) {
      switch (topic) {
        case 'http-on-examine-response':
          subject.QueryInterface(Components.interfaces.nsIHttpChannel);
          this.onExamineResponse(subject);
          break;       
      }
    }
  },
  JSErrorListener: {
    observe: function(consoleMessage)
    {
      if (document && consoleMessage)
      {
        // Try to convert the error to a script error
        try
        {
          var scriptError = consoleMessage.QueryInterface(Components.interfaces.nsIScriptError);

          var errorCategory = scriptError.category;
          var sourceName = scriptError.sourceName;
          if (sourceName.indexOf("about:") === 0 || sourceName.indexOf("chrome:") === 0) {
            return; // not interested in internal errors
          }

          // We're just looking for content JS errors (see https://developer.mozilla.org/en/XPCOM_Interface_Reference/nsIScriptError#Categories)
          if (errorCategory === "content javascript")
          {
            var fireBugConsole = null;
            // try to get content from Firebug's console if it exists
            try {
              if (window.Firebug && window.Firebug.currentContext) {
                var doc = Firebug.currentContext.getPanel("console").document;
                var logNodes = doc.querySelectorAll(".logRow > span");
                var consoleLines = [];
                for (var i = 0; i < logNodes.length; ++i) {
                  var logNode = logNodes[i];
                  if (!logNode.JSErrorCollector_extracted) {
                    consoleLines.push(logNodes[i].textContent);
                    logNode.JSErrorCollector_extracted = true;
                  }
                }

                fireBugConsole = consoleLines.join("\n");
              }
            } catch (e) {
              fireBugConsole = "Error extracting content of Firebug console: " + e.message;
            }
          
            BrowserErrorCollector.updateError(
                    {
                      type: "JavaScript",
                      errorMessage: scriptError.errorMessage,
                      sourceName: scriptError.sourceName,
                      lineNumber: scriptError.lineNumber
                    }
            );
          }
        }
        catch (exception)
        {
          // ignore
        }
      }

      return false;
    }
  }
};

window.addEventListener("load", function(e) {
  BrowserErrorCollector.onLoad(e);
}, false);

window.addEventListener("unload", function(e) {
  BrowserErrorCollector.onUnLoad(e);
}, false);
