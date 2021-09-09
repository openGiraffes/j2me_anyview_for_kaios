/* -*- Mode: Java; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* vim: set shiftwidth=4 tabstop=4 autoindent cindent expandtab: */

'use strict';

var Media = {};

Media.ContentTypes = {
    memory: [
    ],

    file: [
        "audio/ogg",
        "audio/x-wav",
        "audio/mpeg",
        "image/jpeg",
        "image/png",
        "audio/amr"
    ],

    http: [
        "audio/x-wav",
        "audio/mpeg",
        "image/jpeg",
        "image/png",
        "audio/amr"
    ],

    https: [
        "audio/x-wav",
        "audio/mpeg",
        "image/jpeg",
        "image/png",
        "audio/amr"
    ],

    rtp: [],

    rtsp: [],

    capture: []
};

Media.ListCache = {
    create: function(data) {
        var id = this._nextId;
        this._cached[id] = data;
        if (++this._nextId > 0xffff) {
            this._nextId = 0;
        }
        return id;
    },

    get: function(id) {
        return this._cached[id];
    },

    remove: function(id) {
        delete this._cached[id];
    },

    _cached: {},
    // A valid ID should be greater than 0.
    _nextId: 1
}

Media.extToFormat = new Map([
    ["mp3", "MPEG_layer_3"],
    ["jpg", "JPEG"],
    ["jpeg", "JPEG"],
    ["png", "PNG"],
    ["wav", "wav"],
    ["ogg", "ogg"],
    ["mp4", "MPEG4"],
    ["webm", "WebM"],
    ["amr", "amr"],
]);

Media.contentTypeToFormat = new Map([
    ["audio/ogg", "ogg"],
    ["audio/amr", "amr"],
    ["audio/x-wav", "wav"],
    ["audio/mpeg", "MPEG_layer_3"],
    ["image/jpeg", "JPEG"],
    ["image/png", "PNG"],
    ["video/mp4", "MPEG4"],
    ["video/webm", "WebM"],
]);

Media.formatToContentType = new Map();
for (var elem of Media.contentTypeToFormat) {
    Media.formatToContentType.set(elem[1], elem[0])
}

Media.supportedAudioFormats = ["MPEG_layer_3", "wav", "amr", "ogg"];
Media.supportedImageFormats = ["JPEG", "PNG"];
Media.supportedVideoFormats = ["MPEG4", "WebM"];

Media.EVENT_MEDIA_END_OF_MEDIA = 1;
Media.EVENT_MEDIA_SNAPSHOT_FINISHED = 11;

Media.convert3gpToAmr = function(inBuffer) {
    // The buffer to store the converted amr file.
    var outBuffer = new Uint8Array(inBuffer.length);

    // Add AMR header.
    var AMR_HEADER = "#!AMR\n";
    outBuffer.set(new TextEncoder("utf-8").encode(AMR_HEADER));
    var outOffset = AMR_HEADER.length;

    var textDecoder = new TextDecoder("utf-8");
    var inOffset = 0;
    while (inOffset + 8 < inBuffer.length) {
        // Get the box size
        var size = 0;
        for (var i = 0; i < 4; i++) {
            size = inBuffer[inOffset + i] + (size << 8);
        }
        // Search the box of type mdat.
        var type = textDecoder.decode(inBuffer.subarray(inOffset + 4, inOffset + 8));
        if (type === "mdat" && inOffset + size <= inBuffer.length) {
            // Extract raw AMR data from the box and append to the out buffer.
            var data = inBuffer.subarray(inOffset + 8, inOffset + size);
            outBuffer.set(data, outOffset);
            outOffset += data.length;
        }
        inOffset += size;
    }

    if (outOffset === AMR_HEADER.length) {
        console.warn("Failed to extract AMR from 3GP file.");
    }
    return outBuffer.subarray(0, outOffset);
};

Native["com/sun/mmedia/DefaultConfiguration.nListContentTypesOpen.(Ljava/lang/String;)I"] =
function(addr, protocolAddr) {
    var protocol = J2ME.fromStringAddr(protocolAddr);
    var types = [];
    if (protocol) {
        types = Media.ContentTypes[protocol].slice();
        if (!types) {
            console.warn("Unknown protocol type: " + protocol);
            return 0;
        }
    } else {
        for (var p in Media.ContentTypes) {
            Media.ContentTypes[p].forEach(function(type) {
                if (types.indexOf(type) === -1) {
                    types.push(type);
                }
            });
        }
    }
    if (types.length == 0) {
        return 0;
    }
    return Media.ListCache.create(types);
};

Native["com/sun/mmedia/DefaultConfiguration.nListContentTypesNext.(I)Ljava/lang/String;"] = function(addr, hdlr) {
    var cached = Media.ListCache.get(hdlr);
    if (!cached) {
        console.error("Invalid hdlr: " + hdlr);
        return J2ME.Constants.NULL;
    }
    var s = cached.shift();
    return s ? J2ME.newString(s) : J2ME.Constants.NULL;
};

Native["com/sun/mmedia/DefaultConfiguration.nListContentTypesClose.(I)V"] = function(addr, hdlr) {
    Media.ListCache.remove(hdlr);
};

Native["com/sun/mmedia/DefaultConfiguration.nListProtocolsOpen.(Ljava/lang/String;)I"] = function(addr, mimeAddr) {
    var mime = J2ME.fromStringAddr(mimeAddr);
    var protocols = [];
    for (var protocol in Media.ContentTypes) {
        if (!mime || Media.ContentTypes[protocol].indexOf(mime) >= 0) {
            protocols.push(protocol);
        }
    }
    if (!protocols.length) {
        return 0;
    }
    return Media.ListCache.create(protocols);
};

