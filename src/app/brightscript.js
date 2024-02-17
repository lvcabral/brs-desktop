// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: https://codemirror.net/5/LICENSE

import { StringStream } from "codemirror";

/*
BrightScript Language Mode

https://developer.roku.com/en-gb/docs/references/brightscript/language/brightscript-language-reference.md

*/

export function defineMode(CodeMirror) {
    CodeMirror.defineMode("brightscript", function (conf, parserConf) {
        var ERRORCLASS = "error";

        function wordRegexp(words) {
            return new RegExp("^((" + words.join(")|(") + "))\\b", "i");
        }

        var singleOperators = new RegExp("^[\\+\\-\\*/&\\\\\\^<>=]");
        var doubleOperators = new RegExp("^((<>)|(<=)|(>=)|(<<)|(>>))");
        var singleDelimiters = new RegExp("^[\\.,;:$%!#&@?]");
        var brackets = new RegExp("^[\\(\\)\\[\\]\\{\\}]");
        var functions = new RegExp("^[A-Za-z][_A-Za-z0-9]+(?=\\()");
        var identifiers = new RegExp("^[A-Za-z][_A-Za-z0-9]*");

        var openingKeywords = ["sub", "function"];
        var endKeywords = ["endsub", "endfunction"];

        var openingControl = ["while", "if", "for"];
        var middleControl = [
            "else",
            "elseif",
            "to",
            "step",
            "in",
            "then",
            "each",
            "as",
            "return",
            "stop",
        ];
        var endControl = ["next", "endif", "endfor", "endwhile"];
        var wordOperators = wordRegexp(["and", "or", "not", "mod"]);
        var commonkeywords = ["dim", "print", "library"];
        var commontypes = [
            "object",
            "dynamic",
            "boolean",
            "string",
            "integer",
            "longinteger",
            "double",
            "float",
            "void",
        ];

        var atomWords = ["true", "false", "invalid"];
        var builtinFuncsWords = [
            "box",
            "createobject",
            "getglobalaa",
            "getlastruncompileerror",
            "getlastrunruntimeerror",
            "type",
            "copyfile",
            "createdirectory",
            "deletefile",
            "findmemberfunction",
            "formatdrive",
            "formatjson",
            "getinterface",
            "listdir",
            "matchfiles",
            "movefile",
            "parsejson",
            "readasciifile",
            "rebootsystem",
            "rungarbagecollector",
            "sleep",
            "strtoi",
            "uptime",
            "wait",
            "writeasciifile",
            "asc",
            "chr",
            "instr",
            "lcase",
            "left",
            "len",
            "mid",
            "right",
            "str",
            "stri",
            "string",
            "stringi",
            "substitute",
            "tr",
            "ucase",
            "val",
            "abs",
            "atn",
            "cdbl",
            "cint",
            "cos",
            "csng",
            "exp",
            "fix",
            "int",
            "log",
            "sgn",
            "sin",
            "sqr",
            "tan",
        ];
        var builtinConsts = [
            "LINE_NUM",
        ];
        var builtinObjsWords = ["global", "m"];
        var knownElements = [
            "getdefaultfont",
            "clear",
            "push",
            "next",
            "replace",
            "write",
            "writeline",
            "close",
            "open",
            "state",
            "update",
            "addnew",
        ];

        builtinObjsWords = builtinObjsWords.concat(builtinConsts);

        var keywords = wordRegexp(commonkeywords);
        var types = wordRegexp(commontypes);
        var atoms = wordRegexp(atomWords);
        var builtinFuncs = wordRegexp(builtinFuncsWords);
        var builtinObjs = wordRegexp(builtinObjsWords);
        var known = wordRegexp(knownElements);
        var stringPrefixes = '"';

        var opening = wordRegexp(openingKeywords);
        var closing = wordRegexp(endKeywords);
        var openingCtrl = wordRegexp(openingControl);
        var middleCtrl = wordRegexp(middleControl);
        var closingCtrl = wordRegexp(endControl);
        var doubleClosing = wordRegexp(["end"]);
        var doOpening = wordRegexp(["do"]);
        var noIndentWords = wordRegexp(["on error resume next", "exit"]);
        var comment = wordRegexp(["rem"]);

        function indent(_stream, state) {
            state.currentIndent++;
        }

        function dedent(_stream, state) {
            state.currentIndent--;
        }
        // tokenizers
        function tokenBase(stream, state) {
            if (stream.eatSpace()) {
                return "space";
            }

            var ch = stream.peek();
            // Handle Comments
            if (ch === "'") {
                stream.skipToEnd();
                return "comment";
            }
            if (stream.match(comment)) {
                stream.skipToEnd();
                return "comment";
            }

            // Handle Number Literals
            if (
                stream.match(/^((&H)|(&O))?[0-9\.]/i, false) &&
                !stream.match(/^((&H)|(&O))?[0-9\.]+[a-z_]/i, false)
            ) {
                var floatLiteral = false;
                // Floats
                if (stream.match(/^\d*\.\d+/i)) {
                    floatLiteral = true;
                } else if (stream.match(/^\d+\.\d*/)) {
                    floatLiteral = true;
                } else if (stream.match(/^\.\d+/)) {
                    floatLiteral = true;
                }

                if (floatLiteral) {
                    // Float literals may be "imaginary"
                    stream.eat(/J/i);
                    return "number";
                }
                // Integers
                var intLiteral = false;
                // Hex
                if (stream.match(/^&H[0-9a-f]+/i)) {
                    intLiteral = true;
                }
                // Octal
                else if (stream.match(/^&O[0-7]+/i)) {
                    intLiteral = true;
                }
                // Decimal
                else if (stream.match(/^[1-9]\d*F?/)) {
                    // Decimal literals may be "imaginary"
                    stream.eat(/J/i);
                    // TODO - Can you have imaginary longs?
                    intLiteral = true;
                }
                // Zero by itself with no other piece of number.
                else if (stream.match(/^0(?![\dx])/i)) {
                    intLiteral = true;
                }
                if (intLiteral) {
                    // Integer literals may be "long"
                    stream.eat(/L/i);
                    return "number";
                }
            }

            // Handle Strings
            if (stream.match(stringPrefixes)) {
                state.tokenize = tokenStringFactory(stream.current());
                return state.tokenize(stream, state);
            }

            // Handle operators and Delimiters
            if (
                stream.match(doubleOperators) ||
                stream.match(singleOperators) ||
                stream.match(wordOperators)
            ) {
                return "operator";
            }
            if (stream.match(singleDelimiters)) {
                return null;
            }

            if (stream.match(brackets)) {
                return "bracket";
            }

            if (stream.match(noIndentWords)) {
                state.doInCurrentLine = true;

                return "control";
            }

            if (stream.match(doOpening)) {
                indent(stream, state);
                state.doInCurrentLine = true;

                return "keyword";
            }
            if (stream.match(opening)) {
                if (!state.doInCurrentLine) indent(stream, state);
                else state.doInCurrentLine = false;

                return "keyword";
            }

            if (stream.match(openingCtrl)) {
                if (!state.doInCurrentLine) indent(stream, state);
                else state.doInCurrentLine = false;

                return "control";
            }

            if (stream.match(middleCtrl)) {
                return "control";
            }

            if (stream.match(doubleClosing)) {
                if (stream.peek() === " ") {
                    stream.eatSpace();
                }
                let style = "keyword";
                let result = stream.match(openingCtrl, false);
                if (result) {
                    style = "control";
                }
                dedent(stream, state);
                dedent(stream, state);
                return style;
            }

            if (stream.match(closing)) {
                if (!state.doInCurrentLine) dedent(stream, state);
                else state.doInCurrentLine = false;

                return "keyword";
            }

            if (stream.match(closingCtrl)) {
                if (!state.doInCurrentLine) dedent(stream, state);
                else state.doInCurrentLine = false;

                return "control";
            }

            if (stream.match(types)) {
                return "type";
            }

            if (stream.match(keywords)) {
                return "keyword";
            }

            if (stream.match(atoms)) {
                return "atom";
            }

            if (stream.match(known)) {
                return "variable-2";
            }

            if (stream.match(builtinFuncs)) {
                return "builtin";
            }

            if (stream.match(builtinObjs)) {
                return "keyword";
            }

            if (stream.match(functions)) {
                return "variable-2";
            }

            if (stream.match(identifiers)) {
                return "variable";
            }

            // Handle non-detected items
            stream.next();
            return ERRORCLASS;
        }

        function tokenStringFactory(delimiter) {
            var singleline = delimiter.length == 1;
            var OUTCLASS = "string";

            return function (stream, state) {
                while (!stream.eol()) {
                    stream.eatWhile(/[^'"]/);
                    if (stream.match(delimiter)) {
                        state.tokenize = tokenBase;
                        return OUTCLASS;
                    } else {
                        stream.eat(/['"]/);
                    }
                }
                if (singleline) {
                    if (parserConf.singleLineStringErrors) {
                        return ERRORCLASS;
                    } else {
                        state.tokenize = tokenBase;
                    }
                }
                return OUTCLASS;
            };
        }

        function tokenLexer(stream, state) {
            var style = state.tokenize(stream, state);
            var current = stream.current();

            // Handle '.' connected identifiers
            if (current === ".") {
                style = state.tokenize(stream, state);

                current = stream.current();
                if (
                    (style &&
                        (style.substr(0, 8) === "variable" ||
                            style === "builtin" ||
                            style === "keyword")) ||
                            knownElements.indexOf(current.substring(1)) > -1
                ) {
                    if (style === "builtin" || style === "keyword") style = "variable";
                    if (knownElements.indexOf(current.substr(1)) > -1) style = "variable-2";

                    return style;
                } else {
                    return ERRORCLASS;
                }
            }

            return style;
        }

        var external = {
            electricChars: "dDpPtTfFeE ",
            startState: function () {
                return {
                    tokenize: tokenBase,
                    lastToken: null,
                    currentIndent: 0,
                    nextLineIndent: 0,
                    doInCurrentLine: false,
                    ignoreKeyword: false,
                };
            },

            token: function (stream, state) {
                if (stream.sol()) {
                    state.currentIndent += state.nextLineIndent;
                    state.nextLineIndent = 0;
                    state.doInCurrentLine = 0;
                }
                var style = tokenLexer(stream, state);

                state.lastToken = { style: style, content: stream.current() };

                if (style === "space") style = null;

                return style;
            },

            indent: function (state, textAfter) {
                var trueText = textAfter.replace(/^\s+|\s+$/g, "");
                if (
                    trueText.match(closing) ||
                    trueText.match(doubleClosing) ||
                    trueText.match(middleCtrl)
                )
                    return conf.indentUnit * (state.currentIndent - 1);
                if (state.currentIndent < 0) return 0;
                return state.currentIndent * conf.indentUnit;
            },

            lineComment: "'",
        };
        return external;
    });

    CodeMirror.defineMIME("text/brs", "brightscript");
}
