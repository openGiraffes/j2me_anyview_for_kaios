/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

'use strict';

Native["com/nokia/mid/ui/DeviceControl.startVibra.(IJ)V"] = function(addr, freq, longDurationLow, longDurationHigh) {
  // If method is called during a previously called vibration that has been
  // activated from this method, the previous vibration is stopped and the new
  // one is activated using the new set of parameters.
  navigator.vibrate(0);

  // Value 0 can be used for detecting whether or not there is a vibration device.
  if (freq === 0) {
    return;
  }

  var duration = J2ME.longToNumber(longDurationLow, longDurationHigh);

  if (freq < 0 || freq > 100 || duration < 0) {
    throw new $.newIllegalArgumentException();
  }

  navigator.vibrate(duration);
};

Native["com/nokia/mid/ui/DeviceControl.stopVibra.()V"] = function(addr) {
  navigator.vibrate(0);
};