Native["com/sun/mmedia/DefaultConfiguration.nListProtocolsNext.(I)Ljava/lang/String;"] = function(addr, hdlr) {
    var cached = Media.ListCache.get(hdlr);
    if (!cached) {
        console.error("Invalid hdlr: " + hdlr);
        return J2ME.Constants.NULL;
    }
    var s = cached.shift();
    return s ? J2ME.newString(s) : J2ME.Constants.NULL;
};

Native["com/sun/mmedia/DefaultConfiguration.nListProtocolsClose.(I)V"] = function(addr, hdlr) {
    Media.ListCache.remove(hdlr);
};

Media.PlayerCache = {
};

function AudioPlayer(playerContainer) {
    this.playerContainer = playerContainer;

    this.messageHandlers = {
        mediaTime: [],
        duration: []
    };

    this.sender = DumbPipe.open("audioplayer", {}, function(message) {
        switch (message.type) {
            case "end":
                MIDP.sendEndOfMediaEvent(this.playerContainer.pId, message.duration);
                break;
            case "mediaTime": // fall through
            case "duration":
                var f = this.messageHandlers[message.type].shift();
                if (f) {
                    f(message.data);
                }
                break;
            default:
                console.error("Unknown audioplayer message type: " + message.type)
                break;
        }
    }.bind(this));

    this.paused = true;
    this.loaded = false;
    this.volume = 100;
    this.muted = false;

    this.isVideoControlSupported = false;
    this.isVolumeControlSupported = true;
}

AudioPlayer.prototype.realize = function() {
    return Promise.resolve(1);
};

AudioPlayer.prototype.start = function() {
    if (this.playerContainer.contentSize == 0) {
        console.warn("Cannot start playing.");
        return;
    }

    var array = null;
    if (!this.loaded) {
        var data = this.playerContainer.data.subarray(0, this.playerContainer.contentSize);
        // Convert the data to a regular Array to traverse the mozbrowser boundary.
        var array = Array.prototype.slice.call(data);
        array.constructor = Array;
        this.loaded = true;
    }
    this.sender({
        type: "start",
        contentType: this.playerContainer.contentType,
        data: array
    });
    this.paused = false;
};

AudioPlayer.prototype.pause = function() {
    if (this.paused) {
        return;
    }
    this.sender({ type: "pause" });
    this.paused = true;
};

AudioPlayer.prototype.resume = function() {
    if (!this.paused) {
        return;
    }
    this.sender({ type: "play" });
    this.paused = false;
};

AudioPlayer.prototype.close = function() {
    this.sender({ type: "close" });
    this.paused = true;
    this.loaded = false;
    DumbPipe.close(this.sender);
};

AudioPlayer.prototype.getMediaTime = function() {
    return new Promise(function(resolve, reject) {
        this.sender({ type: "getMediaTime" });
        this.messageHandlers.mediaTime.push(function(data) {
            resolve(data);
        });
    }.bind(this));
};

// The range of ms has already been checked, we don't need to check it again.
AudioPlayer.prototype.setMediaTime = function(ms) {
    this.sender({ type: "setMediaTime", data: ms });
    return ms;
};

AudioPlayer.prototype.getVolume = function() {
    return this.volume;
};

AudioPlayer.prototype.setVolume = function(level) {
    if (level < 0) {
        level = 0;
    } else if (level > 100) {
        level = 100;
    }
    this.sender({ type: "setVolume", data: level });
    this.volume = level;
    return level;
};

AudioPlayer.prototype.getMute = function() {
    return this.muted;
};

AudioPlayer.prototype.setMute = function(mute) {
    this.muted = mute;
    this.sender({ type: "setMute", data: mute });
};

AudioPlayer.prototype.getDuration = function() {
    return new Promise(function(resolve, reject) {
        this.sender({ type: "getDuration" });
        this.messageHandlers.duration.push(function(data) {
            resolve(data);
        });
    }.bind(this));
};

function ImagePlayer(playerContainer) {
    this.url = playerContainer.url;

    this.image = new Image();
    this.image.style.position = "absolute";
    this.image.style.visibility = "hidden";

    this.isVideoControlSupported = true;
    this.isVolumeControlSupported = false;
}

ImagePlayer.prototype.realize = function() {
    var ctx = $.ctx;

    var p = new Promise((function(resolve, reject) {
        this.image.onload = resolve.bind(null, 1);
        this.image.onerror = function() {
            ctx.setAsCurrentContext();
            reject($.newMediaException("Failed to load image"));
        };

        if (this.url.startsWith("file")) {
            this.image.src = URL.createObjectURL(fs.getBlob(this.url.substring(7)));
        } else {
            this.image.src = this.url;
        }
    }).bind(this));

    p.catch(function() {
      // Ignore promise rejection, we only need to revoke the object URL
    }).then((function() {
        if (!this.image.src) {
            return;
        }
        URL.revokeObjectURL(this.image.src);
    }).bind(this));

    return p;
}

ImagePlayer.prototype.start = function() {
}

ImagePlayer.prototype.pause = function() {
}

ImagePlayer.prototype.close = function() {
    if (this.image.parentNode) {
        this.image.parentNode.removeChild(this.image);
    }
}

ImagePlayer.prototype.getMediaTime = function() {
    return -1;
}

ImagePlayer.prototype.getWidth = function() {
    return this.image.naturalWidth;
}

ImagePlayer.prototype.getHeight = function() {
    return this.image.naturalHeight;
}

ImagePlayer.prototype.setLocation = function(x, y, w, h) {
    this.image.style.left = x + "px";
    this.image.style.top = y + "px";
    this.image.style.width = w + "px";
    this.image.style.height = h + "px";
    document.getElementById("main").appendChild(this.image);
}

ImagePlayer.prototype.setVisible = function(visible) {
    this.image.style.visibility = visible ? "visible" : "hidden";
}

