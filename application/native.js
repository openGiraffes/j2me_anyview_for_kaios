/* -*- Mode: Java; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* vim: set shiftwidth=4 tabstop=4 autoindent cindent expandtab: */

'use strict';

var asyncImpl = J2ME.asyncImplOld;

function preemptingImpl(returnKind, returnValue) {
  if (J2ME.Scheduler.shouldPreempt()) {
      asyncImpl(returnKind, Promise.resolve(returnValue));
      return;
  }
  return returnValue;
}

var Override = {};

Native["java/lang/System.arraycopy.(Ljava/lang/Object;ILjava/lang/Object;II)V"] =
function(addr, srcAddr, srcOffset, dstAddr, dstOffset, length) {
    if (srcAddr === J2ME.Constants.NULL || dstAddr === J2ME.Constants.NULL) {
        throw $.newNullPointerException("Cannot copy to/from a null array.");
    }

    var srcClassInfo = J2ME.getClassInfo(srcAddr);
    var dstClassInfo = J2ME.getClassInfo(dstAddr);

    if (!(srcClassInfo instanceof J2ME.ArrayClassInfo) || !(dstClassInfo instanceof J2ME.ArrayClassInfo)) {
        throw $.newArrayStoreException("Can only copy to/from array types.");
    }

    var srcLength = i32[srcAddr + J2ME.Constants.ARRAY_LENGTH_OFFSET >> 2];
    var dstLength = i32[dstAddr + J2ME.Constants.ARRAY_LENGTH_OFFSET >> 2];

    if (srcOffset < 0 || (srcOffset+length) > srcLength ||
        dstOffset < 0 || (dstOffset+length) > dstLength ||
        length < 0) {
        throw $.newArrayIndexOutOfBoundsException("Invalid index.");
    }

    var srcIsPrimitive = srcClassInfo instanceof J2ME.PrimitiveArrayClassInfo;
    var dstIsPrimitive = dstClassInfo instanceof J2ME.PrimitiveArrayClassInfo;
    if ((srcIsPrimitive && dstIsPrimitive && srcClassInfo !== dstClassInfo) ||
        (srcIsPrimitive && !dstIsPrimitive) ||
        (!srcIsPrimitive && dstIsPrimitive)) {
        throw $.newArrayStoreException("Incompatible component types: " + srcClassInfo + " -> " + dstClassInfo);
    }

    if (!dstIsPrimitive) {
        var src = (srcAddr + J2ME.Constants.ARRAY_HDR_SIZE >> 2) + srcOffset;
        var dst = (dstAddr + J2ME.Constants.ARRAY_HDR_SIZE >> 2) + dstOffset;

        if (srcClassInfo !== dstClassInfo && !J2ME.isAssignableTo(srcClassInfo.elementClass, dstClassInfo.elementClass)) {
            var copy = function(to, from) {
                var addr = i32[from];
                if (addr !== J2ME.Constants.NULL) {
                    var objClassInfo = J2ME.getClassInfo(addr);
                    if (!J2ME.isAssignableTo(objClassInfo, dstClassInfo.elementClass)) {
                        throw $.newArrayStoreException("Incompatible component types.");
                    }
                }
                i32[to] = addr;
            };
            if (dstAddr !== srcAddr || dstOffset < srcOffset) {
                for (var n = 0; n < length; ++n) {
                    copy(dst++, src++);
                }
            } else {
                dst += length;
                src += length;
                for (var n = 0; n < length; ++n) {
                    copy(--dst, --src);
                }
            }
        } else {
            if (srcAddr !== dstAddr || dstOffset < srcOffset) {
                for (var n = 0; n < length; ++n) {
                    i32[dst++] = i32[src++];
                }
            } else {
                dst += length;
                src += length;
                for (var n = 0; n < length; ++n) {
                    i32[--dst] = i32[--src];
                }
            }
        }

        return;
    }

    switch (srcClassInfo.bytesPerElement) {
        case 1:
            var src = (srcAddr + J2ME.Constants.ARRAY_HDR_SIZE) + srcOffset;
            var dst = (dstAddr + J2ME.Constants.ARRAY_HDR_SIZE) + dstOffset;
            i8.set(i8.subarray(src, src + length), dst);
            break;

        case 2:
            var src = (srcAddr + J2ME.Constants.ARRAY_HDR_SIZE >> 1) + srcOffset;
            var dst = (dstAddr + J2ME.Constants.ARRAY_HDR_SIZE >> 1) + dstOffset;
            i16.set(i16.subarray(src, src + length), dst);
            break;

        case 4:
            var src = (srcAddr + J2ME.Constants.ARRAY_HDR_SIZE >> 2) + srcOffset;
            var dst = (dstAddr + J2ME.Constants.ARRAY_HDR_SIZE >> 2) + dstOffset;
            i32.set(i32.subarray(src, src + length), dst);
            break;

        case 8:
            var src = (srcAddr + J2ME.Constants.ARRAY_HDR_SIZE >> 3) + srcOffset;
            var dst = (dstAddr + J2ME.Constants.ARRAY_HDR_SIZE >> 3) + dstOffset;
            f64.set(f64.subarray(src, src + length), dst);
            break;
    }
};

