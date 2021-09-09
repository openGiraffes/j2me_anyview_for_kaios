/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

'use strict';

var FrameAnimator = function() {};

FrameAnimator.numRegistered = 0;

FrameAnimator.prototype._isRegistered = false;

FrameAnimator.prototype.register = function(x, y, maxFps, maxPps, listener) {
  this.x = x;
  this.y = y;
  this.maxFps = maxFps;
  this.maxPps = maxPps;
  this.listener = listener;
  this._isRegistered = true;
  ++FrameAnimator.numRegistered;
};

FrameAnimator.prototype.unregister = function() {
  this.x = null;
  this.y = null;
  this.maxFps = null;
  this.maxPps = null;
  this.listener = J2ME.Constants.NULL;
  this._isRegistered = false;
  --FrameAnimator.numRegistered;
};

FrameAnimator.prototype.isRegistered = function() {
  return this._isRegistered;
};

Native["com/nokia/mid/ui/frameanimator/FrameAnimator.init.()V"] = function(addr) {
  setNative(addr, new FrameAnimator());
};

Native["com/nokia/mid/ui/frameanimator/FrameAnimator.register.(IISSLcom/nokia/mid/ui/frameanimator/FrameAnimatorListener;)Z"] =
function(addr, x, y, maxFps, maxPps, listenerAddr) {
  var nativeObject = NativeMap.get(addr);
  if (nativeObject.isRegistered()) {
    throw $.newIllegalStateException("FrameAnimator already registered");
  }

  if (listenerAddr === J2ME.Constants.NULL) {
    throw $.newNullPointerException("listener is null");
  }

  if (x < -65535 || x > 65535 || y < -65535 || y > 65535) {
    throw $.newIllegalArgumentException("coordinate out of bounds");
  }

  // XXX return false if FrameAnimator.numRegistered >= FRAME_ANIMATOR_MAX_CONCURRENT

  nativeObject.register(x, y, maxFps, maxPps, listenerAddr);
  return 1;
};

Native["com/nokia/mid/ui/frameanimator/FrameAnimator.unregister.()V"] = function(addr) {
  var nativeObject = NativeMap.get(addr);
  if (!nativeObject.isRegistered()) {
    throw $.newIllegalStateException("FrameAnimator not registered");
  }

  nativeObject.unregister();
};

addUnimplementedNative("com/nokia/mid/ui/frameanimator/FrameAnimator.drag.(II)V");
addUnimplementedNative("com/nokia/mid/ui/frameanimator/FrameAnimator.kineticScroll.(IIIF)V");
addUnimplementedNative("com/nokia/mid/ui/frameanimator/FrameAnimator.limitedKineticScroll.(IIIFII)V");
addUnimplementedNative("com/nokia/mid/ui/frameanimator/FrameAnimator.stop.()V");

Native["com/nokia/mid/ui/frameanimator/FrameAnimator.isRegistered.()Z"] = function(addr) {
  return NativeMap.get(addr).isRegistered() ? 1 : 0;
};

Native["com/nokia/mid/ui/frameanimator/FrameAnimator.getNumRegisteredFrameAnimators.()I"] = function(addr) {
  return FrameAnimator.numRegistered;
};