function VideoPlayer(playerContainer) {
    this.playerContainer = playerContainer;

    this.video = document.createElement("video");
    this.video.style.position = "absolute";
    this.video.style.visibility = "hidden";

    this.isVideoControlSupported = true;
    this.isVolumeControlSupported = true;

    // VideoPlayer::start could be called while the video element
    // is hidden, causing the call to HTMLVideoElement::play to be
    // ignored.
    // Thus, we need to call HTMLVideoElement::play when the element
    // gets visible.
    this.isPlaying = false;
}

VideoPlayer.prototype.realize = function() {
    var ctx = $.ctx;

    var p = new Promise((function(resolve, reject) {
        this.video.addEventListener("canplay", (function onCanPlay() {
            this.video.removeEventListener("canplay", onCanPlay);
            resolve(1);
        }).bind(this));

        this.video.onerror = function() {
            ctx.setAsCurrentContext();
            reject($.newMediaException("Failed to load video"));
        };

        if (this.playerContainer.url.startsWith("file")) {
            this.video.src = URL.createObjectURL(fs.getBlob(this.playerContainer.url.substring(7)),
                                                 { type: this.playerContainer.contentType });
        } else {
            this.video.src = this.playerContainer.url;
        }
    }).bind(this));

    p.catch(function() {
      // Ignore promise rejection, we only need to revoke the object URL
    }).then((function() {
        if (!this.video.src) {
            return;
        }
        URL.revokeObjectURL(this.video.src);
    }).bind(this));

    return p;
}

VideoPlayer.prototype.start = function() {
    if (this.video.style.visibility === "hidden") {
        this.isPlaying = true;
    } else {
        this.video.play();
    }
}

VideoPlayer.prototype.pause = function() {
    this.video.pause();
    this.isPlaying = false;
}

VideoPlayer.prototype.close = function() {
    if (this.video.parentNode) {
        this.video.parentNode.removeChild(this.video);
    }
    this.pause();
}

VideoPlayer.prototype.getMediaTime = function() {
    return Math.round(this.video.currentTime * 1000);
}

VideoPlayer.prototype.getWidth = function() {
    return this.video.videoWidth;
}

VideoPlayer.prototype.getHeight = function() {
    return this.video.videoHeight;
}

VideoPlayer.prototype.setLocation = function(x, y, w, h) {
    this.video.style.left = x + "px";
    this.video.style.top = y + "px";
    this.video.style.width = w + "px";
    this.video.style.height = h + "px";
    document.getElementById("main").appendChild(this.video);
}

VideoPlayer.prototype.setVisible = function(visible) {
    this.video.style.visibility = visible ? "visible" : "hidden";
    if (visible && this.isPlaying) {
        this.video.play();
    }
}

VideoPlayer.prototype.getVolume = function() {
    return Math.floor(this.video.volume * 100);
};

VideoPlayer.prototype.setVolume = function(level) {
    if (level < 0) {
        level = 0;
    } else if (level > 100) {
        level = 100;
    }
    this.video.volume = level / 100;
    return level;
};

function ImageRecorder(playerContainer) {
    this.playerContainer = playerContainer;

    this.sender = null;

    this.width = -1;
    this.height = -1;

    this.isVideoControlSupported = true;
    this.isVolumeControlSupported = false;

    this.realizeResolver = null;

    this.snapshotData = null;
    this.ctx = $.ctx;
}

ImageRecorder.prototype.realize = function() {
    return new Promise((function(resolve, reject) {
        this.realizeResolver = resolve;
        this.realizeRejector = reject;
        this.sender = DumbPipe.open("camera", {}, this.recipient.bind(this));
    }).bind(this));
}

ImageRecorder.prototype.recipient = function(message) {
    switch (message.type) {
        case "initerror":
            this.ctx.setAsCurrentContext();
            if (message.name == "PermissionDeniedError") {
                this.realizeRejector($.newSecurityException("Not permitted to init camera"));
            } else {
                this.realizeRejector($.newMediaException("Failed to init camera, no camera?"));
            }
            this.realizeResolver = null;
            this.realizeRejector = null;
            this.sender({ type: "close" });
            break;

        case "gotstream":
            this.width = message.width;
            this.height = message.height;
            this.realizeResolver(1);
            this.realizeResolver = null;
            this.realizeRejector = null;
            break;

        case "snapshot":
            this.snapshotData = new Int8Array(message.data.byteLength);
            this.snapshotData.set(new Int8Array(message.data));
            MIDP.sendMediaSnapshotFinishedEvent(this.playerContainer.pId);
            break;
    }
}

ImageRecorder.prototype.start = function() {
}

ImageRecorder.prototype.pause = function() {
}

ImageRecorder.prototype.close = function() {
    this.sender({ type: "close" });
}

ImageRecorder.prototype.getMediaTime = function() {
    return -1;
}

ImageRecorder.prototype.getWidth = function() {
    return this.width;
}

ImageRecorder.prototype.getHeight = function() {
    return this.height;
}

ImageRecorder.prototype.setLocation = function(x, y, w, h) {
    var displayContainer = document.getElementById("display-container");
    this.sender({
        type: "setPosition",
        x: x + displayContainer.offsetLeft,
        y: y + displayContainer.offsetTop,
        w: w,
        h: h,
    });
}

ImageRecorder.prototype.setVisible = function(visible) {
    this.sender({ type: "setVisible", visible: visible });
}

ImageRecorder.prototype.startSnapshot = function(imageType) {
    var type = imageType ? this.playerContainer.getEncodingParam(imageType) : "image/jpeg";
    if (type === "jpeg") {
        type = "image/jpeg";
    }

    this.sender({ type: "snapshot", imageType: type });
}

ImageRecorder.prototype.getSnapshotData = function(imageType) {
    return this.snapshotData;
}