var stubProperties = {
  "com.nokia.multisim.slots": "1",
  "com.nokia.mid.imsi": "000000000000000",
  "com.nokia.mid.imei": "",
};

Native["java/lang/System.getProperty0.(Ljava/lang/String;)Ljava/lang/String;"] = function(addr, keyAddr) {
    var key = J2ME.fromStringAddr(keyAddr);
    var value;
    switch (key) {
    case "microedition.encoding":
        // The value of this property is different than the value on a real Nokia Asha 503 phone.
        // On the phone, it is: ISO8859_1.
        // If we changed this, we would need to remove the optimizations for UTF_8_Reader and
        // UTF_8_Writer and optimize the ISO8859_1 alternatives.
        value = "UTF-8";
        break;
    case "microedition.io.file.FileConnection.version":
        value = "1.0";
        break;
    case "microedition.locale":
        value = navigator.language;
        break;
    case "microedition.platform":
        value = config.platform ? config.platform : "Nokia503/14.0.4/java_runtime_version=Nokia_Asha_1_2";
        break;
    case "microedition.platformimpl":
        value = null;
        break;
    case "microedition.profiles":
        value = "MIDP-2.1"
        break;
    case "microedition.pim.version":
        value = "1.0";
        break;
    case "microedition.amms.version":
        value = "1.1";
        break;
    case "microedition.media.version":
        value = '1.2';
        break;
    case "mmapi-configuration":
        value = null;
        break;
    case "fileconn.dir.memorycard":
        value = "file:///MemoryCard/";
        break;
    // The names here should be localized.
    case "fileconn.dir.memorycard.name":
        value = "Memory card";
        break;
    case "fileconn.dir.private":
        value = "file:///Private/";
        break;
    case "fileconn.dir.private.name":
        value = "Private";
        break;
    case "fileconn.dir.applications.bookmarks":
        value = null;
        break;
    case "fileconn.dir.received":
        value = "file:///Phone/_my_downloads/";
        break;
    case "fileconn.dir.received.name":
        value = "Downloads";
        break;
    case "fileconn.dir.photos":
        value = "file:///Phone/_my_pictures/";
        break;
    case "fileconn.dir.photos.name":
        value = "Photos";
        break;
    case "fileconn.dir.videos":
        value = "file:///Phone/_my_videos/";
        break;
    case "fileconn.dir.videos.name":
        value = "Videos";
        break;
    case "fileconn.dir.recordings":
        value = "file:///Phone/_my_recordings/";
        break;
    case "fileconn.dir.recordings.name":
        value = "Recordings";
        break;
    case "fileconn.dir.roots.names":
        value = MIDP.fsRootNames.join(";");
        break;
    case "fileconn.dir.roots.external":
        value = MIDP.fsRoots.map(function(v) { return "file:///" + v }).join("\n");
        break;
    case "file.separator":
        value = "/";
        break;
    case "com.sun.cldc.util.j2me.TimeZoneImpl.timezone":
        // Date.toString() returns something like the following:
        //    "Wed Sep 17 2014 12:11:23 GMT-0700 (PDT)"
        //
        // Per http://www.spectrum3847.org/frc2013api/com/sun/cldc/util/j2me/TimeZoneImpl.html,
        // timezones can be of the format GMT+0600, which is what this
        // regex currently matches. (Those actually in GMT would not
        // match the regex, causing the default "GMT" to be returned.)
        // If we find this to be a problem, we could alternately return the
        // zone name as provided in parenthesis, but that seems locale-specific.
        var match = /GMT[+-]\d+/.exec(new Date().toString());
        value = (match && match[0]) || "GMT";
        break;
    case "javax.microedition.io.Connector.protocolpath":
        value = "com.sun.midp.io";
        break;
    case "javax.microedition.io.Connector.protocolpath.fallback":
        value = "com.sun.cldc.io";
        break;
    case "com.nokia.keyboard.type":
        value = "None";
        break;
    case "com.nokia.mid.batterylevel":
        // http://developer.nokia.com/community/wiki/Checking_battery_level_in_Java_ME
        value = Math.floor(navigator.battery.level * 100).toString();
        break;
    case "com.nokia.mid.ui.version":
        value = "1.7";
        break;
    case "com.nokia.mid.mnc":
        if (mobileInfo.icc.mcc && mobileInfo.icc.mnc) {
            // The concatenation of the MCC and MNC for the ICC (i.e. SIM card).
            value = util.pad(mobileInfo.icc.mcc, 3) + util.pad(mobileInfo.icc.mnc, 3);
        } else {
            value = null;
        }
        break;
    case "com.nokia.mid.networkID":
        if (mobileInfo.network.mcc && mobileInfo.network.mnc) {
            // The concatenation of MCC and MNC for the network.
            value = util.pad(mobileInfo.network.mcc, 3) + util.pad(mobileInfo.network.mnc, 3);
        } else {
            value = null;
        }
        break;
    case "com.nokia.mid.ui.customfontsize":
        value = "true";
        break;
    case "classpathext":
        value = null;
        break;
    case "supports.audio.capture":
        value = "true";
        break;
    case "supports.video.capture":
        value = "true";
        break;
    case "supports.recording":
        value = "true";
        break;
    case "audio.encodings":
        value = "encoding=audio/amr";
        break;
    case "video.snapshot.encodings":
        // FIXME Some MIDlets pass a string that contains lots of constraints
        // as the `imageType` which is not yet handled in DirectVideo.jpp, let's
        // just put the whole string here as a workaround and fix this in issue #688.
        value = "encoding=jpeg&quality=80&progressive=true&type=jfif&width=400&height=400";
        break;
    default:
        if (MIDP.additionalProperties[key]) {
            value = MIDP.additionalProperties[key];
        } else if (typeof stubProperties[key] !== "undefined") {
            value = stubProperties[key];
        } else {
            console.warn("UNKNOWN PROPERTY (java/lang/System): " + key);
            stubProperties[key] = value = null;
        }
        break;
    }

    return J2ME.newString(value);
};

