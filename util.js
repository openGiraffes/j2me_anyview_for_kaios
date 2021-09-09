/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

'use strict';

var util = (function () {
  var Utf8TextDecoder = new TextDecoder("utf-8");

  function decodeUtf8(array) {
    return Utf8TextDecoder.decode(array);
  }

  /**
   * Provides a UTF-8 decoder that will throw an exception on error rather
   * than silently sanitizing the output.
   */
  var fallibleUtf8Decoder = new TextDecoder("utf-8", { fatal: true });

  /**
   * Decodes a UTF-8 string stored in an ArrayBufferView.
   *
   * @param arr An ArrayBufferView to decode (such as a Uint8Array).
   * @returns The decoded string.
   * @throws An invalid enoding is encountered, see
   *         TextDecoder.prototype.decode().
   */
  function decodeUtf8Array(arr) {
    return fallibleUtf8Decoder.decode(arr);
  }

  var INT_MAX = Math.pow(2, 31) - 1;
  var INT_MIN = -INT_MAX - 1;

  var id = (function() {
    var gen = 0;
    return function() {
      return ++gen;
    }
  })();

  function pad(num, len) {
    return "0".repeat(len - num.toString().length) + num;
  }

  function toCodePointArray(str) {
    var chars = [];

    var str = str.slice();

    while (str.length > 0) {
      var ucsChars = String.fromCodePoint(str.codePointAt(0));
      chars.push(ucsChars);
      str = str.substr(ucsChars.length);
    }

    return chars;
  }

  // rgbaToCSS() can be called frequently. Using |rgbaBuf| avoids creating
  // many intermediate strings.
  var rgbaBuf = ["rgba(", 0, ",", 0, ",", 0, ",", 0, ")"];

  function rgbaToCSS(r, g, b, a) {
    rgbaBuf[1] = r;
    rgbaBuf[3] = g;
    rgbaBuf[5] = b;
    rgbaBuf[7] = a;
    return rgbaBuf.join('');
  }

  function abgrIntToCSS(pixel) {
    var a = (pixel >> 24) & 0xff;
    var b = (pixel >> 16) & 0xff;
    var g = (pixel >> 8) & 0xff;
    var r = pixel & 0xff;
    return rgbaToCSS(r, g, b, a/255);
  }

  function isPrintable(val) {
    // http://stackoverflow.com/questions/12467240/determine-if-javascript-e-keycode-is-a-printable-non-control-character
    return ((val >= 48 && val <= 57)  ||  // number keys
            val === 32 || val === 13 ||   // spacebar & return key(s) (if you want to allow carriage returns)
            (val >= 65 && val <= 90)   || // letter keys
            (val >= 96 && val <= 111)  || // numpad keys
            (val >= 186 && val <= 192) || // ;=,-./` (in order)
            (val >= 219 && val <= 222));  // [\]' (in order)
  }

  return {
    INT_MAX: INT_MAX,
    INT_MIN: INT_MIN,
    decodeUtf8: decodeUtf8,
    decodeUtf8Array: decodeUtf8Array,
    id: id,
    pad: pad,
    toCodePointArray: toCodePointArray,
    rgbaToCSS: rgbaToCSS,
    abgrIntToCSS: abgrIntToCSS,
    isPrintable: isPrintable,
  };
})();