function PlayerContainer(url, pId) {
    this.url = url;
    // `pId` is the player id used in PlayerImpl.java, don't confuse with the id we used
    // here in Javascript. The reason we need to hold this `pId` is we need to send it
    // back when dispatch events, such as Media.EVENT_MEDIA_SNAPSHOT_FINISHED and
    // Media.EVENT_MEDIA_END_OF_MEDIA.
    this.pId = pId;

    this.mediaFormat = url ? this.guessFormatFromURL(url) : "UNKNOWN";
    this.contentType = "";

    this.wholeContentSize = -1;
    this.contentSize = 0;
    this.data = null;

    this.player = null;
}

// default buffer size 1 MB
PlayerContainer.DEFAULT_BUFFER_SIZE  = 1024 * 1024;

PlayerContainer.prototype.isImageCapture = function() {
    return !!(this.url && this.url.startsWith("capture://image"));
};

PlayerContainer.prototype.isAudioCapture = function() {
    return !!(this.url && this.url.startsWith("capture://audio"));
};

PlayerContainer.prototype.getEncodingParam = function(url) {
    var encoding = null;

    var idx = url.indexOf("encoding=");
    if (idx > -1) {
        var encodingKeyPair = url.substring(idx).split("&")[0].split("=");
        encoding = encodingKeyPair.length == 2 ? encodingKeyPair[1] : encoding;
    }

    return encoding;
};

PlayerContainer.prototype.guessFormatFromURL = function() {
    if (this.isAudioCapture()) {
        var encoding = "audio/ogg" || this.getEncodingParam(this.url); // Same as system property |audio.encodings|

        var format = Media.contentTypeToFormat.get(encoding);

        return format || "UNKNOWN";
    }

    if (this.isImageCapture()) {
        return "JPEG";
    }

    return Media.extToFormat.get(this.url.substr(this.url.lastIndexOf(".") + 1)) || "UNKNOWN";
}

PlayerContainer.prototype.realize = function(contentType) {
    return new Promise((function(resolve, reject) {
        if (contentType) {
            this.contentType = contentType;
            this.mediaFormat = Media.contentTypeToFormat.get(contentType) || this.mediaFormat;
            if (this.mediaFormat === "UNKNOWN") {
                console.warn("Unsupported content type: " + contentType);
                resolve(0);
                return;
            }
        } else {
            this.contentType = Media.formatToContentType.get(this.mediaFormat);
        }

        if (Media.supportedAudioFormats.indexOf(this.mediaFormat) !== -1) {
            this.player = new AudioPlayer(this);
            if (this.isAudioCapture()) {
                this.audioRecorder = new AudioRecorder(contentType);
            }
            this.player.realize().then(resolve);
        } else if (Media.supportedImageFormats.indexOf(this.mediaFormat) !== -1) {
            if (this.isImageCapture()) {
                this.player = new ImageRecorder(this);
            } else {
                this.player = new ImagePlayer(this);
            }
            this.player.realize().then(resolve, reject);
        } else if (Media.supportedVideoFormats.indexOf(this.mediaFormat) !== -1) {
            this.player = new VideoPlayer(this);
            this.player.realize().then(resolve, reject);
        } else {
            console.warn("Unsupported media format (" + this.mediaFormat + ") for " + this.url);
            resolve(0);
        }
    }).bind(this));
};

PlayerContainer.prototype.close = function() {
    this.data = null;
    if (this.player) {
        this.player.close();
    }
};

/**
 * @return current time in ms.
 */
PlayerContainer.prototype.getMediaTime = function() {
    return this.player.getMediaTime();
};

PlayerContainer.prototype.getBufferSize = function() {
    return this.wholeContentSize === -1 ? PlayerContainer.DEFAULT_BUFFER_SIZE :
                                          this.wholeContentSize;
};

PlayerContainer.prototype.getMediaFormat = function() {
    if (this.contentSize === 0) {
        return this.mediaFormat;
    }

    var headerString = util.decodeUtf8(this.data.subarray(0, 50));

    // Refer to https://www.ffmpeg.org/doxygen/0.6/amr_8c-source.html.
    if (headerString.indexOf("#!AMR\n") === 0){
        return "amr";
    }

    // Refer to https://www.ffmpeg.org/doxygen/0.6/wav_8c-source.html
    if (headerString.indexOf("RIFF") === 0 && headerString.indexOf("WAVE") === 8) {
        return "wav";
    }

    // Refer to http://www.sonicspot.com/guide/midifiles.html
    if (headerString.indexOf("MThd") === 0) {
        return "mid";
    }

    // https://wiki.xiph.org/Ogg#Detecting_Ogg_files_and_extracting_information
    if (headerString.indexOf("OggS") === 0) {
        return "ogg";
    }

    return this.mediaFormat;
};

PlayerContainer.prototype.getContentType = function() {
    return this.contentType;
};

PlayerContainer.prototype.isHandledByDevice = function() {
    // TODO: Handle download in JS also for audio formats
    return this.url !== null && Media.supportedAudioFormats.indexOf(this.mediaFormat) === -1;
};

PlayerContainer.prototype.isVideoControlSupported = function() {
    return this.player.isVideoControlSupported;
};

PlayerContainer.prototype.isVolumeControlSupported = function() {
    return this.player.isVolumeControlSupported;
};

PlayerContainer.prototype.writeBuffer = function(buffer) {
    if (this.contentSize === 0) {
        this.data = new Int8Array(this.getBufferSize());
    }

    this.data.set(buffer, this.contentSize);
    this.contentSize += buffer.length;
};

PlayerContainer.prototype.start = function() {
    this.player.start();
};

PlayerContainer.prototype.pause = function() {
    this.player.pause();
};

PlayerContainer.prototype.resume = function() {
    this.player.resume();
};

PlayerContainer.prototype.getVolume = function() {
    return this.player.getVolume();
};

PlayerContainer.prototype.setVolume = function(level) {
    this.player.setVolume(level);
};

PlayerContainer.prototype.getMute = function() {
    return this.player.getMute();
};

