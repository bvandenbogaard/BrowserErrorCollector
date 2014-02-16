var BrowserErrorCollector = {
    observerService: null,
    consoleService: null,
    collectedErrors: {
        list: [],
        push: function(error) {
            this.list[this.list.length] = error;
        },
        pump: function() {
            var resp = [];
            for (var i = 0; i < this.list.length; ++i) {
                resp[i] = this.list[i];
            }
            this.clear();

            return resp;
        },
        toString: function() {
            var s = "";
            for (var i = 0; i < this.list.length; ++i) {
                s += i + ": " + this.list[i] + "\n";
            }
            return s;
        },
        clear: function() {
            this.list = [];
        },
        __exposedProps__: {pump: "r"}
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
        var doc = event.originalTarget;
        var win = doc.defaultView;
        if (win) {
            win.wrappedJSObject.BrowserErrorCollector_errors = BrowserErrorCollector.collectedErrors;
        }
    },
    addError: function(error) {
        this.collectedErrors.push(error);

        var labelField = document.getElementById("BrowserErrorCollector-nb");
        labelField.nb = labelField.nb || 0;
        labelField.nb++;
        labelField.value = labelField.nb;
    },
    clearErrors: function() {
        this.collectedErrors.clear();

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
                            spec: httpChannel.spec,
                            referrer: httpChannel.referrer,
                            httpChannel: httpChannel
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
                            spec: httpChannel.spec,
                            referrer: httpChannel.referrer,
                            httpChannel: httpChannel
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
                                lineNumber: scriptError.lineNumber,
                                console: console
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
