///<reference path='bld/j2me-jsc.d.ts' />
var jsGlobal = (function () { return this || (1, eval)('this'); })();
if (!jsGlobal.performance) {
    jsGlobal.performance = {};
}
if (!jsGlobal.performance.now) {
    jsGlobal.performance.now = typeof dateNow !== 'undefined' ? dateNow : Date.now;
}
console.info = function (c) {
    putstr(String.fromCharCode(c));
};
console.error = function (c) {
    putstr(String.fromCharCode(c));
};
// Overwrite the shell's |quit| method because emscripten generated code calls it prematurely and we
// don't want to exit.
function quit() { }
load("bld/native.js"); // Load before we polyfill the window object.
var CC = {};
// Define objects and functions that j2me.js expects
// but are unavailable in the shell environment.
jsGlobal.window = {
    nextTickBeforeEvents: function (callback) {
        callback();
    },
    addEventListener: function () {
    },
    crypto: {
        getRandomValues: function () {
        },
    },
};
jsGlobal.navigator = {
    language: "en-US",
};
jsGlobal.document = {
    documentElement: {
        classList: {
            add: function () {
            },
        },
    },
    querySelector: function () {
        return {
            addEventListener: function () {
            },
        };
    },
    getElementById: function () {
        return {
            addEventListener: function () {
            },
            getContext: function () {
            },
            getBoundingClientRect: function () {
                return { top: 0, left: 0, width: 0, height: 0 };
            }
        };
    },
    addEventListener: function () {
    },
};
jsGlobal.config = {
    logConsole: "native",
    args: "",
};
jsGlobal.Promise = function () {
};
var J2ME;
(function (J2ME) {
    var isNode = typeof process === 'object';
    var writer;
    var rootPath = "";
    function loadFiles() {
        var files = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            files[_i - 0] = arguments[_i];
        }
        for (var i = 0; i < files.length; i++) {
            load(rootPath + files[i]);
        }
    }
    loadFiles("blackBox.js", "libs/encoding.js", "bld/j2me-jsc.js", "libs/zipfile.js", "libs/jarstore.js", "util.js");
    J2ME.phase = 1 /* Compiler */;
    writer = new J2ME.IndentingWriter();
    var verboseOption;
    var classpathOption;
    var callGraphOption;
    var jarFileFilterOption;
    var classFileFilterOption;
    var classFilterOption;
    var methodFilterOption;
    var methodFileFilterOption;
    var fileFilterOption;
    var debuggerOption;
    var releaseOption;
    function main(commandLineArguments) {
        var options = new J2ME.Options.OptionSet("J2ME");
        var shellOptions = options.register(new J2ME.Options.OptionSet(""));
        verboseOption = shellOptions.register(new J2ME.Options.Option("v", "verbose", "boolean", false, "Verbose"));
        classpathOption = shellOptions.register(new J2ME.Options.Option("cp", "classpath", "string []", [], "Compile ClassPath"));
        callGraphOption = shellOptions.register(new J2ME.Options.Option("cg", "callGraph", "string []", [], "Call Grpah Files"));
        jarFileFilterOption = shellOptions.register(new J2ME.Options.Option("jf", "jarFileFilter", "string", "", "Compile Jar File Filter"));
        classFileFilterOption = shellOptions.register(new J2ME.Options.Option("cff", "classFileFilter", "string", "", "Compile Class File Filter"));
        methodFileFilterOption = shellOptions.register(new J2ME.Options.Option("mff", "methodFileFilter", "string", "", "Compile Metgod File Filter"));
        classFilterOption = shellOptions.register(new J2ME.Options.Option("cf", "classFilter", "string", ".*", "Compile Class Filter"));
        methodFilterOption = shellOptions.register(new J2ME.Options.Option("mf", "methodFilter", "string", "", "Compile Method Filter"));
        fileFilterOption = shellOptions.register(new J2ME.Options.Option("ff", "fileFilter", "string", ".*", "Compile File Filter"));
        debuggerOption = shellOptions.register(new J2ME.Options.Option("d", "debugger", "boolean", false, "Emit Debug Information"));
        releaseOption = shellOptions.register(new J2ME.Options.Option("r", "release", "boolean", false, "Release mode"));
        var argumentParser = new J2ME.Options.ArgumentParser();
        argumentParser.addBoundOptionSet(shellOptions);
        function printUsage() {
            writer.enter("J2ME Command Line Interface");
            options.trace(writer);
            writer.leave("");
        }
        argumentParser.addArgument("h", "help", "boolean", {
            parse: function (x) {
                printUsage();
            }
        });
        var files = [];
        // Try and parse command line arguments.
        try {
            argumentParser.parse(commandLineArguments);
            classpathOption.value.filter(function (value, index, array) {
                if (value.endsWith(".jar")) {
                    files.push(value);
                }
                else {
                    return true;
                }
            });
            callGraphOption.value.filter(function (value, index, array) {
                if (value.endsWith(".json")) {
                    var calls = JSON.parse(snarf(value));
                    var Y = {};
                    Y["java/io/ByteArrayOutputStream.write.(I)V"] = true;
                    var changed = true;
                    while (changed) {
                        changed = false;
                        for (var k in calls) {
                            if (Y[k]) {
                                continue;
                            }
                            for (var z in Y) {
                                if (calls[k].indexOf(z) >= 0) {
                                    Y[k] = true;
                                    changed = true;
                                    break;
                                }
                            }
                        }
                    }
                    writer.writeLn(JSON.stringify(Y, null, 2));
                }
                else {
                    return true;
                }
            });
        }
        catch (x) {
            writer.writeLn(x.message);
            writer.writeLns(x.stack);
            quit();
        }
        var jarFiles = Object.create(null);
        var jvm = new J2ME.JVM();
        for (var i = 0; i < files.length; i++) {
            var file = files[i];
            if (file.endsWith(".jar")) {
                if (verboseOption.value) {
                    writer.writeLn("Loading: " + file);
                }
                var data = snarf(file, "binary").buffer;
                JARStore.addBuiltIn(file, data);
                jarFiles[file] = new ZipFile(data);
            }
        }
        J2ME.CLASSES.initializeBuiltinClasses();
        if (verboseOption.value) {
            writer.writeLn("Compiling Pattern: " + classFilterOption.value + " " + classFileFilterOption.value + " " + methodFileFilterOption.value);
        }
        var classNameList;
        if (classFileFilterOption.value) {
            var file;
            try {
                file = snarf(classFileFilterOption.value, "text");
            }
            catch (e) {
            }
            if (file) {
                classNameList = file.replace(/\r?\n/g, "\n").split("\n");
            }
        }
        var methodFilterList = null;
        if (methodFileFilterOption.value) {
            var file;
            try {
                file = snarf(methodFileFilterOption.value, "text");
            }
            catch (e) {
            }
            if (file) {
                methodFilterList = [];
                var lines = file.replace(/\r?\n/g, "\n").split("\n");
                for (var i = 0; i < lines.length; i++) {
                    // Trim Whitespace
                    var line = lines[i].replace(/^\s+|\s+$/g, "");
                    if (line === "") {
                        continue;
                    }
                    methodFilterList.push(line);
                }
            }
        }
        function jarFilter(file) {
            if (jarFileFilterOption.value) {
                return file === jarFileFilterOption.value;
            }
            return true;
        }
        function classFilter(classInfo) {
            if (classNameList) {
                return classNameList.indexOf(classInfo.getClassNameSlow()) >= 0;
            }
            else if (classFilterOption.value) {
                return !!classInfo.getClassNameSlow().match(classFilterOption.value);
            }
            return false;
        }
        if (methodFilterOption.value) {
            methodFilterList = [methodFilterOption.value];
        }
        J2ME.stdoutWriter.writeLn("var start = performance.now();");
        J2ME.compile(jvm, jarFiles, jarFilter, classFilter, methodFilterList, fileFilterOption.value, debuggerOption.value);
        J2ME.stdoutWriter.writeLn("console.log(\"Loaded " + jarFileFilterOption.value + " in \" + (performance.now() - start).toFixed(2) + \" ms.\");");
        if (methodFilterList !== null && methodFilterList.length) {
            J2ME.stderrWriter.enter("The following method(s) in the method filter list failed to compile or were not found:");
            for (var i = 0; i < methodFilterList.length; i++) {
                J2ME.stderrWriter.errorLn(methodFilterList[i]);
            }
            J2ME.stderrWriter.leave("");
        }
        if (verboseOption.value) {
        }
    }
    var commandLineArguments;
    // Shell Entry Point
    if (typeof help === "function") {
        // SpiderMonkey
        if (typeof scriptArgs === "undefined") {
            commandLineArguments = arguments;
        }
        else {
            commandLineArguments = scriptArgs;
        }
    }
    else if (isNode) {
        // node.js
        var commandLineArguments = Array.prototype.slice.call(process.argv, 2);
    }
    main(commandLineArguments);
})(J2ME || (J2ME = {}));
//# sourceMappingURL=jsc.js.map