PlayerContainer.prototype.setMute = function(mute) {
    return this.player.setMute(mute);
};

PlayerContainer.prototype.getWidth = function() {
    return this.player.getWidth();
}

PlayerContainer.prototype.getHeight = function() {
    return this.player.getHeight();
}

PlayerContainer.prototype.setLocation = function(x, y, w, h) {
    this.player.setLocation(x, y, w, h);
}

PlayerContainer.prototype.setVisible = function(visible) {
    this.player.setVisible(visible);
}

PlayerContainer.prototype.getRecordedSize = function() {
    return this.audioRecorder.data.byteLength;
};

PlayerContainer.prototype.getRecordedData = function(offset, size, buffer) {
    var toRead = (size < this.audioRecorder.data.length) ? size : this.audioRecorder.data.byteLength;
    buffer.set(this.audioRecorder.data.subarray(0, toRead), offset);
    this.audioRecorder.data = new Int8Array(this.audioRecorder.data.buffer.slice(toRead));
};

PlayerContainer.prototype.startSnapshot = function(imageType) {
    this.player.startSnapshot(imageType);
}

PlayerContainer.prototype.getSnapshotData = function() {
    var arr = this.player.getSnapshotData();
    if (!arr) {
        return Constants.NULL;
    }

    var retArr = J2ME.newByteArray(arr.length);
    J2ME.getArrayFromAddr(retArr).set(arr);
    return retArr;
}

PlayerContainer.prototype.getDuration = function() {
    return this.player.getDuration();
}

var AudioRecorder = function(aMimeType) {
    this.mimeType = aMimeType || "audio/3gpp";
    this.eventListeners = {};
    this.data = new Int8Array();
    this.sender = DumbPipe.open("audiorecorder", {
        mimeType: this.mimeType
    }, this.recipient.bind(this));
};

AudioRecorder.prototype.getContentType = function() {
    if (this.mimeType == "audio/3gpp") {
        return "audio/amr";
    }

    return this.mimeType;
};

AudioRecorder.prototype.recipient = function(message) {
    var callback = this["on" + message.type];
    if (typeof callback === "function") {
        callback(message);
    }

    if (this.eventListeners[message.type]) {
        this.eventListeners[message.type].forEach(function(listener) {
            if (typeof listener === "function") {
                listener(message);
            }
        });
    }
};

AudioRecorder.prototype.addEventListener = function(name, callback) {
    if (!callback || !name) {
        return;
    }

    if (!this.eventListeners[name]) {
        this.eventListeners[name] = [];
    }

    this.eventListeners[name].push(callback);
};

AudioRecorder.prototype.removeEventListener = function(name, callback) {
    if (!name || !callback || !this.eventListeners[name]) {
        return;
    }

    var newArray = [];
    this.eventListeners[name].forEach(function(listener) {
        if (callback != listener) {
            newArray.push(listener);
        }
    });

    this.eventListeners[name] = newArray;
};

AudioRecorder.prototype.start = function() {
    return new Promise(function(resolve, reject) {
        this.onstart = function() {
            this.onstart = null;
            this.onerror = null;
            resolve(1);
        }.bind(this);

        this.onerror = function() {
            this.onstart = null;
            this.onerror = null;
            resolve(0);
        }.bind(this);

        this.sender({ type: "start" });
    }.bind(this));
};

AudioRecorder.prototype.stop = function() {
    return new Promise(function(resolve, reject) {
        // To make sure the Player in Java can fetch data immediately, we
        // need to return after data is back.
        this.ondata = function ondata(message) {
            _cleanEventListeners();

            // The audio data we received are encoded with a proper format, it doesn't
            // make sense to concatenate them like the socket, so let just override
            // the buffered data here.
            var data = new Int8Array(message.data);
            if (this.getContentType() === "audio/amr") {
                data = Media.convert3gpToAmr(data);
            }
            this.data = data;
            resolve(1);
        }.bind(this);

        var _onerror = function() {
            _cleanEventListeners();
            resolve(0);
        }.bind(this);

        var _cleanEventListeners = function() {
            this.ondata = null;
            this.removeEventListener("error", _onerror);
        }.bind(this);

        this.addEventListener("error", _onerror);
        this.sender({ type: "stop" });
    }.bind(this));
};

AudioRecorder.prototype.pause = function() {
    return new Promise(function(resolve, reject) {
        // In Java, |stopRecord| might be called before |commit|, which triggers
        // the calling sequence:
        //    nPause -> nGetRecordedSize -> nGetRecordedData -> nClose
        //
        // to make sure the Player in Java can fetch data in such a case, we
        // need to request data immediately.
        //
        this.ondata = function ondata(message) {
            this.ondata = null;

            // The audio data we received are encoded with a proper format, it doesn't
            // make sense to concatenate them like the socket, so let just override
            // the buffered data here.
            this.data = new Int8Array(message.data);
            resolve(1);
        }.bind(this);

        // Have to request data first before pausing.
        this.requestData();
        this.sender({ type: "pause" });
    }.bind(this));
};

AudioRecorder.prototype.requestData = function() {
    this.sender({ type: "requestData" });
};

AudioRecorder.prototype.close = function() {
    if (this._closed) {
        return Promise.resolve(1);
    }

    // Make sure recording is stopped on the other side.
    return this.stop().then(function(result) {
        DumbPipe.close(this.sender);
        this._closed = true;
        return result;
    }.bind(this));
};

Native["com/sun/mmedia/PlayerImpl.nInit.(IILjava/lang/String;)I"] = function(addr, appId, pId, URIAddr) {
    var url = J2ME.fromStringAddr(URIAddr);
    var id = pId + (appId << 15);
    Media.PlayerCache[id] = new PlayerContainer(url, pId);
    return id;
};

/**
 * @return 0 - failed; 1 - succeeded.
 */
