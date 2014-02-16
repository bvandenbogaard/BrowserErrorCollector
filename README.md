BrowserErrorCollector
=====================

Collect runtime Javascript and Network errors during Selenium tests. Currently only supports Firefox. Usable for all developing languages that support Selenium WebDriver.

Usage
=====

1. Add the xpi file to Firefox profile during initialisation of your test suite
2. Let your tests run
3. At the end check for errors by executing Javascript in the browser through Selenium WebDriver:

`return BrowserErrorCollector.collectedErrors.pump();`

4. Parse the list and handle the results
	
Thanks
======

Thanks to mguillem for creating JSErrorCollector. This project is very much based on JSErrorCollector (https://github.com/mguillem/JSErrorCollector).