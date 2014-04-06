# BrowserErrorCollector

Collect runtime Javascript and Network errors during Selenium tests. Currently only supports Firefox. Usable for all developing languages that support Selenium WebDriver.
This could also work on other frameworks that allow JavaScript structures to be passed back to the framework.

## Usage

1. Add the xpi file to Firefox profile during initialisation of your test suite
2. Let your tests run
3. At the end check for errors by executing Javascript in the browser through Selenium WebDriver:
        `return BrowserErrorCollector.pump();`
4. Parse the list and handle the results

## Error reporting structure

Occurred errors will be exported in a JavaScript object.

### Request errors

Only requests that produce status code with 400 or higher are reported.

`{
    type: "HTTP Request",
    responseStatus: 404,
    responseStatusText: "Not Found",
    requestMethod: "GET",
    spec: "http://localhost/invalid.png",
    referrer: "http://localhost/"
}`

### JavaScript errors

`{
    type: "JavaScript",
    errorMessage: "",
    sourceName: "script.js",
    lineNumber: 1,
    console: console
}`
	
## Thanks

Thanks to mguillem for creating JSErrorCollector. This project is very much based on JSErrorCollector (https://github.com/mguillem/JSErrorCollector).

## Modifying the extension

If you want to make changes to the extension, you can just zip the entire BrowserErrorCollector folder and name it BrowserErrorCollector.xpi. Then load the xpi file as an extension in Mozilla Firefox.