Native["java/lang/System.currentTimeMillis.()J"] = function(addr) {
    return J2ME.returnLongValue(Date.now());
};

Native["com/sun/cldchi/jvm/JVM.unchecked_char_arraycopy.([CI[CII)V"] =
function(addr, srcAddr, srcOffset, dstAddr, dstOffset, length) {
    var src = (srcAddr + J2ME.Constants.ARRAY_HDR_SIZE >> 1) + srcOffset;
    var dst = (dstAddr + J2ME.Constants.ARRAY_HDR_SIZE >> 1) + dstOffset;
    i16.set(i16.subarray(src, src + length), dst);
};

Native["com/sun/cldchi/jvm/JVM.unchecked_int_arraycopy.([II[III)V"] =
function(addr, srcAddr, srcOffset, dstAddr, dstOffset, length) {
    var src = (srcAddr + J2ME.Constants.ARRAY_HDR_SIZE >> 2) + srcOffset;
    var dst = (dstAddr + J2ME.Constants.ARRAY_HDR_SIZE >> 2) + dstOffset;
    i32.set(i32.subarray(src, src + length), dst);
};

Native["com/sun/cldchi/jvm/JVM.unchecked_obj_arraycopy.([Ljava/lang/Object;I[Ljava/lang/Object;II)V"] =
function(addr, srcAddr, srcOffset, dstAddr, dstOffset, length) {
    var src = (srcAddr + J2ME.Constants.ARRAY_HDR_SIZE >> 2) + srcOffset;
    var dst = (dstAddr + J2ME.Constants.ARRAY_HDR_SIZE >> 2) + dstOffset;

    if (srcAddr !== dstAddr || dstOffset < srcOffset) {
        for (var n = 0; n < length; ++n) {
            i32[dst++] = i32[src++];
        }
    } else {
        dst += length;
        src += length;
        for (var n = 0; n < length; ++n)
            i32[--dst] = i32[--src];
    }
};

