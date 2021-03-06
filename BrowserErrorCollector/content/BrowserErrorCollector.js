var BrowserErrorCollector = {
  observerService: null,
  consoleService: null,
  errorList: [],
  collectedErrors: {
    list: '[]',
    __exposedProps__: {
      list: 'rw'
    }
  },
  onLoad: function() {
    this.initialize();
    
    gBrowser.addEventListener('load', this.onContentLoad, true);
  },
  onUnLoad: function() {
    gBrowser.removeEventListener('load', this.onContentLoad, true);
    
    this.dispose();
  },
  initialize: function() {
    console.log('BrowserErrorCollector initializing');
    this.observerService = Components.classes['@mozilla.org/observer-service;1'].getService(Components.interfaces.nsIObserverService);

    if (this.observerService)
    {
      this.observerService.addObserver(this.NetErrorListener, 'http-on-examine-response', false);
    }

    this.consoleService = Components.classes['@mozilla.org/consoleservice;1'].getService().QueryInterface(Components.interfaces.nsIConsoleService);
    if (this.consoleService)
    {
      this.consoleService.registerListener(this.JSErrorListener);
    }

    console.log('BrowserErrorCollector initialized');
  },
  dispose: function() {
    console.log('BrowserErrorCollector disposing');
    if (this.observerService)
    {
      this.observerService.removeObserver(this.NetErrorListener, 'http-on-examine-response', false);
    }

    if (this.consoleService)
    {
      this.consoleService.unregisterListener(this.JSErrorListener);
    }

    this.observerService = null;
    this.consoleService = null;
  },
  onContentLoad: function(event) {
    var doc = event.originalTarget;
      
    if (doc instanceof HTMLDocument) {
        if (doc.defaultView.frameElement) {
            if (window.content && !window.content.wrappedJSObject.BrowserErrorCollector) {
                console.log('New page loaded, initializing error list');
                window.content.wrappedJSObject.BrowserErrorCollector = this.collectedErrors;
            }
        }
    }
  },
  updateError: function(error) {
    if (window.content) {
      if (error) {
        this.errorList.push(error);
      }
      window.content.wrappedJSObject.BrowserErrorCollector = this.collectedErrors;
      window.content.wrappedJSObject.BrowserErrorCollector.list = JSON.stringify(this.errorList);
    }
  },
  NetErrorListener: {
    onExamineResponse: function(httpChannel) {
      if (!httpChannel.requestSucceeded && httpChannel.responseStatus >= 400) {
        BrowserErrorCollector.updateError(
                {
                  type: 'HTTP Request',                  
                  responseStatus: httpChannel.responseStatus,
                  responseStatusText: httpChannel.responseStatusText,
                  requestMethod: httpChannel.requestMethod,
                  URI: httpChannel.URI.spec,
                  referrer: httpChannel.referrer.spec
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
          if (sourceName.indexOf('about:') === 0 || sourceName.indexOf('chrome:') === 0) {
            return; // not interested in internal errors
          }

          // We're just looking for content JS errors (see https://developer.mozilla.org/en/XPCOM_Interface_Reference/nsIScriptError#Categories)
          if (errorCategory === 'content javascript')
          {
            var fireBugConsole = null;
            // try to get content from Firebug's console if it exists
            try {
              if (window.Firebug && window.Firebug.currentContext) {
                var doc = Firebug.currentContext.getPanel('console').document;
                var logNodes = doc.querySelectorAll('.logRow > span');
                var consoleLines = [];
                for (var i = 0; i < logNodes.length; ++i) {
                  var logNode = logNodes[i];
                  if (!logNode.JSErrorCollector_extracted) {
                    consoleLines.push(logNodes[i].textContent);
                    logNode.JSErrorCollector_extracted = true;
                  }
                }

                fireBugConsole = consoleLines.join('\n');
              }
            } catch (e) {
              fireBugConsole = 'Error extracting content of Firebug console: ' + e.message;
            }
          
            BrowserErrorCollector.updateError(
                    {
                      type: 'JavaScript',
                      errorMessage: scriptError.errorMessage,
                      sourceName: scriptError.sourceName,
                      lineNumber: scriptError.lineNumber,
                      URI: window.content.location.href
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

window.addEventListener('load', function(e) {
  BrowserErrorCollector.onLoad(e);
}, false);

window.addEventListener('unload', function(e) {
  BrowserErrorCollector.onUnLoad(e);
}, false);