Native["com/sun/mmedia/PlayerImpl.nTerm.(I)I"] = function(addr, handle) {
    var player = Media.PlayerCache[handle];
    if (!player) {
        return 1;
    }
    player.close();
    delete Media.PlayerCache[handle];
    return 1;
};

Native["com/sun/mmedia/PlayerImpl.nGetMediaFormat.(I)Ljava/lang/String;"] = function(addr, handle) {
    var player = Media.PlayerCache[handle];
    player.mediaFormat = player.getMediaFormat();
    return J2ME.newString(player.mediaFormat);
};

Native["com/sun/mmedia/DirectPlayer.nGetContentType.(I)Ljava/lang/String;"] = function(addr, handle) {
    return J2ME.newString(Media.PlayerCache[handle].getContentType());
};

Native["com/sun/mmedia/PlayerImpl.nIsHandledByDevice.(I)Z"] = function(addr, handle) {
    return Media.PlayerCache[handle].isHandledByDevice() ? 1 : 0;
};

Native["com/sun/mmedia/PlayerImpl.nRealize.(ILjava/lang/String;)Z"] = function(addr, handle, mimeAddr) {
    var mime = J2ME.fromStringAddr(mimeAddr);
    var player = Media.PlayerCache[handle];
    asyncImpl("Z", player.realize(mime));
};

Native["com/sun/mmedia/MediaDownload.nGetJavaBufferSize.(I)I"] = function(addr, handle) {
    var player = Media.PlayerCache[handle];
    return player.getBufferSize();
};

Native["com/sun/mmedia/MediaDownload.nGetFirstPacketSize.(I)I"] = function(addr, handle) {
    var player = Media.PlayerCache[handle];
    return player.getBufferSize() >>> 1;
};

Native["com/sun/mmedia/MediaDownload.nBuffering.(I[BII)I"] = function(addr, handle, bufferAddr, offset, size) {
    var player = Media.PlayerCache[handle];
    var bufferSize = player.getBufferSize();

    // Check the parameters.
    if (bufferAddr === J2ME.Constants.NULL || size === 0) {
        return bufferSize >>> 1;
    }

    var buffer = J2ME.getArrayFromAddr(bufferAddr);
    player.writeBuffer(buffer.subarray(offset, offset + size));

    // Returns the package size and set it to the half of the java buffer size.
    return bufferSize >>> 1;
};

Native["com/sun/mmedia/MediaDownload.nNeedMoreDataImmediatelly.(I)Z"] = function(addr, handle) {
    console.warn("com/sun/mmedia/MediaDownload.nNeedMoreDataImmediatelly.(I)Z not implemented");
    return 1;
};

Native["com/sun/mmedia/MediaDownload.nSetWholeContentSize.(IJ)V"] = function(addr, handle, contentSizeLow, contentSizeHigh) {
    var player = Media.PlayerCache[handle];
    player.wholeContentSize = J2ME.longToNumber(contentSizeLow, contentSizeHigh);
};

Native["com/sun/mmedia/DirectPlayer.nIsToneControlSupported.(I)Z"] = function(addr, handle) {
    console.info("To support ToneControl, implement com.sun.mmedia.DirectTone.");
    return 0;
};

Native["com/sun/mmedia/DirectPlayer.nIsMIDIControlSupported.(I)Z"] = function(addr, handle) {
    console.info("To support MIDIControl, implement com.sun.mmedia.DirectMIDI.");
    return 0;
};

Native["com/sun/mmedia/DirectPlayer.nIsVideoControlSupported.(I)Z"] = function(addr, handle) {
    return Media.PlayerCache[handle].isVideoControlSupported() ? 1 : 0;
};

Native["com/sun/mmedia/DirectPlayer.nIsVolumeControlSupported.(I)Z"] = function(addr, handle) {
    var player = Media.PlayerCache[handle];
    return player.isVolumeControlSupported() ? 1 : 0;
};

Native["com/sun/mmedia/DirectPlayer.nIsNeedBuffering.(I)Z"] = function(addr, handle) {
    var player = Media.PlayerCache[handle];
    console.warn("com/sun/mmedia/DirectPlayer.nIsNeedBuffering.(I)Z not implemented.");
    return 0;
};

Native["com/sun/mmedia/DirectPlayer.nPcmAudioPlayback.(I)Z"] = function(addr, handle) {
    var player = Media.PlayerCache[handle];
    console.warn("com/sun/mmedia/DirectPlayer.nPcmAudioPlayback.(I)Z not implemented.");
    return 0;
};

// Device is available?
Native["com/sun/mmedia/DirectPlayer.nAcquireDevice.(I)Z"] = function(addr, handle) {
    var player = Media.PlayerCache[handle];
    console.warn("com/sun/mmedia/DirectPlayer.nAcquireDevice.(I)Z not implemented.");
    return 1;
};

// Relase device reference
Native["com/sun/mmedia/DirectPlayer.nReleaseDevice.(I)V"] = function(addr, handle) {
    var player = Media.PlayerCache[handle];
    console.warn("com/sun/mmedia/DirectPlayer.nReleaseDevice.(I)V not implemented.");
};

Native["com/sun/mmedia/DirectPlayer.nSwitchToForeground.(II)Z"] = function(addr, handle, options) {
    var player = Media.PlayerCache[handle];
    console.warn("com/sun/mmedia/DirectPlayer.nSwitchToForeground.(II)Z not implemented. ");
    return 1;
};

Native["com/sun/mmedia/DirectPlayer.nSwitchToBackground.(II)Z"] = function(addr, handle, options) {
    var player = Media.PlayerCache[handle];
    console.warn("com/sun/mmedia/DirectPlayer.nSwitchToBackground.(II)Z not implemented. ");
    return 1;
};

