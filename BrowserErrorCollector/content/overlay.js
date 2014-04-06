var BrowserErrorCollector = {
    observerService: null,
    consoleService: null,
    errorList: [],
    collectedErrors: {
        list: '[]',
        cleared: false,
        pump: function() {            
            return JSON.parse(this.list);
        },        
        clear: function() {
            this.list = '[]';
            this.cleared = true;
        },
        __exposedProps__: {
            list: "r",
            pump: "r",
            clear: "r",
            cleared: "rw"
        }
    },
    onLoad: function(event) {
        this.initialize();
        this.initialized = true;

        var windowContent = window.getBrowser();
        windowContent.addEventListener("load", this.onBrowserPageLoad, true);
    },
    onUnLoad: function(event) {
        // initialization code
        this.initialized = false;

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
            if (contentWindow) {
                if (contentWindow.wrappedJSObject.BrowserErrorCollector_errors && contentWindow.wrappedJSObject.BrowserErrorCollector_errors.cleared) {
                    this.clearErrors();
                    BrowserErrorCollector.collectedErrors.cleared = false;
                    contentWindow.wrappedJSObject.BrowserErrorCollector_errors.cleared = false;
                    console.log("Cleared errors after reload");
                }
                
                contentWindow.wrappedJSObject.BrowserErrorCollector_errors = BrowserErrorCollector.collectedErrors;
                contentWindow.wrappedJSObject.BrowserErrorCollector_errors.list = JSON.stringify(BrowserErrorCollector.errorList);
            }
        }
    },
    addError: function(error) {
        this.errorList.push(error);

        var labelField = document.getElementById("BrowserErrorCollector-nb");
        labelField.nb = labelField.nb || 0;
        labelField.nb++;
        labelField.value = labelField.nb;
        
        var browser = window.getBrowser();
        if (browser) {
            var contentWindow = browser.selectedBrowser.contentWindow;
            if (contentWindow) {
                if (contentWindow.wrappedJSObject.BrowserErrorCollector_errors.cleared) {
                    contentWindow.wrappedJSObject.BrowserErrorCollector_errors.cleared = false;
                    this.clearErrors();
                    this.errorList = [ error ];
                    console.log("Cleared errors after clear");
                }
                contentWindow.wrappedJSObject.BrowserErrorCollector_errors.list = JSON.stringify(this.errorList);
            }
        }   
    },
    clearErrors: function() {
        this.errorList.clear();

        var labelField = document.getElementById("BrowserErrorCollector-nb");
        labelField.nb = 0;
        labelField.value = labelField.nb;
    },
    NetErrorListener: {
        onExamineResponse: function(httpChannel) {
            if (!httpChannel.requestSucceeded && httpChannel.responseStatus >= 400) {
                BrowserErrorCollector.addError(
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
        onExamineMergedResponse: function(httpChannel) {
            if (!httpChannel.requestSucceeded && httpChannel.responseStatus >= 400) {
                BrowserErrorCollector.addError(
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
                case 'http-on-examine-merged-response':
                    subject.QueryInterface(Components.interfaces.nsIHttpChannel);
                    this.onExamineMergedResponse(subject);
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
                        var console = null;
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

                                console = consoleLines.join("\n");
                            }
                        } catch (e) {
                            console = "Error extracting content of Firebug console: " + e.message;
                        }

                        BrowserErrorCollector.addError(
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
