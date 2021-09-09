/* -*- Mode: JavaScript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

'use strict';

var MIDP = (function() {
  var deviceCanvas = document.getElementById("canvas");
  var deviceContext = deviceCanvas.getContext("2d");

  // The foreground isolate will get the user events (keypresses, etc.)
  var FG = (function() {
    var isolateId = -1;
    var displayId = -1;
    var isValid = false;

    function reset() {
      isValid = false;
    }

    function set(i, d) {
      isolateId = i;
      displayId = d;
      isValid = true;
    }

    function sendNativeEventToForeground(e, shouldIncludeDisplayId) {
      if (!isValid) {
        return;
      }

      if (shouldIncludeDisplayId) {
        e.intParam4 = displayId;
      }

      sendNativeEvent(e, isolateId);
    }

    function isFGDisplay(d) {
      return isValid && displayId === d;
    }

    function isFullscreen() {
      return !isValid || FullscreenInfo.isFullscreen(displayId);
    }

    return {
      reset: reset,
      set: set,
      sendNativeEventToForeground: sendNativeEventToForeground,
      isFullscreen: isFullscreen,
      isFGDisplay: isFGDisplay,
    }
  })();

  var FullscreenInfo = (function() {
    var map = new Map();

    function set(id, isFullscreen) {
      var oldVal = map.get(id);
      if (oldVal === isFullscreen) {
        return;
      }

      map.set(id, isFullscreen);
      if (FG.isFGDisplay(id)) {
        updateCanvas();
      }
    }

    function isFullscreen(id) {
      return (0 !== map.get(id));
    }

    return {
      set: set,
      isFullscreen: isFullscreen,
    }
  })();

  function updatePhysicalScreenSize() {
    if (!config.autosize || /no|0/.test(config.autosize)) {
      physicalScreenWidth = document.getElementById('display').clientWidth;
      physicalScreenHeight = document.getElementById('display').clientHeight;
    }
  }

  function updateCanvas() {
    var sidebar = document.getElementById("sidebar");
    var header = document.getElementById("drawer").querySelector("header");
    var isFullscreen = FG.isFullscreen();
    sidebar.style.display = header.style.display =
        isFullscreen ? "none" : "block";
    var headerHeight = isFullscreen ? 0 : header.offsetHeight;
    var newHeight = physicalScreenHeight - headerHeight;
    var newWidth = physicalScreenWidth;

    if (newHeight != deviceCanvas.height || newWidth != deviceCanvas.width) {
      deviceCanvas.height = newHeight;
      deviceCanvas.width = newWidth;
      deviceCanvas.style.height = deviceCanvas.height + "px";
      deviceCanvas.style.width = deviceCanvas.width + "px";
      deviceCanvas.style.top = headerHeight + "px";
      deviceCanvas.dispatchEvent(new Event("canvasresize"));
    }
  };

  function onWindowResize(evt) {
    var newPhysicalScreenWidth = window.outerWidth - horizontalChrome;
    var newPhysicalScreenHeight = window.outerHeight - verticalChrome;

    if (newPhysicalScreenWidth != physicalScreenWidth || newPhysicalScreenHeight != physicalScreenHeight) {
      physicalScreenWidth = newPhysicalScreenWidth;
      physicalScreenHeight = newPhysicalScreenHeight;
      lastWindowInnerHeight = window.innerHeight;
      updateCanvas();
    } else if (lastWindowInnerHeight != window.innerHeight) {
      lastWindowInnerHeight = window.innerHeight;
      sendVirtualKeyboardEvent();
    } else {
      console.warn("Unhandled resize event!");
    }
  };

  var manifest = {};

  Native["com/sun/midp/lcdui/DisplayDevice.setFullScreen0.(IIZ)V"] = function(addr, hardwareId, displayId, mode) {
    FullscreenInfo.set(displayId, mode);
  };

  Native["com/sun/midp/log/LoggingBase.report.(IILjava/lang/String;)V"] =
  function(addr, severity, channelID, messageAddr) {
    console.info(J2ME.fromStringAddr(messageAddr));
  };

  Native["com/sun/midp/midlet/MIDletPeer.platformRequest.(Ljava/lang/String;)Z"] = function(addr, requestAddr) {
    request = J2ME.fromStringAddr(requestAddr);
    if (request.startsWith("http://") || request.startsWith("https://")) {
      if (request.endsWith(".jad")) {
        // The download will start after the MIDlet has terminated its execution.
        pendingMIDletUpdate = request;
        return 1;
      } else {
        DumbPipe.close(DumbPipe.open("windowOpen", request));
      }
    } else if (request.startsWith("x-contacts:add?")) {
      var params = {};

      var args = request.substring(request.indexOf("?") + 1).split("&");
      args.forEach(function(arg) {
        var numberIdx = arg.indexOf("number=");
        if (numberIdx != -1) {
          params.tel = arg.substring(numberIdx + 7);
        }
      });

      DumbPipe.close(DumbPipe.open("mozActivity", {
        name: "new",
        data: {
          type: "webcontacts/contact",
          params: params,
        },
      }));
    } else {
      console.warn("com/sun/midp/main/CldcPlatformRequest.dispatchPlatformRequest.(Ljava/lang/String;)Z not implemented for: " + request);
    }

    return 0;
  };

  Native["com/sun/midp/main/CommandState.restoreCommandState.(Lcom/sun/midp/main/CommandState;)V"] =
  function(addr, stateAddr) {
    var state = getHandle(stateAddr);
    var suiteId = (config.midletClassName === "internal") ? -1 : 1;
    state.suiteId = suiteId;
    state.midletClassName = J2ME.newString(config.midletClassName);
    var args = config.args;
    state.arg0 = J2ME.newString((args.length > 0) ? args[0] : "");
    state.arg1 = J2ME.newString((args.length > 1) ? args[1] : "");
    state.arg2 = J2ME.newString((args.length > 2) ? args[2] : "");
  };

  Native["com/sun/midp/main/MIDletSuiteUtils.getIsolateId.()I"] = function(addr) {
    return $.ctx.runtime.isolateId;
  };

  var AMS = (function() {
    var isolateId = -1;

    function set(id) {
      isolateId = id;
    }

    function reset() {
      isolateId = -1;
    }

    function get() {
      return isolateId;
    }

    function isAMSIsolate(id) {
      return (id === isolateId);
    }

    function sendNativeEventToAMSIsolate(e) {
      if (-1 === isolateId) {
        console.warn("Dropping native event sent to AMS isolate");
        return;
      }

      sendNativeEvent(e, isolateId);
    }

    return {
      set: set,
      get: get,
      reset: reset,
      isAMSIsolate: isAMSIsolate,
      sendNativeEventToAMSIsolate: sendNativeEventToAMSIsolate,
    }
  })();

  Native["com/sun/midp/main/MIDletSuiteUtils.registerAmsIsolateId.()V"] = function(addr) {
    AMS.set($.ctx.runtime.isolateId);
  };

  Native["com/sun/midp/main/MIDletSuiteUtils.getAmsIsolateId.()I"] = function(addr) {
    return AMS.get();
  };

  Native["com/sun/midp/main/MIDletSuiteUtils.isAmsIsolate.()Z"] = function(addr) {
    return AMS.isAMSIsolate($.ctx.runtime.isolateId) ? 1 : 0;
  };

  // This function is called before a MIDlet is created (in MIDletStateListener::midletPreStart).
  var loadingMIDletPromisesResolved = false;
  Native["com/sun/midp/main/MIDletSuiteUtils.vmBeginStartUp.(I)V"] = function(addr, midletIsolateId) {
    if (loadingMIDletPromisesResolved) {
      return;
    }

    loadingMIDletPromisesResolved = true;

    asyncImpl("V", Promise.all(loadingMIDletPromises));
  };

  Native["com/sun/midp/main/MIDletSuiteUtils.vmEndStartUp.(I)V"] = function(addr, midletIsolateId) {
  };

  Native["com/sun/midp/main/Configuration.getProperty0.(Ljava/lang/String;)Ljava/lang/String;"] =
  function(addr, keyAddr) {
    var key = J2ME.fromStringAddr(keyAddr);
    var value;
    switch (key) {
      case "com.sun.midp.publickeystore.WebPublicKeyStore":
        if (config.midletClassName == "RunTestsMIDlet" ||
            config.midletClassName.startsWith("benchmark")) {
          value = "_test.ks";
        } else {
          value = "_main.ks";
        }
        break;
      case "com.sun.midp.events.dispatchTableInitSize":
        value = "71";
        break;
      case "microedition.locale":
        value = navigator.language;
        break;
      case "datagram":
        value = "com.sun.midp.io.j2me.datagram.ProtocolPushImpl";
        break;
      case "com.sun.midp.io.j2me.socket.buffersize":
        value = null;
        break;
      case "com.sun.midp.io.http.proxy":
        value = null;
        break;
      case "com.sun.midp.io.http.force_non_persistent":
        value = null;
        break;
      case "com.sun.midp.io.http.max_persistent_connections":
        value = null;
        break;
      case "com.sun.midp.io.http.persistent_connection_linger_time":
        value = null;
        break;
      case "com.sun.midp.io.http.input_buffer_size":
        value = null;
        break;
      case "com.sun.midp.io.http.output_buffer_size":
        value = null;
        break;
      default:
        console.warn("UNKNOWN PROPERTY (com/sun/midp/main/Configuration): " + key);
        value = null;
        break;
    }
    return J2ME.newString(value);
  };

  Native["com/sun/midp/util/ResourceHandler.loadRomizedResource0.(Ljava/lang/String;)[B"] = function(addr, fileAddr) {
    var fileName = "assets/0/" +
                   J2ME.fromStringAddr(fileAddr).replace("_", ".").replace("_png", ".png").replace("_raw", ".raw");
    var data = JARStore.loadFile(fileName);
    if (!data) {
      console.warn("ResourceHandler::loadRomizedResource0: file " + fileName + " not found");
      return J2ME.Constants.NULL;
    }
    var len = data.byteLength;
    var arrayAddr = J2ME.newByteArray(len);
    var array = J2ME.getArrayFromAddr(arrayAddr);
    for (var n = 0; n < len; ++n) {
      array[n] = data[n];
    }
    return arrayAddr;
  };

  var verticalChrome;
  var horizontalChrome;
  var physicalScreenWidth;
  var physicalScreenHeight;
  var lastWindowInnerHeight;
  var isVKVisible;

  if (config.autosize && !/no|0/.test(config.autosize)) {
    document.documentElement.classList.add('autosize');

    // Chrome amounts:
    //   The difference between the outer[Height|Width] and the actual
    //   amount of space we have available. So far, horizontalChrome is
    //   always 0 and verticalChrome is always the size of the status bar,
    //   which has been 30px in testing. These are assumed to be static
    //   throughout the lifetime of the app, and things will break if that
    //   assumption is violated.
    verticalChrome = window.outerHeight - window.innerHeight;
    horizontalChrome = window.outerWidth - window.innerWidth;

    // "Physical" dimensions:
    //   The amount of space available to J2ME. This is always the
    //   outer[Height|Width] minus the [vertical|horizontal]Chrome amount.
    //
    //   Note that these values will not always equal the size of our window.
    //   Specifically, when the FxOS keyboard is visible, the window shrinks,
    //   so `window.inner[Height|Width]` will be
    //   smaller than these values. J2ME apps expect that the keyboard
    //   overlaps the window rather than squishing it, so we simulate that
    //   by keeping track of these "physical" values.
    //
    //   Note also that these values do not take into account the size of
    //   the header, which might shrink our canvas. To find out how much
    //   space is actually available to the current MIDlet, check
    //   `document.getElementById("canvas").[width|height]`.
    physicalScreenWidth = window.outerWidth - horizontalChrome;
    physicalScreenHeight = window.outerHeight - verticalChrome;

    // Cached value of `window.innerHeight` so that we can tell when it
    // changes. This is useful for determining when to send keyboard
    // visibility events.
    lastWindowInnerHeight = window.innerHeight;

    updateCanvas();
    isVKVisible = function() {
      var expectedHeightWithNoKeyboard = window.outerHeight - verticalChrome;
      if (window.innerHeight == expectedHeightWithNoKeyboard) {
        return false;
      } else if (window.innerHeight < expectedHeightWithNoKeyboard) {
        return true;
      } else {
        console.warn("window is taller than expected in isVKVisible!");
        return false;
      }
    };
    window.addEventListener("resize", onWindowResize);
  } else {
    document.documentElement.classList.add('debug-mode');
    physicalScreenWidth = document.getElementById('display').clientWidth;
    physicalScreenHeight = document.getElementById('display').clientHeight;

    updateCanvas();
    isVKVisible = function() {
      return false;
    };
  }

  function sendPenEvent(pt, whichType) {
    FG.sendNativeEventToForeground({
      type: PEN_EVENT,
      intParam1: whichType,
      intParam2: pt.x,
      intParam3: pt.y,
    }, true);
  }

  function sendGestureEvent(pt, distancePt, whichType, aFloatParam1, aIntParam7, aIntParam8, aIntParam9) {
    FG.sendNativeEventToForeground({
      type: GESTURE_EVENT,
      intParam1: whichType,
      intParam2: distancePt && distancePt.x || 0,
      intParam3: distancePt && distancePt.y || 0,
      intParam5: pt.x,
      intParam6: pt.y,
      floatParam1: Math.fround(aFloatParam1 || 0.0),
      intParam7: aIntParam7 || 0,
      intParam8: aIntParam8 || 0,
      intParam9: aIntParam9 || 0,
      intParam10: 0,
      intParam11: 0,
      intParam12: 0,
      intParam13: 0,
      intParam14: 0,
      intParam15: 0,
      intParam16: 0
    }, true);
  }

  // In the simulator and on device, use touch events; in desktop
  // mode, we must use mouse events (unless you enable touch events
  // in devtools).
  var supportsTouch = ("ontouchstart" in document.documentElement);

  // Cache the canvas position for future computation.
  var canvasRect = deviceCanvas.getBoundingClientRect();
  deviceCanvas.addEventListener("canvasresize", function() {
    canvasRect = deviceCanvas.getBoundingClientRect();
    sendRotationEvent();
  });

  function getEventPoint(event) {
    var item = ((event.touches && event.touches[0]) || // touchstart, touchmove
        (event.changedTouches && event.changedTouches[0]) || // touchend
        event); // mousedown, mouseup, mousemove
    return {
      x: item.pageX - (canvasRect.left | 0),
      y: item.pageY - (canvasRect.top | 0)
    };
  }

  // Input Handling: Some MIDlets (usually older ones) respond to
  // "pen" events; others respond to "gesture" events. We must fire
  // both. A distance threshold ensures that touches with an "intent
  // to tap" will likely result in a tap.

  var LONG_PRESS_TIMEOUT = 1000;
  var MIN_DRAG_DISTANCE_SQUARED = 5 * 5;
  var mouseDownInfo = null;
  var longPressTimeoutID = null;
  var longPressDetected = false;

  deviceCanvas.addEventListener(supportsTouch ? "touchstart" : "mousedown", function(event) {
    event.preventDefault(); // Prevent unnecessary fake mouse events.
    var pt = getEventPoint(event);
    sendPenEvent(pt, PRESSED);
    mouseDownInfo = pt;

    longPressDetected = false;
    longPressTimeoutID = setTimeout(function() {
      longPressDetected = true;
      sendGestureEvent(pt, null, GESTURE_LONG_PRESS);
    }, LONG_PRESS_TIMEOUT);
  });

  deviceCanvas.addEventListener(supportsTouch ? "touchmove" : "mousemove", function(event) {
    if (!mouseDownInfo) {
      return; // Mousemove on desktop; ignored.
    }
    event.preventDefault();

    if (longPressTimeoutID) {
      clearTimeout(longPressTimeoutID);
      longPressTimeoutID = null;
    }

    var pt = getEventPoint(event);
    sendPenEvent(pt, DRAGGED);
    var distance = {
      x: pt.x - mouseDownInfo.x,
      y: pt.y - mouseDownInfo.y
    };
    // If this gesture is dragging, or we've moved a substantial
    // amount since the original "down" event, begin or continue a
    // drag event. Using squared distance to avoid needing sqrt.
    if (mouseDownInfo.isDragging || (distance.x * distance.x + distance.y * distance.y > MIN_DRAG_DISTANCE_SQUARED)) {
      mouseDownInfo.isDragging = true;
      mouseDownInfo.x = pt.x;
      mouseDownInfo.y = pt.y;
      if (!longPressDetected) {
        sendGestureEvent(pt, distance, GESTURE_DRAG);
      }
    }

    // Just store the dragging event info here, then calc the speed and
    // determine whether the gesture is GESTURE_DROP or GESTURE_FLICK in
    // the mouseup event listener.
    if (!mouseDownInfo.draggingPts) {
      mouseDownInfo.draggingPts = [];
    }

    // Only store the latest two drag events.
    if (mouseDownInfo.draggingPts.length > 1) {
      mouseDownInfo.draggingPts.shift();
    }

    mouseDownInfo.draggingPts.push({
      pt: getEventPoint(event),
      time: new Date().getTime()
    });
  });

  function calcFlickSpeed() {
    var currentDragPT = mouseDownInfo.draggingPts[1];
    var lastDragPT = mouseDownInfo.draggingPts[0];

    var deltaX = currentDragPT.pt.x - lastDragPT.pt.x;
    var deltaY = currentDragPT.pt.y - lastDragPT.pt.y;
    var deltaTimeInMs = currentDragPT.time - lastDragPT.time;

    var speedX = Math.round(deltaX * 1000 / deltaTimeInMs);
    var speedY = Math.round(deltaY * 1000 / deltaTimeInMs);
    var speed  = Math.round(Math.sqrt(speedX * speedX + speedY * speedY));

    var direction = 0;
    if (deltaX >= 0 && deltaY >=0) {
      direction = Math.atan(deltaY / deltaX);
    } else if (deltaX < 0 && deltaY >= 0) {
      direction = Math.PI + Math.atan(deltaY / deltaX);
    } else if (deltaX < 0 && deltaY < 0) {
      direction = Math.atan(deltaY / deltaX) - Math.PI;
    } else if (deltaX >= 0 && deltaY < 0) {
      direction = Math.atan(deltaY / deltaX);
    }

    return {
      direction: direction,
      speed: speed,
      speedX: speedX,
      speedY: speedY
    };
  }

  // The end listener goes on `document` so that we properly detect touchend/mouseup anywhere.
  document.addEventListener(supportsTouch ? "touchend" : "mouseup", function(event) {
    if (!mouseDownInfo) {
      return; // Touchstart wasn't on the canvas.
    }
    event.preventDefault();

    if (longPressTimeoutID) {
      clearTimeout(longPressTimeoutID);
      longPressTimeoutID = null;
    }

    var pt = getEventPoint(event);
    sendPenEvent(pt, RELEASED);

    if (!longPressDetected) {
      if (mouseDownInfo.isDragging) {
        if (mouseDownInfo.draggingPts && mouseDownInfo.draggingPts.length == 2) {
          var deltaTime = new Date().getTime() - mouseDownInfo.draggingPts[1].time;
          var flickSpeed = calcFlickSpeed();
          // On the real Nokia device, if user touch on the screen and
          // move the finger, then stop moving for a while and lift
          // the finger, it will trigger a normal GESTURE_DROP instead
          // of GESTURE_FLICK event, so let's check if the time gap
          // between touchend event and the last touchmove event is
          // larger than a threshold.
          if (deltaTime > 300 || flickSpeed.speed == 0) {
            sendGestureEvent(pt, null, GESTURE_DROP);
          } else {
            sendGestureEvent(pt, null, GESTURE_FLICK,
                             flickSpeed.direction,
                             flickSpeed.speed,
                             flickSpeed.speedX,
                             flickSpeed.speedY);
          }
        } else {
          sendGestureEvent(pt, null, GESTURE_DROP);
        }
      } else {
        sendGestureEvent(pt, null, GESTURE_TAP);
      }
    }

    mouseDownInfo = null; // Clear the way for the next gesture.
  });

  Native["com/sun/midp/midletsuite/MIDletSuiteStorage.suiteIdToString.(I)Ljava/lang/String;"] = function(addr, id) {
    return J2ME.newString(id.toString());
  };

  Native["com/sun/midp/midletsuite/MIDletSuiteStorage.getMidletSuiteStorageId.(I)I"] = function(addr, suiteId) {
    // We should be able to use the same storage ID for all MIDlet suites.
    return 0; // storageId
  };

  Native["com/sun/midp/midletsuite/MIDletSuiteImpl.lockMIDletSuite.(IZ)V"] = function(addr, id, lock) {
    console.warn("MIDletSuiteImpl.lockMIDletSuite.(IZ)V not implemented (" + id + ", " + lock + ")");
  };

  Native["com/sun/midp/midletsuite/MIDletSuiteImpl.unlockMIDletSuite.(I)V"] = function(addr, suiteId) {
    console.warn("MIDletSuiteImpl.unlockMIDletSuite.(I)V not implemented (" + suiteId + ")");
  };

  Native["com/sun/midp/midletsuite/InstallInfo.load.()V"] = function(addr) {
    var self = getHandle(addr);
    // The MIDlet has to be trusted for opening SSL connections using port 443.
    self.trusted = 1;
    console.warn("com/sun/midp/midletsuite/InstallInfo.load.()V incomplete");
  };

  Native["com/sun/midp/midletsuite/SuiteProperties.load.()[Ljava/lang/String;"] = function(addr) {
    var keys = Object.keys(manifest);
    var arrAddr = J2ME.newStringArray(keys.length * 2);
    J2ME.setUncollectable(arrAddr);
    var arr = J2ME.getArrayFromAddr(arrAddr);
    var i = 0;
    keys.forEach(function(key) {
      arr[i++] = J2ME.newString(key);
      arr[i++] = J2ME.newString(manifest[key]);
    });
    J2ME.unsetUncollectable(arrAddr);
    return arrAddr;
  };

  Native["javax/microedition/lcdui/SuiteImageCacheImpl.loadAndCreateImmutableImageDataFromCache0.(Ljavax/microedition/lcdui/ImageData;ILjava/lang/String;)Z"] =
  function(addr, imageDataAddr, suiteId, fileNameAddr) {
    // We're not implementing the cache because looks like it isn't used much.
    // In a MIDlet I've been testing for a few minutes, there's been only one hit.
    return 0;
  };

  var interIsolateMutexes = [];
  var lastInterIsolateMutexID = -1;

  Native["com/sun/midp/util/isolate/InterIsolateMutex.getID0.(Ljava/lang/String;)I"] = function(addr, mutexNameAddr) {
    var name = J2ME.fromStringAddr(mutexNameAddr);

    var mutex;
    for (var i = 0; i < interIsolateMutexes.length; i++) {
      if (interIsolateMutexes[i].name === name) {
        mutex = interIsolateMutexes[i];
      }
    }

    if (!mutex) {
      mutex = {
        name: name,
        id: ++lastInterIsolateMutexID,
        locked: false,
        waiting: [],
      };
      interIsolateMutexes.push(mutex);
    }

    return mutex.id;
  };

  Native["com/sun/midp/util/isolate/InterIsolateMutex.lock0.(I)V"] = function(addr, id) {
    var ctx = $.ctx;
    var isolateId = $.ctx.runtime.isolateId;

    var mutex;
    for (var i = 0; i < interIsolateMutexes.length; i++) {
      if (interIsolateMutexes[i].id == id) {
        mutex = interIsolateMutexes[i];
        break;
      }
    }

    if (!mutex) {
      throw $.newIllegalStateException("Invalid mutex ID");
    }

    if (!mutex.locked) {
      mutex.locked = true;
      mutex.holder = isolateId;
      return;
    }

    if (mutex.holder == isolateId) {
      throw $.newRuntimeException("Attempting to lock mutex twice within the same Isolate");
    }

    asyncImpl("V", new Promise(function(resolve, reject) {
      mutex.waiting.push(function() {
        mutex.locked = true;
        mutex.holder = isolateId;
        resolve();
      });
    }));
  };

  Native["com/sun/midp/util/isolate/InterIsolateMutex.unlock0.(I)V"] = function(addr, id) {
    var isolateId = $.ctx.runtime.isolateId;
    var mutex;
    for (var i = 0; i < interIsolateMutexes.length; i++) {
      if (interIsolateMutexes[i].id == id) {
        mutex = interIsolateMutexes[i];
        break;
      }
    }

    if (!mutex) {
      throw $.newIllegalStateException("Invalid mutex ID");
    }

    if (!mutex.locked) {
      throw $.newRuntimeException("Mutex is not locked");
    }

    if (mutex.holder !== isolateId) {
      throw $.newRuntimeException("Mutex is locked by different Isolate");
    }

    mutex.locked = false;

    var firstWaiting = mutex.waiting.shift();
    if (firstWaiting) {
      firstWaiting();
    }
  };

  function exit(code) {
    $.stop();
    DumbPipe.open("exit", null, function(message) {});
    showExitScreen();
  }

  // If the user kills the app willingly, we will close it.
  // In some cases instead we want to kill the FG MIDlet only
  // to restart it.
  var destroyedForRestart = false;
  function setDestroyedForRestart(val) {
    destroyedForRestart = val;
  }

  var destroyedListener = null;
  function registerDestroyedListener(func) {
    destroyedListener = func;
  }

  var pendingMIDletUpdate = null;
  Native["com/sun/cldc/isolate/Isolate.stop.(II)V"] = function(addr, code, reason) {
    // XXX According to Isolate.java, Isolate.id() should return -1 if an
    // isolate has been terminated, so we should set this._id to -1 here.

    // XXX Other com/sun/cldc/isolate/Isolate natives are in native.js.
    // We should move this one there or those here.

    if (destroyedForRestart) {
      destroyedForRestart = false;
      if (destroyedListener) {
        destroyedListener();
      }
      FG.reset();
      return;
    }

    var isolateId = $.ctx.runtime.isolateId;
    console.info("Isolate " + isolateId + " stops with code " + code + " and reason " + reason);

    if (AMS.isAMSIsolate(isolateId)) {
      AMS.reset();
    }

    if (!pendingMIDletUpdate) {
      exit();
      return;
    }

    // Perform updating.
    performDownload(pendingMIDletUpdate, function(data) {
      Promise.all([
        JARStore.installJAR("midlet.jar", data.jarData, data.jadData),
        CompiledMethodCache.clear(),
      ]).then(function() {
        pendingMIDletUpdate = null;
        DumbPipe.close(DumbPipe.open("alert", "Update completed!"));
        DumbPipe.close(DumbPipe.open("reload", {}));
      });
    });
  };

  var nativeEventQueues = {};
  var waitingNativeEventQueue = {};

  function copyEvent(e, obj) {
    obj.type = e.type || 0;
    obj.intParam1 = e.intParam1 || 0;
    obj.intParam2 = e.intParam2 || 0;
    obj.intParam3 = e.intParam3 || 0;
    obj.intParam4 = e.intParam4 || 0;
    obj.intParam5 = e.intParam5 || 0;
    obj.intParam6 = e.intParam6 || 0;
    obj.intParam7 = e.intParam7 || 0;
    obj.intParam8 = e.intParam8 || 0;
    obj.intParam9 = e.intParam9 || 0;
    obj.intParam10 = e.intParam10 || 0;
    obj.intParam11 = e.intParam11 || 0;
    obj.intParam12 = e.intParam12 || 0;
    obj.intParam13 = e.intParam13 || 0;
    obj.intParam14 = e.intParam14 || 0;
    obj.intParam15 = e.intParam15 || 0;
    obj.intParam16 = e.intParam16 || 0;
    obj.floatParam1 = e.floatParam1 || 0.0;
    obj.stringParam1 = J2ME.newString(e.stringParam1);
    obj.stringParam2 = J2ME.newString(e.stringParam2);
    obj.stringParam3 = J2ME.newString(e.stringParam3);
    obj.stringParam4 = J2ME.newString(e.stringParam4);
    obj.stringParam5 = J2ME.newString(e.stringParam5);
    obj.stringParam6 = J2ME.newString(e.stringParam6);
  }

  function sendNativeEvent(e, isolateId) {
    var elem = waitingNativeEventQueue[isolateId];
    if (!elem) {
      nativeEventQueues[isolateId].push(e);
      return;
    }

    copyEvent(e, elem.nativeEvent);
    elem.resolve(nativeEventQueues[isolateId].length);

    delete waitingNativeEventQueue[isolateId];
  }

  function sendVirtualKeyboardEvent() {
    FG.sendNativeEventToForeground({
      type: VIRTUAL_KEYBOARD_EVENT,
      intParam1: 0,
      intParam2: 0,
      intParam3: 0,
    }, true);
  }

  function sendRotationEvent() {
    FG.sendNativeEventToForeground({
      type: ROTATION_EVENT,
      intParam1: 0,
      intParam2: 0,
      intParam3: 0,
    }, true);
  }

  function sendCommandEvent(id) {
    FG.sendNativeEventToForeground({
      type: COMMAND_EVENT,
      intParam1: id,
      intParam2: 0,
      intParam3: 0,
    }, true);
  }

  function sendEndOfMediaEvent(pId, duration) {
    FG.sendNativeEventToForeground({
      type: MMAPI_EVENT,
      intParam1: pId,
      intParam2: duration,
      intParam3: 0,
      intParam4: Media.EVENT_MEDIA_END_OF_MEDIA
    }, false);
  }

  function sendMediaSnapshotFinishedEvent(pId) {
    FG.sendNativeEventToForeground({
      type: MMAPI_EVENT,
      intParam1: pId,
      intParam2: 0,
      intParam3: 0,
      intParam4: Media.EVENT_MEDIA_SNAPSHOT_FINISHED,
    }, false);
  }

  function sendExecuteMIDletEvent(midletNumber, midletClassName) {
    AMS.sendNativeEventToAMSIsolate({
      type: NATIVE_MIDLET_EXECUTE_REQUEST,
      intParam1: midletNumber || fgMidletNumber,
      stringParam1: midletClassName || fgMidletClass,
    });
  }

  function sendDestroyMIDletEvent(midletClassName) {
    FG.sendNativeEventToForeground({
      type: DESTROY_MIDLET_EVENT,
      stringParam1: midletClassName,
    }, false);
  }

  var KEY_EVENT = 1;
  var PEN_EVENT = 2;
  var PRESSED = 1;
  var RELEASED = 2;
  var DRAGGED = 3;
  var COMMAND_EVENT = 3;
  var NATIVE_MIDLET_EXECUTE_REQUEST = 36;
  var DESTROY_MIDLET_EVENT = 14;
  var EVENT_QUEUE_SHUTDOWN = 31;
  var ROTATION_EVENT = 43;
  var MMAPI_EVENT = 45;
  var VIRTUAL_KEYBOARD_EVENT = 58;
  var GESTURE_EVENT = 71;
  var GESTURE_TAP = 0x1;
  var GESTURE_LONG_PRESS = 0x2;
  var GESTURE_DRAG = 0x4;
  var GESTURE_DROP = 0x8;
  var GESTURE_FLICK = 0x10;
  var GESTURE_LONG_PRESS_REPEATED = 0x20;
  var GESTURE_PINCH = 0x40;
  var GESTURE_DOUBLE_TAP = 0x80;
  var GESTURE_RECOGNITION_START = 0x4000;
  var GESTURE_RECOGNITION_END = 0x8000;

  var suppressKeyEvents = false;

  function sendKeyPress(keyCode) {
    if (!suppressKeyEvents) {
      FG.sendNativeEventToForeground({
        type: KEY_EVENT,
        intParam1: PRESSED,
        intParam2: keyCode,
        intParam3: 0
      }, true);
    }
  }

  function sendKeyRelease(keyCode) {
    if (!suppressKeyEvents) {
      FG.sendNativeEventToForeground({
        type: KEY_EVENT,
        intParam1: RELEASED,
        intParam2: keyCode,
        intParam3: 0,
      }, true);
    }
  };

  window.addEventListener("keydown", function(ev) {
    sendKeyPress(ev.which);
  });

  window.addEventListener("keyup", function(ev) {
    sendKeyRelease(ev.which);
  });

  Native["com/sun/midp/events/EventQueue.getNativeEventQueueHandle.()I"] = function(addr) {
    return 0;
  };

  Native["com/sun/midp/events/EventQueue.resetNativeEventQueue.()V"] = function(addr) {
    nativeEventQueues[$.ctx.runtime.isolateId] = [];
  };

  Native["com/sun/midp/events/EventQueue.sendNativeEventToIsolate.(Lcom/sun/midp/events/NativeEvent;I)V"] =
    function(addr, eventAddr, isolateId) {
      var e = getHandle(eventAddr);

      var obj = {
        type: e.type,
        intParam1: e.intParam1,
        intParam2: e.intParam2,
        intParam3: e.intParam3,
        intParam4: e.intParam4,
        intParam5: e.intParam5,
        intParam6: e.intParam6,
        intParam7: e.intParam7,
        intParam8: e.intParam8,
        intParam9: e.intParam9,
        intParam10: e.intParam10,
        intParam11: e.intParam11,
        intParam12: e.intParam12,
        intParam13: e.intParam13,
        intParam14: e.intParam14,
        intParam15: e.intParam15,
        intParam16: e.intParam16,
        floatParam1: e.floatParam1,
        stringParam1: J2ME.fromStringAddr(e.stringParam1),
        stringParam2: J2ME.fromStringAddr(e.stringParam2),
        stringParam3: J2ME.fromStringAddr(e.stringParam3),
        stringParam4: J2ME.fromStringAddr(e.stringParam4),
        stringParam5: J2ME.fromStringAddr(e.stringParam5),
        stringParam6: J2ME.fromStringAddr(e.stringParam6),
      };

      sendNativeEvent(obj, isolateId);
    };

  Native["com/sun/midp/events/NativeEventMonitor.waitForNativeEvent.(Lcom/sun/midp/events/NativeEvent;)I"] =
    function(addr, eventAddr) {
      var event = getHandle(eventAddr);
      var isolateId = $.ctx.runtime.isolateId;
      var nativeEventQueue = nativeEventQueues[isolateId];

      if (nativeEventQueue.length !== 0) {
        copyEvent(nativeEventQueue.shift(), event);
        return nativeEventQueue.length;
      }

      asyncImpl("I", new Promise(function(resolve, reject) {
        waitingNativeEventQueue[isolateId] = {
          resolve: resolve,
          nativeEvent: event,
        };
      }));
    };

  Native["com/sun/midp/events/NativeEventMonitor.readNativeEvent.(Lcom/sun/midp/events/NativeEvent;)Z"] =
    function(addr, eventAddr) {
      var isolateId = $.ctx.runtime.isolateId;
      var nativeEventQueue = nativeEventQueues[isolateId];
      if (!nativeEventQueue.length) {
        return 0;
      }
      var event = getHandle(eventAddr);
      copyEvent(nativeEventQueue.shift(), event);
      return 1;
    };

  var localizedStrings;

  Native["com/sun/midp/l10n/LocalizedStringsBase.getContent.(I)Ljava/lang/String;"] = function(addr, id) {
    if (!MIDP.localizedStrings) {
      var data = JARStore.loadFileFromJAR("java/classes.jar", "l10n/" + (config.language || navigator.language) + ".json");
      if (!data) {
        // Fallback to English
        data = JARStore.loadFileFromJAR("java/classes.jar", "l10n/en-US.json");

        if (!data) {
          throw $.newIOException();
        }
      }

      MIDP.localizedStrings = JSON.parse(util.decodeUtf8(data));
    }

    var value = MIDP.localizedStrings[id];

    if (!value) {
      throw $.newIllegalStateException("String with ID (" + id + ") doesn't exist");
    }

    return J2ME.newString(value);
  };

  Native["javax/microedition/lcdui/Display.drawTrustedIcon0.(IZ)V"] = function(addr, dispId, drawTrusted) {
    console.warn("Display.drawTrustedIcon0.(IZ)V not implemented (" + dispId + ", " + drawTrusted + ")");
  };

  Native["com/sun/midp/events/EventQueue.sendShutdownEvent.()V"] = function(addr) {
    sendNativeEvent({ type: EVENT_QUEUE_SHUTDOWN }, $.ctx.runtime.isolateId);
  };

  addUnimplementedNative("com/sun/midp/main/CommandState.saveCommandState.(Lcom/sun/midp/main/CommandState;)V");

  Native["com/sun/midp/main/CommandState.exitInternal.(I)V"] = function(addr, status) {
    console.info("Exit: " + status);
    exit();
  };

  Native["com/sun/midp/suspend/SuspendSystem$MIDPSystem.allMidletsKilled.()Z"] = function(addr) {
    console.warn("SuspendSystem$MIDPSystem.allMidletsKilled.()Z not implemented");
    return 0;
  };

  /* We don't care about the system keys SELECT,
     SOFT_BUTTON1, SOFT_BUTTON2, DEBUG_TRACE1, CLAMSHELL_OPEN, CLAMSHELL_CLOSE,
     but we do care about SYSTEM_KEY_CLEAR, so send it when the delete key is pressed.
     */

  var SYSTEM_KEY_POWER = 1;
  var SYSTEM_KEY_SEND = 2;
  var SYSTEM_KEY_END = 3;
  var SYSTEM_KEY_CLEAR = 4;

  var systemKeyMap = {
    8: SYSTEM_KEY_CLEAR, // Backspace
    112: SYSTEM_KEY_POWER, // F1
    116: SYSTEM_KEY_SEND, // F5
    114: SYSTEM_KEY_END, // F3
  };

  Native["javax/microedition/lcdui/KeyConverter.getSystemKey.(I)I"] = function(addr, key) {
    return systemKeyMap[key] || 0;
  };

  var keyMap = {
    1: 119, // UP
    2: 97, // LEFT
    5: 100, // RIGHT
    6: 115, // DOWN
    8: 32, // FIRE
    9: 113, // GAME_A
    10: 101, // GAME_B
    11: 122, // GAME_C
    12: 99, // GAME_D
  };

  Native["javax/microedition/lcdui/KeyConverter.getKeyCode.(I)I"] = function(addr, key) {
    return keyMap[key] || 0;
  };

  var keyNames = {
    119: "Up",
    97: "Left",
    100: "Right",
    115: "Down",
    32: "Select",
    113: "Calendar",
    101: "Addressbook",
    122: "Menu",
    99: "Mail",
  };

  Native["javax/microedition/lcdui/KeyConverter.getKeyName.(I)Ljava/lang/String;"] = function(addr, keyCode) {
    return J2ME.newString((keyCode in keyNames) ? keyNames[keyCode] : String.fromCharCode(keyCode));
  };

  var gameKeys = {
    119: 1,  // UP
    97: 2,   // LEFT
    115: 6,  // DOWN
    100: 5,  // RIGHT
    32: 8,   // FIRE
    113: 9,  // GAME_A
    101: 10, // GAME_B
    122: 11, // GAME_C
    99: 12   // GAME_D
  };

  Native["javax/microedition/lcdui/KeyConverter.getGameAction.(I)I"] = function(addr, keyCode) {
    return gameKeys[keyCode] || 0;
  };

  Native["javax/microedition/lcdui/game/GameCanvas.setSuppressKeyEvents.(Ljavax/microedition/lcdui/Canvas;Z)V"] =
  function(addr, canvasAddr, shouldSuppress) {
    suppressKeyEvents = shouldSuppress;
  };

  Native["com/sun/midp/main/MIDletProxyList.resetForegroundInNativeState.()V"] = function(addr) {
    FG.reset();
  };

  Native["com/sun/midp/main/MIDletProxyList.setForegroundInNativeState.(II)V"] = function(addr, isolateId, dispId) {
    FG.set(isolateId, dispId);
  };

  var connectionRegistry = {
    // The lastRegistrationId is in common between alarms and push notifications
    lastRegistrationId:  -1,
    pushRegistrations: [],
    alarms: [],
    readyRegistrations: [],
    addReadyRegistration: function(id) {
      this.readyRegistrations.push(id);
      this.notify();
    },
    notify: function() {
      if (!this.readyRegistrations.length || !this.pendingPollCallback) {
        return;
      }
      var cb = this.pendingPollCallback;
      this.pendingPollCallback = null;
      cb(this.readyRegistrations.pop());
    },
    pushNotify: function(protocolName) {
      for (var i = 0; i < this.pushRegistrations.length; i++) {
        if (protocolName == this.pushRegistrations[i].connection) {
          this.addReadyRegistration(this.pushRegistrations[i].id);
        }
      }
    },
    waitForRegistration: function(cb) {
      if (this.pendingPollCallback) {
        throw new Error("There can only be one waiter.");
      }
      this.pendingPollCallback = cb;
      this.notify();
    },
    addConnection: function(connection) {
      connection.id = ++this.lastRegistrationId;
      this.pushRegistrations.push(connection);
      return connection.id;
    },
    addAlarm: function(alarm) {
      alarm.id = ++this.lastRegistrationId;
      this.alarms.push(alarm);
      return alarm.id;
    }
  };

  Native["com/sun/midp/io/j2me/push/ConnectionRegistry.poll0.(J)I"] = function(addr, time) {
    asyncImpl("I", new Promise(function(resolve, reject) {
      connectionRegistry.waitForRegistration(function(id) {
        resolve(id);
      });
    }));
  };

  Native["com/sun/midp/io/j2me/push/ConnectionRegistry.add0.(Ljava/lang/String;)I"] = function(addr, connectionAddr) {
    var values = J2ME.fromStringAddr(connectionAddr).split(',');

    console.warn("ConnectionRegistry.add0.(IL...String;)I isn't completely implemented");

    connectionRegistry.addConnection({
      connection: values[0],
      midlet: values[1],
      filter: values[2],
      suiteId: values[3]
    });

    return 0;
  };

  Native["com/sun/midp/io/j2me/push/ConnectionRegistry.addAlarm0.([BJ)J"] =
  function(addr, midletAddr, jTimeLow, jTimeHigh) {
    var midlet = util.decodeUtf8(J2ME.getArrayFromAddr(midletAddr));
    var time = J2ME.longToNumber(jTimeLow, jTimeHigh);

    var lastAlarm = 0;
    var id = null;
    var alarms = connectionRegistry.alarms;
    for (var i = 0; i < alarms.length; i++) {
      if (alarms[i].midlet == midlet) {
        if (time != 0) {
          id = alarms[i].id;
          lastAlarm = alarms[i].time;
          alarms[i].time = time;
        } else {
          alarms[i].splice(i, 1);
        }

        break;
      }
    }

    if (lastAlarm == 0 && time != 0) {
      id = connectionRegistry.addAlarm({
        midlet: midlet,
        time: time
      });
    }

    if (id !== null) {
      var relativeTime = time - Date.now();
      if (relativeTime < 0) {
        relativeTime = 0;
      }

      setTimeout(function() {
        connectionRegistry.addReadyRegistration(id);
      }, relativeTime);
    }

    return J2ME.returnLongValue(lastAlarm);
  };

  Native["com/sun/midp/io/j2me/push/ConnectionRegistry.getMIDlet0.(I[BI)I"] =
  function(addr, handle, regentryAddr, entrysz) {
    var regentry = J2ME.getArrayFromAddr(regentryAddr);
    var reg;
    var alarms = connectionRegistry.alarms;
    for (var i = 0; i < alarms.length; i++) {
      if (alarms[i].id == handle) {
        reg = alarms[i];
      }
    }

    if (!reg) {
      var pushRegistrations = connectionRegistry.pushRegistrations;
      for (var i = 0; i < pushRegistrations.length; i++) {
        if (pushRegistrations[i].id == handle) {
          reg = pushRegistrations[i];
        }
      }
    }

    if (!reg) {
      console.error("getMIDlet0 returns -1, this should never happen");
      return -1;
    }

    var str;

    if (reg.time) {
      str = reg.midlet + ", 0, 1";
    } else {
      str = reg.connection + ", " + reg.midlet + ", " + reg.filter + ", " + reg.suiteId;
    }

    for (var i = 0; i < str.length; i++) {
      regentry[i] = str.charCodeAt(i);
    }
    regentry[str.length] = 0;

    return 0;
  };

  Native["com/sun/midp/io/j2me/push/ConnectionRegistry.checkInByMidlet0.(ILjava/lang/String;)V"] =
  function(addr, suiteId, classNameAddr) {
    console.warn("ConnectionRegistry.checkInByMidlet0.(IL...String;)V not implemented (" +
                 suiteId + ", " + J2ME.fromStringAddr(classNameAddr) + ")");
  };

  Native["com/sun/midp/io/j2me/push/ConnectionRegistry.checkInByName0.([B)I"] = function(addr, nameAddr) {
    var name = J2ME.getArrayFromAddr(nameAddr);
    console.warn("ConnectionRegistry.checkInByName0.([B)V not implemented (" + util.decodeUtf8(name) + ")");
    return 0;
  };

  Native["com/nokia/mid/ui/gestures/GestureInteractiveZone.isSupported.(I)Z"] = function(addr, gestureEventIdentity) {
    console.warn("GestureInteractiveZone.isSupported.(I)Z not implemented (" + gestureEventIdentity + ")");
    return 0;
  };

  addUnimplementedNative("com/nokia/mid/ui/gestures/GestureInteractiveZone.getGestures.()I", 0);

  Native["com/sun/midp/io/NetworkConnectionBase.initializeInternal.()V"] = function(addr) {
    console.warn("NetworkConnectionBase.initializeInternal.()V not implemented");
  };

  addUnimplementedNative("com/nokia/mid/ui/VirtualKeyboard.hideOpenKeypadCommand.(Z)V");
  addUnimplementedNative("com/nokia/mid/ui/VirtualKeyboard.suppressSizeChanged.(Z)V");

  Native["com/nokia/mid/ui/VirtualKeyboard.getCustomKeyboardControl.()Lcom/nokia/mid/ui/CustomKeyboardControl;"] =
  function(addr) {
    throw $.newIllegalArgumentException("VirtualKeyboard::getCustomKeyboardControl() not implemented");
  };

  var keyboardVisibilityListener = J2ME.Constants.NULL;
  Native["com/nokia/mid/ui/VirtualKeyboard.setVisibilityListener.(Lcom/nokia/mid/ui/KeyboardVisibilityListener;)V"] =
  function(addr, listenerAddr) {
    keyboardVisibilityListener = listenerAddr ? listenerAddr : J2ME.Constants.NULL;
  };

  Native["javax/microedition/lcdui/Display.getKeyboardVisibilityListener.()Lcom/nokia/mid/ui/KeyboardVisibilityListener;"] =
  function(addr) {
    return keyboardVisibilityListener;
  };

  Native["com/nokia/mid/ui/VirtualKeyboard.isVisible.()Z"] = function(addr) {
    return MIDP.isVKVisible() ? 1 : 0;
  };

  Native["com/nokia/mid/ui/VirtualKeyboard.getXPosition.()I"] = function(addr) {
    return 0;
  };

  Native["com/nokia/mid/ui/VirtualKeyboard.getYPosition.()I"] = function(addr) {
    // We should return the number of pixels between the top of the
    // screen and the top of the keyboard
    return deviceCanvas.height - getKeyboardHeight();
  };

  Native["com/nokia/mid/ui/VirtualKeyboard.getWidth.()I"] = function(addr) {
    // The keyboard is always the same width as our window
    return window.innerWidth;
  };

  Native["com/nokia/mid/ui/VirtualKeyboard.getHeight.()I"] = function(addr) {
    return getKeyboardHeight();
  };

  function getKeyboardHeight() {
    return physicalScreenHeight - window.innerHeight;
  };

  return {
    isVKVisible: isVKVisible,
    manifest: manifest,
    sendCommandEvent: sendCommandEvent,
    sendVirtualKeyboardEvent: sendVirtualKeyboardEvent,
    sendEndOfMediaEvent: sendEndOfMediaEvent,
    sendMediaSnapshotFinishedEvent: sendMediaSnapshotFinishedEvent,
    sendKeyPress: sendKeyPress,
    sendKeyRelease: sendKeyRelease,
    sendDestroyMIDletEvent: sendDestroyMIDletEvent,
    setDestroyedForRestart: setDestroyedForRestart,
    registerDestroyedListener: registerDestroyedListener,
    sendExecuteMIDletEvent: sendExecuteMIDletEvent,
    deviceContext: deviceContext,
    updatePhysicalScreenSize: updatePhysicalScreenSize,
    updateCanvas: updateCanvas,
    localizedStrings: localizedStrings,
  };
})();