// Start Prefetch of Native Player
Native["com/sun/mmedia/DirectPlayer.nPrefetch.(I)Z"] = function(addr, handle) {
    var player = Media.PlayerCache[handle];
    console.warn("com/sun/mmedia/DirectPlayer.nPrefetch.(I)Z not implemented.");
    return 1;
};

Native["com/sun/mmedia/DirectPlayer.nGetMediaTime.(I)I"] = function(addr, handle) {
    var player = Media.PlayerCache[handle];
    var mediaTime = player.getMediaTime();
    if (mediaTime instanceof Promise) {
        asyncImpl("I", mediaTime);
    } else {
        return mediaTime;
    }
};

Native["com/sun/mmedia/DirectPlayer.nSetMediaTime.(IJ)I"] = function(addr, handle, msLow, msHigh) {
    var container = Media.PlayerCache[handle];
    return container.player.setMediaTime(J2ME.longToNumber(msLow, msHigh));
};

Native["com/sun/mmedia/DirectPlayer.nStart.(I)Z"] = function(addr, handle) {
    var player = Media.PlayerCache[handle];
    player.start();
    return 1;
};

Native["com/sun/mmedia/DirectPlayer.nStop.(I)Z"] = function(addr, handle) {
    var player = Media.PlayerCache[handle];
    player.close();
    return 1;
};

Native["com/sun/mmedia/DirectPlayer.nTerm.(I)I"] = function(addr, handle) {
    var player = Media.PlayerCache[handle];
    player.close();
    delete Media.PlayerCache[handle];
    return 1;
};

Native["com/sun/mmedia/DirectPlayer.nPause.(I)Z"] = function(addr, handle) {
    var player = Media.PlayerCache[handle];
    player.pause();
    return 1;
};

Native["com/sun/mmedia/DirectPlayer.nResume.(I)Z"] = function(addr, handle) {
    var player = Media.PlayerCache[handle];
    player.resume();
    return 1;
};

Native["com/sun/mmedia/DirectPlayer.nGetWidth.(I)I"] = function(addr, handle) {
    return Media.PlayerCache[handle].getWidth();
};

Native["com/sun/mmedia/DirectPlayer.nGetHeight.(I)I"] = function(addr, handle) {
    return Media.PlayerCache[handle].getHeight();
};

Native["com/sun/mmedia/DirectPlayer.nSetLocation.(IIIII)Z"] = function(addr, handle, x, y, w, h) {
    Media.PlayerCache[handle].setLocation(x, y, w, h);
    return 1;
};

Native["com/sun/mmedia/DirectPlayer.nSetVisible.(IZ)Z"] = function(addr, handle, visible) {
    Media.PlayerCache[handle].setVisible(visible);
    return 1;
};

Native["com/sun/mmedia/DirectPlayer.nIsRecordControlSupported.(I)Z"] = function(addr, handle) {
    return !!(Media.PlayerCache[handle] && Media.PlayerCache[handle].audioRecorder) ? 1 : 0;
};

Native["com/sun/mmedia/DirectPlayer.nGetDuration.(I)I"] = function(addr, handle) {
    var duration = Media.PlayerCache[handle].getDuration();
    if (duration instanceof Promise) {
        asyncImpl("I", duration);
    } else {
        return duration;
    }
};

Native["com/sun/mmedia/DirectRecord.nSetLocator.(ILjava/lang/String;)I"] = function(addr, handle, locatorAddr) {
    // Let the DirectRecord class handle writing to files / uploading via HTTP
    return 0;
};

Native["com/sun/mmedia/DirectRecord.nGetRecordedSize.(I)I"] = function(addr, handle) {
    return Media.PlayerCache[handle].getRecordedSize();
};

Native["com/sun/mmedia/DirectRecord.nGetRecordedData.(III[B)I"] = function(addr, handle, offset, size, bufferAddr) {
    var buffer = J2ME.getArrayFromAddr(bufferAddr);
    Media.PlayerCache[handle].getRecordedData(offset, size, buffer);
    return 1;
};

Native["com/sun/mmedia/DirectRecord.nCommit.(I)I"] = function(addr, handle) {
    // In DirectRecord.java, before nCommit, nPause or nStop is called,
    // which means all the recorded data has been fetched, so do nothing here.
    return 1;
};

Native["com/sun/mmedia/DirectRecord.nPause.(I)I"] = function(addr, handle) {
    asyncImpl("I", Media.PlayerCache[handle].audioRecorder.pause());
};

Native["com/sun/mmedia/DirectRecord.nStop.(I)I"] = function(addr, handle) {
    asyncImpl("I", Media.PlayerCache[handle].audioRecorder.stop());
};

Native["com/sun/mmedia/DirectRecord.nClose.(I)I"] = function(addr, handle) {
    var player = Media.PlayerCache[handle];

    if (!player || !player.audioRecorder) {
        // We need to check if |audioRecorder| is still available, because |nClose|
        // might be called twice in DirectRecord.java, and only IOException is
        // handled in DirectRecord.java, let use IOException instead of IllegalStateException.
        throw $.newIOException();
    }

    asyncImpl("I", player.audioRecorder.close().then(function(result) {
       delete player.audioRecorder;
       return result;
    }));
};

Native["com/sun/mmedia/DirectRecord.nStart.(I)I"] = function(addr, handle) {
    // In DirectRecord.java, nStart plays two roles: real start and resume.
    // Let's handle this on the other side of the DumbPipe.
    asyncImpl("I", Media.PlayerCache[handle].audioRecorder.start());
};

Native["com/sun/mmedia/DirectRecord.nGetRecordedType.(I)Ljava/lang/String;"] = function(addr, handle) {
    return J2ME.newString(Media.PlayerCache[handle].audioRecorder.getContentType());
};

/**
 * @return the volume level between 0 and 100 if succeeded. Otherwise -1.
 */
Native["com/sun/mmedia/DirectVolume.nGetVolume.(I)I"] = function(addr, handle) {
    var player = Media.PlayerCache[handle];
    return player.getVolume();
};

