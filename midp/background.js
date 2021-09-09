/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

'use strict';

var fgMidletNumber;
var fgMidletClass;

var display = document.getElementById("display");

// The splash and download screens generate many style recalculations while
// attached to the DOM, regardless of their display styles, because of their
// animations.  So instead of setting their display styles, we add/remove them
// to/from the DOM.

var splashScreen = document.getElementById('splash-screen');
display.removeChild(splashScreen);
splashScreen.style.display = 'block';
function showSplashScreen() {
  display.appendChild(splashScreen);
}
function hideSplashScreen() {
  if (splashScreen.parentNode) {
    splashScreen.parentNode.removeChild(splashScreen);
  }
}

var downloadDialog = document.getElementById('download-screen');
display.removeChild(downloadDialog);
downloadDialog.style.display = 'block';
function showDownloadScreen() {
  display.appendChild(downloadDialog);
}
function hideDownloadScreen() {
  if (downloadDialog.parentNode) {
    downloadDialog.parentNode.removeChild(downloadDialog);
  }
}

// The exit screen is hidden by default, and we only ever show it,
// so we don't need a hideExitScreen function.
function showExitScreen() {
  document.getElementById("exit-screen").style.display = "block";
}

function backgroundCheck() {
  var bgServer = MIDP.manifest["Nokia-MIDlet-bg-server"];
  if (!bgServer) {
    showSplashScreen();
    return;
  }

  // We're assuming there are only two midlets
  fgMidletNumber = (bgServer == 2) ? 1 : 2;
  fgMidletClass = MIDP.manifest["MIDlet-" + fgMidletNumber].split(",")[2];

  if (MIDlet.shouldStartBackgroundService()) {
    startBackgroundAlarm();
  }
}

var backgroundAlarmStarted = false;

function startBackgroundAlarm() {
  if (!backgroundAlarmStarted) {
    backgroundAlarmStarted = true;
    DumbPipe.close(DumbPipe.open("backgroundCheck", {}));
  }
}

Native["com/nokia/mid/s40/bg/BGUtils.getFGMIDletClass.()Ljava/lang/String;"] = function(addr) {
  return J2ME.newString(fgMidletClass);
};

Native["com/nokia/mid/s40/bg/BGUtils.getFGMIDletNumber.()I"] = function(addr) {
  return fgMidletNumber;
};

MIDP.additionalProperties = {};

Native["com/nokia/mid/s40/bg/BGUtils.launchIEMIDlet.(Ljava/lang/String;Ljava/lang/String;ILjava/lang/String;Ljava/lang/String;)Z"] =
function(addr, midletSuiteVendorAddr, midletNameAddr, midletNumber, startupNoteTextAddr, argsAddr) {
  J2ME.fromStringAddr(argsAddr).split(";").splice(1).forEach(function(arg) {
    var elems = arg.split("=");
    MIDP.additionalProperties[elems[0]] = elems[1];
  });

  return 1;
};
