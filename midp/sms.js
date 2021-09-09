/* -*- Mode: Java; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* vim: set shiftwidth=4 tabstop=4 autoindent cindent expandtab: */

'use strict';

MIDP.lastSMSConnection = -1;
MIDP.lastSMSID = -1;
MIDP.smsConnections = {};
MIDP.j2meSMSMessages = [];
MIDP.j2meSMSWaiting = null;
MIDP.nokiaSMSMessages = [];

/**
 * Simulate a received SMS with the given text, sent to the specified addr.
 * (It appears the value of `addr` is unimportant for most apps.)
 */
function receiveSms(text, addr) {
    var sms = {
      text: text,
      addr: addr,
      id: ++MIDP.lastSMSID,
    };

    MIDP.nokiaSMSMessages.push(sms);
    MIDP.j2meSMSMessages.push(sms);

    window.dispatchEvent(new CustomEvent("nokia.messaging", {
      detail: sms
    }));

    if (MIDP.j2meSMSWaiting) {
      MIDP.j2meSMSWaiting();
    }
}

/**
 * This app is listening for SMS messages; for most apps, that means
 * they're looking for the content of a message the app's servers just
 * sent. Prompt the user to enter that code here, and forward it to
 * the app.
 */
function promptForMessageText() {
    startBackgroundAlarm();

    var smsTemplateNode = document.getElementById('sms-listener-prompt');
    var el = smsTemplateNode.cloneNode(true);
    el.style.display = 'block';
    el.classList.add('visible');

    el.querySelector('p.verificationText').textContent = MIDlet.SMSDialogVerificationText;

    var input = el.querySelector('input');
    if (MIDlet.SMSDialogInputType) {
      input.type = MIDlet.SMSDialogInputType;
    }
    var btnCancel = el.querySelector('button.cancel');
    var btnDone = el.querySelector('button.recommend');

    btnDone.disabled = true; // Wait for input before enabling.
    input.addEventListener('input', function() {
        btnDone.disabled = (input.value.length === 0);
    });
    if (MIDlet.SMSDialogInputMaxLength) {
      input.onkeydown = function(e) {
        if (input.value.length >= MIDlet.SMSDialogInputMaxLength) {
          return e.keyCode !== 0 && !util.isPrintable(e.keyCode);
        }

        return true;
      }
    }

    btnCancel.addEventListener('click', function() {
        console.warn('SMS prompt canceled.');
        clearInterval(intervalID);
        clearTimeout(timeoutID);
        el.parentElement.removeChild(el);
    });

    btnDone.addEventListener('click', function() {
        clearInterval(intervalID);
        clearTimeout(timeoutID);
        el.parentElement.removeChild(el);
        // We don't have easy access to our own phone number; use a
        // dummy unknown value instead.
        receiveSms(MIDlet.SMSDialogReceiveFilter(input.value), 'unknown');
    });

    function toTimeText(ms) {
      var seconds = ms / 1000;
      var minutes = Math.floor(seconds / 60);
      seconds -= minutes * 60;

      var text = minutes + ":";

      if (seconds >= 10) {
        text += seconds;
      } else {
        text += "0" + seconds;
      }

      return text;
    }

    el.querySelector('p.timeLeft').textContent = toTimeText(MIDlet.SMSDialogTimeout) +
                                                 " " + MIDlet.SMSDialogTimeoutText;

    smsTemplateNode.parentNode.appendChild(el);
    if (currentlyFocusedTextEditor) {
      currentlyFocusedTextEditor.blur();
      currentlyFocusedTextEditor = null;
    }

    var elapsedMS = 0;
    var intervalID = setInterval(function() {
      elapsedMS += 1000;
      el.querySelector('p.timeLeft').textContent = toTimeText(MIDlet.SMSDialogTimeout - elapsedMS) +
                                                   " " + MIDlet.SMSDialogTimeoutText;
      el.querySelector('progress.timeLeftBar').value = elapsedMS / MIDlet.SMSDialogTimeout * 100;
    }, 1000);

    // Remove the dialog after a timeout
    var timeoutID = setTimeout(function() {
        clearInterval(intervalID);
        el.parentElement.removeChild(el);
    }, MIDlet.SMSDialogTimeout);
}

Native["com/sun/midp/io/j2me/sms/Protocol.open0.(Ljava/lang/String;II)I"] = function(addr, hostAddr, msid, port) {
    MIDP.smsConnections[++MIDP.lastSMSConnection] = {
      port: port,
      msid: msid,
      host: J2ME.fromStringAddr(hostAddr),
    };

    return ++MIDP.lastSMSConnection;
};

Native["com/sun/midp/io/j2me/sms/Protocol.receive0.(IIILcom/sun/midp/io/j2me/sms/Protocol$SMSPacket;)I"] =
function(addr, port, msid, handle, smsPacketAddr) {
    var smsPacket = getHandle(smsPacketAddr);
    asyncImpl("I", new Promise(function(resolve, reject) {
        function receiveSMS() {
            var sms = MIDP.j2meSMSMessages.shift();
            var text = sms.text;
            var addr = sms.addr;

            var messageAddr = J2ME.newByteArray(text.length);
            smsPacket.message = messageAddr;
            var message = J2ME.getArrayFromAddr(messageAddr);
            for (var i = 0; i < text.length; i++) {
                message[i] = text.charCodeAt(i);
            }

            var addressAddr = J2ME.newByteArray(addr.length);
            smsPacket.address = addressAddr;
            var address = J2ME.getArrayFromAddr(addressAddr);
            for (var i = 0; i < addr.length; i++) {
                address[i] = addr.charCodeAt(i);
            }

            smsPacket.port = port;
            smsPacket.sentAt = Date.now();
            smsPacket.messageType = 0; // GSM_TEXT

            return text.length;
        }

        if (MIDP.j2meSMSMessages.length > 0) {
          resolve(receiveSMS());
        } else {
          MIDP.j2meSMSWaiting = function() {
            MIDP.j2meSMSWaiting = null;
            resolve(receiveSMS());
          }
        }
    }));
};

Native["com/sun/midp/io/j2me/sms/Protocol.close0.(III)I"] = function(addr, port, handle, deRegister) {
    delete MIDP.smsConnections[handle];
    return 0;
};

Native["com/sun/midp/io/j2me/sms/Protocol.numberOfSegments0.([BIIZ)I"] =
function(addr, msgBufferAddr, msgLen, msgType, hasPort) {
    console.warn("com/sun/midp/io/j2me/sms/Protocol.numberOfSegments0.([BIIZ)I not implemented");
    return 1;
};

Native["com/sun/midp/io/j2me/sms/Protocol.send0.(IILjava/lang/String;II[B)I"] =
function(addr, handle, type, hostAddr, destPort, sourcePort, messageAddr) {
    var message = J2ME.getArrayFromAddr(messageAddr);
    var ctx = $.ctx;
    asyncImpl("I", new Promise(function(resolve, reject) {
        var pipe = DumbPipe.open("mozActivity", {
            name: "new",
            data: {
                type: "websms/sms",
                number: J2ME.fromStringAddr(hostAddr),
                body: new TextDecoder('utf-16be').decode(message),
            },
        }, function(message) {
            switch (message.type) {
                case "onsuccess":
                    DumbPipe.close(pipe);
                    resolve(message.byteLength);
                    break;

                case "onerror":
                    ctx.setAsCurrentContext();
                    reject($.newIOException("Error while sending SMS message"));
                    break;
            }
        });
    }));
};