/**
 * @param level The volume level between 0 and 100.
 * @return the volume level set between 0 and 100 if succeeded. Otherwise -1.
 */
Native["com/sun/mmedia/DirectVolume.nSetVolume.(II)I"] = function(addr, handle, level) {
    var player = Media.PlayerCache[handle];
    player.setVolume(level);
    return level;
};

Native["com/sun/mmedia/DirectVolume.nIsMuted.(I)Z"] = function(addr, handle) {
    var player = Media.PlayerCache[handle];
    return player.getMute() ? 1 : 0;
};

Native["com/sun/mmedia/DirectVolume.nSetMute.(IZ)Z"] = function(addr, handle, mute) {
    var player = Media.PlayerCache[handle];
    player.setMute(mute);
    return 1;
};

Media.TonePlayerCache = {
};

function TonePlayer() {
    this.audioContext = new AudioContext();

    // Use oscillator to generate tone.
    // @type {OscillatorNode}
    this.oscillator = null;

    // The gain node to control volume.
    this.gainNode = this.audioContext.createGain();
    this.gainNode.connect(this.audioContext.destination);
}

// Volume fade time in seconds.
TonePlayer.FADE_TIME = 0.1;

/*
 * Play back a tone as specified by a note and its duration.
 * A note is given in the range of 0 to 127 inclusive.  The frequency
 * of the note can be calculated from the following formula:
 *     SEMITONE_CONST = 17.31234049066755 = 1/(ln(2^(1/12)))
 *     note = ln(freq/8.176)*SEMITONE_CONST
 *     The musical note A = MIDI note 69 (0x45) = 440 Hz.
 * For the Asha implementaion, the note is shift by adding 21.
 * @param  note  Defines the tone of the note as specified by the above formula.
 * @param  duration  The duration of the tone in milli-seconds. Duration must be
 * positive.
 * @param  volume Audio volume range from 0 to 100.
 */
TonePlayer.prototype.playTone = function(note, duration, volume) {
    if (duration <= 0) {
        return;
    }
    duration /= 1000;

    if (note < 0) {
        note = 0;
    } else if (note > 127) {
        note = 127;
    }
    if (volume < 0) {
        volume = 0;
    } else if (volume > 100) {
        volume = 100;
    }
    volume /= 100;

    // Abort the previous tone.
    if (this.oscillator) {
        this.oscillator.onended = null;
        this.oscillator.disconnect();
    }

    var current = this.audioContext.currentTime;

    this.oscillator = this.audioContext.createOscillator();
    this.oscillator.connect(this.gainNode);

    // The default fequency is equivalent to 69 - 21 note and while 1 note = 100
    // cents.
    // Detune the frequency to the target note.
    this.oscillator.detune.value = (note - 69 + 21) * 100;

    // Fade in.
    this.oscillator.start(current);
    this.gainNode.gain.linearRampToValueAtTime(0, current);
    this.gainNode.gain.linearRampToValueAtTime(volume, current + TonePlayer.FADE_TIME);

    // Fade out.
    this.oscillator.stop(current + duration);
    this.gainNode.gain.linearRampToValueAtTime(volume, current + duration - TonePlayer.FADE_TIME);
    this.gainNode.gain.linearRampToValueAtTime(0, current + duration);
    this.oscillator.onended = function() {
        this.oscillator.disconnect();
        this.oscillator = null;
    }.bind(this);
};

TonePlayer.prototype.stopTone = function() {
    if (!this.oscillator) {
        return;
    }
    var current = this.audioContext.currentTime;
    this.gainNode.gain.linearRampToValueAtTime(0, current + TonePlayer.FADE_TIME);
};

Native["com/sun/mmedia/NativeTonePlayer.nPlayTone.(IIII)Z"] = function(addr, appId, note, duration, volume) {
    if (!Media.TonePlayerCache[appId]) {
        Media.TonePlayerCache[appId] = new TonePlayer();
    }
    Media.TonePlayerCache[appId].playTone(note, duration, volume);
    return 1;
};

Native["com/sun/mmedia/NativeTonePlayer.nStopTone.(I)Z"] = function(addr, appId) {
    Media.TonePlayerCache[appId].stopTone();
    return 1;
};

Native["com/sun/mmedia/DirectPlayer.nStartSnapshot.(ILjava/lang/String;)V"] = function(addr, handle, imageTypeAddr) {
    Media.PlayerCache[handle].startSnapshot(J2ME.fromStringAddr(imageTypeAddr));
};

Native["com/sun/mmedia/DirectPlayer.nGetSnapshotData.(I)[B"] = function(addr, handle) {
    return Media.PlayerCache[handle].getSnapshotData();
};

Native["com/sun/amms/GlobalMgrImpl.nCreatePeer.()I"] = function(addr) {
    console.warn("com/sun/amms/GlobalMgrImpl.nCreatePeer.()I not implemented.");
    return 1;
};

Native["com/sun/amms/GlobalMgrImpl.nGetControlPeer.([B)I"] = function(addr, typeNameAddr) {
    console.warn("com/sun/amms/GlobalMgrImpl.nGetControlPeer.([B)I not implemented.");
    return 2;
};

Native["com/sun/amms/directcontrol/DirectVolumeControl.nSetMute.(Z)V"] = function(addr, mute) {
    console.warn("com/sun/amms/directcontrol/DirectVolumeControl.nSetMute.(Z)V not implemented.");
};

Native["com/sun/amms/directcontrol/DirectVolumeControl.nGetLevel.()I"] = function(addr) {
    console.warn("com/sun/amms/directcontrol/DirectVolumeControl.nGetLevel.()I not implemented.");
    return 100;
};

addUnimplementedNative("com/sun/amms/directcontrol/DirectVolumeControl.nIsMuted.()Z", 0);
