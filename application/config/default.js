/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

'use strict';

var MIDlet = {
  name: "aMIDlet",

  SMSDialogVerificationText: "This app sent you an SMS. Type the message you received here:",
  SMSDialogTimeout: 300000, // Five minutes
  SMSDialogTimeoutText: "left",
  SMSDialogReceiveFilter: function(message) {
    return message;
  },

  wakeUpAlarm: 60000, // ms, i.e. 60 seconds
  // For some MIDlets, we use a heuristic to guess when the background alarm
  // should be started (for example, in messaging applications, we try to guess
  // when the user is registered to the service).
  // Note that this function is only called if the MIDlet has the
  // Nokia-MIDlet-bg-server property in its manifest, so, even if it returns true,
  // MIDlets that don't have this property will never be started in the background.
  shouldStartBackgroundService: function() {
    return true;
  },
};

var config = {
  main: "com/sun/midp/main/MIDletSuiteLoader",

  // Ignored files are files that always exist and are empty, so we discard
  // writes to them and return no data from reads.  It's useful for log files
  // to which midlets write frequently but never read.  Specify one by adding
  // the string pathname to the set via config.ignoredFiles.add().
  ignoredFiles: new Set(),
  invokeThreshold: 10,
  backwardBranchThreshold: 10
};

// The base directory of the app, relative to the current page.  Normally this
// is the directory from which the page was loaded, but some test pages load
// from a subdirectory, like tests/fs/, and they set this accordingly, so code
// that loads files, like libs/fs-init.js, can load them from the right place.
var APP_BASE_DIR = "./";
/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

// Instead of being loaded directly, this is appended to config/default.js
// by package.sh at `make app` build time, so it only applies when the app
// is loaded as an open web app.

config.autosize = "1";
config.logConsole = "web";