Native["com/sun/cldchi/jvm/JVM.monotonicTimeMillis.()J"] = function(addr) {
    return J2ME.returnLongValue(performance.now());
};

Native["java/lang/Object.getClass.()Ljava/lang/Class;"] = function(addr) {
    return $.getClassObjectAddress(J2ME.getClassInfo(addr));
};

Native["java/lang/Class.getSuperclass.()Ljava/lang/Class;"] = function(addr) {
    var self = getHandle(addr);
    var superClassInfo = J2ME.classIdToClassInfoMap[self.vmClass].superClass;
    if (!superClassInfo) {
      return J2ME.Constants.NULL;
    }
    return $.getClassObjectAddress(superClassInfo);
};

Native["java/lang/Class.invoke_clinit.()V"] = function(addr) {
    var self = getHandle(addr);
    var classInfo = J2ME.classIdToClassInfoMap[self.vmClass];
    var className = classInfo.getClassNameSlow();
    var clinit = classInfo.staticInitializer;
    J2ME.preemptionLockLevel++;
    if (clinit && clinit.classInfo.getClassNameSlow() === className) {
        $.ctx.executeMethod(clinit);
        if (U) {
            $.nativeBailout(J2ME.Kind.Void, J2ME.Bytecode.Bytecodes.INVOKESTATIC);
        }
    }
};

Native["java/lang/Class.invoke_verify.()V"] = function(addr) {
    // There is currently no verification.
};

Native["java/lang/Class.init9.()V"] = function(addr) {
    var self = getHandle(addr);
    release || J2ME.Debug.assert(self.vmClass in J2ME.classIdToClassInfoMap, "Class must be linked.");
    $.setClassInitialized(self.vmClass);
    J2ME.preemptionLockLevel--;
};

Native["java/lang/Class.getName.()Ljava/lang/String;"] = function(addr) {
    var self = getHandle(addr);
    var classInfo = J2ME.classIdToClassInfoMap[self.vmClass];
    return J2ME.newString(classInfo.getClassNameSlow().replace(/\//g, "."));
};

Native["java/lang/Class.forName0.(Ljava/lang/String;)V"] = function(addr, nameAddr) {
  var classInfo = null;
  try {
    if (nameAddr === J2ME.Constants.NULL) {
      throw new J2ME.ClassNotFoundException();
    }
    var className = J2ME.fromStringAddr(nameAddr).replace(/\./g, "/");
    classInfo = CLASSES.getClass(className);
  } catch (e) {
    if (e instanceof (J2ME.ClassNotFoundException)) {
      throw $.newClassNotFoundException("'" + e.message + "' not found.");
    }
    throw e;
  }
  // The following can trigger an unwind.
  J2ME.classInitCheck(classInfo);
  if (U) {
    $.nativeBailout(J2ME.Kind.Void, J2ME.Bytecode.Bytecodes.INVOKESTATIC);
  }
};

Native["java/lang/Class.forName1.(Ljava/lang/String;)Ljava/lang/Class;"] = function(addr, nameAddr) {
  var className = J2ME.fromStringAddr(nameAddr).replace(/\./g, "/");
  var classInfo = CLASSES.getClass(className);
  return $.getClassObjectAddress(classInfo);
};

Native["java/lang/Class.newInstance0.()Ljava/lang/Object;"] = function(addr) {
  var self = getHandle(addr);
  var classInfo = J2ME.classIdToClassInfoMap[self.vmClass];
  if (classInfo.isInterface ||
      classInfo.isAbstract) {
    throw $.newInstantiationException("Can't instantiate interfaces or abstract classes");
  }

  if (classInfo instanceof J2ME.ArrayClassInfo) {
    throw $.newInstantiationException("Can't instantiate array classes");
  }

  return J2ME.allocObject(classInfo);
};

Native["java/lang/Class.newInstance1.(Ljava/lang/Object;)V"] = function(addr, oAddr) {
  var classInfo = J2ME.getClassInfo(oAddr);
  var methodInfo = classInfo.getLocalMethodByNameString("<init>", "()V", false);
  if (!methodInfo) {
    throw $.newInstantiationException("Can't instantiate classes without a nullary constructor");
  }
  // The following can trigger an unwind.
  J2ME.getLinkedMethod(methodInfo)(oAddr);
  if (U) {
      $.nativeBailout(J2ME.Kind.Void, J2ME.Bytecode.Bytecodes.INVOKESPECIAL);
  }
};

Native["java/lang/Class.isInterface.()Z"] = function(addr) {
    var self = getHandle(addr);
    var classInfo = J2ME.classIdToClassInfoMap[self.vmClass];
    return classInfo.isInterface ? 1 : 0;
};

Native["java/lang/Class.isArray.()Z"] = function(addr) {
    var self = getHandle(addr);
    var classInfo = J2ME.classIdToClassInfoMap[self.vmClass];
    return classInfo instanceof J2ME.ArrayClassInfo ? 1 : 0;
};

Native["java/lang/Class.isAssignableFrom.(Ljava/lang/Class;)Z"] = function(addr, fromClassAddr) {
    var self = getHandle(addr);
    var selfClassInfo = J2ME.classIdToClassInfoMap[self.vmClass];
    if (fromClassAddr === J2ME.Constants.NULL) {
        throw $.newNullPointerException();
    }
    var fromClass = getHandle(fromClassAddr);
    var fromClassInfo = J2ME.classIdToClassInfoMap[fromClass.vmClass];
    return J2ME.isAssignableTo(fromClassInfo, selfClassInfo) ? 1 : 0;
};

Native["java/lang/Class.isInstance.(Ljava/lang/Object;)Z"] = function(addr, objAddr) {
    if (objAddr === J2ME.Constants.NULL) {
        return 0;
    }

    var self = getHandle(addr);
    var classInfo = J2ME.classIdToClassInfoMap[self.vmClass];
    var objClassInfo = J2ME.getClassInfo(objAddr);
    return J2ME.isAssignableTo(objClassInfo, classInfo) ? 1 : 0;
};

Native["java/lang/Float.floatToIntBits.(F)I"] = function(addr, f) {
    aliasedI32[0] = f;
    aliasedF32[0] = aliasedF32[0];
    return aliasedI32[0];
}

Native["java/lang/Float.intBitsToFloat.(I)F"] = function (addr, i) {
    return i;
}

Native["java/lang/Double.doubleToLongBits.(D)J"] = function (addr, l, h) {
    aliasedI32[0] = l;
    aliasedI32[1] = h;
    // Canonicalize the value.
    aliasedF64[0] = aliasedF64[0];
    return J2ME.returnLong(aliasedI32[0], aliasedI32[1]);
}

Native["java/lang/Double.longBitsToDouble.(J)D"] = function(addr, l, h) {
    aliasedI32[0] = l;
    aliasedI32[1] = h;
    return J2ME.returnDoubleValue(aliasedF64[0]);
}

Native["java/lang/Runtime.freeMemory.()J"] = function(addr) {
    return J2ME.returnLongValue(J2ME.getFreeMemory());
};

Native["java/lang/Runtime.gc.()V"] = function(addr) {
    // Force a bailout so that there are no native frames on the stack
    // so GC can be safely run.
    asyncImpl("V", new Promise(function(resolve, reject) {
        setTimeout(function() {
            ASM._forceCollection();
            resolve();
        });
    }));
};

Native["java/lang/Math.floor.(D)D"] = function(addr, valLow, valHigh) {
    aliasedI32[0] = valLow;
    aliasedI32[1] = valHigh;
    return J2ME.returnDoubleValue(Math.floor(aliasedF64[0]));
};

Native["java/lang/Math.asin.(D)D"] = function(addr, valLow, valHigh) {
    aliasedI32[0] = valLow;
    aliasedI32[1] = valHigh;
    return J2ME.returnDoubleValue(Math.asin(aliasedF64[0]));
};

Native["java/lang/Math.acos.(D)D"] = function(addr, valLow, valHigh) {
    aliasedI32[0] = valLow;
    aliasedI32[1] = valHigh;
    return J2ME.returnDoubleValue(Math.acos(aliasedF64[0]));
};

Native["java/lang/Math.atan.(D)D"] = function(addr, valLow, valHigh) {
    aliasedI32[0] = valLow;
    aliasedI32[1] = valHigh;
    return J2ME.returnDoubleValue(Math.atan(aliasedF64[0]));
};

Native["java/lang/Math.atan2.(DD)D"] = function(addr, xLow, xHigh, yLow, yHigh) {
    aliasedI32[0] = xLow;
    aliasedI32[1] = xHigh;
    var x = aliasedF64[0];
    aliasedI32[0] = yLow;
    aliasedI32[1] = yHigh;
    var y = aliasedF64[0];
    return J2ME.returnDoubleValue(Math.atan2(x, y));
};

Native["java/lang/Math.sin.(D)D"] = function(addr, valLow, valHigh) {
    aliasedI32[0] = valLow;
    aliasedI32[1] = valHigh;
    return J2ME.returnDoubleValue(Math.sin(aliasedF64[0]));
};

Native["java/lang/Math.cos.(D)D"] = function(addr, valLow, valHigh) {
    aliasedI32[0] = valLow;
    aliasedI32[1] = valHigh;
    return J2ME.returnDoubleValue(Math.cos(aliasedF64[0]));
};

Native["java/lang/Math.tan.(D)D"] = function(addr, valLow, valHigh) {
    aliasedI32[0] = valLow;
    aliasedI32[1] = valHigh;
    return J2ME.returnDoubleValue(Math.tan(aliasedF64[0]));
};

Native["java/lang/Math.sqrt.(D)D"] = function(addr, valLow, valHigh) {
    aliasedI32[0] = valLow;
    aliasedI32[1] = valHigh;
    return J2ME.returnDoubleValue(Math.sqrt(aliasedF64[0]));
};

Native["java/lang/Math.ceil.(D)D"] = function(addr, valLow, valHigh) {
    aliasedI32[0] = valLow;
    aliasedI32[1] = valHigh;
    return J2ME.returnDoubleValue(Math.ceil(aliasedF64[0]));
};

Native["java/lang/Math.floor.(D)D"] = function(addr, valLow, valHigh) {
    aliasedI32[0] = valLow;
    aliasedI32[1] = valHigh;
    return J2ME.returnDoubleValue(Math.floor(aliasedF64[0]));
};

Native["java/lang/Thread.currentThread.()Ljava/lang/Thread;"] = function(addr) {
    return $.ctx.threadAddress;
};

Native["java/lang/Thread.setPriority0.(II)V"] = function(addr, oldPriority, newPriority) {
    var ctx = NativeMap.get(addr);
    if (ctx) {
        ctx.priority = newPriority;
    }
};

Native["java/lang/Thread.start0.()V"] = function(addr) {
    var self = getHandle(addr);

    // The main thread starts during bootstrap and don't allow calling start()
    // on already running threads.
    if (addr === $.ctx.runtime.mainThread || self.nativeAlive)
        throw $.newIllegalThreadStateException();
    self.nativeAlive = 1;
    // XXX self.pid seems to be unused, so remove it.
    self.pid = util.id();
    // Create a context for the thread and start it.
    var newCtx = new Context($.ctx.runtime);
    newCtx.threadAddress = addr;
    J2ME.setNative(addr, newCtx);
    newCtx.priority = self.priority;

    var classInfo = CLASSES.getClass("org/mozilla/internal/Sys");
    var run = classInfo.getMethodByNameString("runThread", "(Ljava/lang/Thread;)V", true);
    newCtx.nativeThread.pushMarkerFrame(J2ME.FrameType.ExitInterpreter);
    newCtx.nativeThread.pushFrame(run);
    newCtx.nativeThread.frame.setParameter(J2ME.Kind.Reference, 0, addr);
    newCtx.start();
}

Native["java/lang/Thread.activeCount.()I"] = function(addr) {
    return $.ctx.runtime.threadCount;
};

var consoleBuffer = "";

function flushConsoleBuffer() {
    if (consoleBuffer.length) {
        var temp = consoleBuffer;
        consoleBuffer = "";
        console.info(temp);
    }
}

console.print = function(ch) {
    if (ch === 10) {
        flushConsoleBuffer();
    } else {
        consoleBuffer += String.fromCharCode(ch);
    }
};

Native["com/sun/cldchi/io/ConsoleOutputStream.write.(I)V"] = function(addr, ch) {
    console.print(ch);
};

Native["com/sun/cldc/io/ResourceInputStream.open.(Ljava/lang/String;)Ljava/lang/Object;"] = function(addr, nameAddr) {
    var fileName = J2ME.fromStringAddr(nameAddr);
    var data = JARStore.loadFile(fileName);
    var objAddr = J2ME.Constants.NULL;
    if (data) {
        objAddr = J2ME.allocObject(CLASSES.java_lang_Object);
        setNative(objAddr, {
            data: data,
            pos: 0,
        });
    }
    return objAddr;
};

Native["com/sun/cldc/io/ResourceInputStream.clone.(Ljava/lang/Object;)Ljava/lang/Object;"] = function(addr, sourceAddr) {
    var objAddr = J2ME.allocObject(CLASSES.java_lang_Object);
    var sourceDecoder = NativeMap.get(sourceAddr);
    setNative(objAddr, {
        data: new Uint8Array(sourceDecoder.data),
        pos: sourceDecoder.pos,
    });
    return objAddr;
};

Native["com/sun/cldc/io/ResourceInputStream.bytesRemain.(Ljava/lang/Object;)I"] = function(addr, fileDecoderAddr) {
    var handle = NativeMap.get(fileDecoderAddr);
    return handle.data.length - handle.pos;
};

Native["com/sun/cldc/io/ResourceInputStream.readByte.(Ljava/lang/Object;)I"] = function(addr, fileDecoderAddr) {
    var handle = NativeMap.get(fileDecoderAddr);
    return (handle.data.length - handle.pos > 0) ? handle.data[handle.pos++] : -1;
};

Native["com/sun/cldc/io/ResourceInputStream.readBytes.(Ljava/lang/Object;[BII)I"] =
function(addr, fileDecoderAddr, bAddr, off, len) {
    var b = J2ME.getArrayFromAddr(bAddr);
    var handle = NativeMap.get(fileDecoderAddr);
    var data = handle.data;
    var remaining = data.length - handle.pos;
    if (len > remaining)
        len = remaining;
    for (var n = 0; n < len; ++n)
        b[off+n] = data[handle.pos+n];
    handle.pos += len;
    return (len > 0) ? len : -1;
};

Native["com/sun/cldc/isolate/Isolate.registerNewIsolate.()V"] = function(addr) {
    var self = getHandle(addr);
    self._id = util.id();
};

Native["com/sun/cldc/isolate/Isolate.getStatus.()I"] = function(addr) {
    var runtime = NativeMap.get(addr);
    return runtime ? runtime.status : J2ME.RuntimeStatus.New;
};

Native["com/sun/cldc/isolate/Isolate.nativeStart.()V"] = function(addr) {
    $.ctx.runtime.jvm.startIsolate(addr);
};

Native["com/sun/cldc/isolate/Isolate.waitStatus.(I)V"] = function(addr, status) {
    var runtime = NativeMap.get(addr);
    asyncImpl("V", new Promise(function(resolve, reject) {
        if (runtime.status >= status) {
            resolve();
            return;
        }
        function waitForStatus() {
            if (runtime.status >= status) {
                resolve();
                return;
            }
            runtime.waitStatus(waitForStatus);
        }
        waitForStatus();
    }));
};

Native["com/sun/cldc/isolate/Isolate.currentIsolate0.()Lcom/sun/cldc/isolate/Isolate;"] = function(addr) {
    return $.ctx.runtime.isolateAddress;
};

Native["com/sun/cldc/isolate/Isolate.getIsolates0.()[Lcom/sun/cldc/isolate/Isolate;"] = function(addr) {
    var isolatesAddr = J2ME.newObjectArray(Runtime.all.size);
    var isolates = J2ME.getArrayFromAddr(isolatesAddr);
    var n = 0;
    Runtime.all.forEach(function(runtime) {
        isolates[n++] = runtime.isolateAddress;
    });
    return isolatesAddr;
};

Native["com/sun/cldc/isolate/Isolate.setPriority0.(I)V"] = function(addr, newPriority) {
    // XXX Figure out if there's anything to do here.  If not, say so.
};

Native["com/sun/j2me/content/AppProxy.midletIsAdded.(ILjava/lang/String;)V"] = function(addr, suiteId, classNameAddr) {
  console.warn("com/sun/j2me/content/AppProxy.midletIsAdded.(ILjava/lang/String;)V not implemented");
};

Native["com/nokia/mid/impl/jms/core/Launcher.handleContent.(Ljava/lang/String;)V"] = function(addr, contentAddr) {
    var fileName = J2ME.fromStringAddr(contentAddr);

    var ext = fileName.split('.').pop().toLowerCase();
    // https://developer.mozilla.org/en-US/docs/Web/HTML/Element/img#Supported_image_formats
    if (["jpg", "jpeg", "gif", "apng", "png", "bmp", "ico"].indexOf(ext) == -1) {
        console.error("File not supported: " + fileName);
        throw $.newException("File not supported: " + fileName);
    }

    // `fileName` is supposed to be a full path, but we don't support
    // partition, e.g. `C:` or `E:` etc, so the `fileName` we got here
    // is something like: `Photos/sampleImage.jpg`, we need to prepend
    // the root dir to make sure it's valid.
    var imgData = fs.getBlob("/" + fileName);
    if (!imgData) {
        console.error("File not found: " + fileName);
        throw $.newException("File not found: " + fileName);
    }

    var maskId = "image-launcher";
    var mask = document.getElementById(maskId);

    function _revokeImageURL() {
        URL.revokeObjectURL(/url\((.+)\)/ig.exec(mask.style.backgroundImage)[1]);
    }

    if (mask) {
        _revokeImageURL();
    } else {
        mask = document.createElement("div");
        mask.id = maskId;
        mask.onclick = mask.ontouchstart = function() {
            _revokeImageURL();
            mask.parentNode.removeChild(mask);
        };

        document.getElementById("main").appendChild(mask);
    }

    mask.style.backgroundImage = "url(" +
      URL.createObjectURL(imgData) + ")";
};

function addUnimplementedNative(signature, returnValue) {
    var doNotWarn;

    if (typeof returnValue === "function") {
      doNotWarn = returnValue;
    } else {
      doNotWarn = function() { return returnValue };
    }

    var warnOnce = function() {
        console.warn(signature + " not implemented");
        warnOnce = doNotWarn;
        return doNotWarn();
    };

    Native[signature] = function(addr) { return warnOnce() };
}

Native["org/mozilla/internal/Sys.eval.(Ljava/lang/String;)V"] = function(addr, srcAddr) {
    if (!release) {
        eval(J2ME.fromStringAddr(srcAddr));
    }
};

Native["java/lang/String.intern.()Ljava/lang/String;"] = function(addr) {
  var self = getHandle(addr);
  var value = J2ME.getArrayFromAddr(self.value);
  var internedStringAddr = J2ME.internedStrings.getByRange(value, self.offset, self.count);
  if (internedStringAddr !== null) {
    return internedStringAddr;
  }
  J2ME.internedStrings.put(value.subarray(self.offset, self.offset + self.count), addr);
  return addr;
};

var profileStarted = false;
Native["org/mozilla/internal/Sys.startProfile.()V"] = function(addr) {
    if (profile === 4) {
        if (!profileStarted) {
            profileStarted = true;

            console.log("Start profile at: " + performance.now());
            startTimeline();
        }
    }
};

var profileSaved = false;
Native["org/mozilla/internal/Sys.stopProfile.()V"] = function(addr) {
    if (profile === 4) {
        if (!profileSaved) {
            profileSaved = true;

            console.log("Stop profile at: " + performance.now());
            setZeroTimeout(function() {
                stopAndSaveTimeline();
            });
        }
    }
};
