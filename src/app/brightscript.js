// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: https://codemirror.net/5/LICENSE

/*
BrightScript Language Mode

https://developer.roku.com/en-gb/docs/references/brightscript/language/brightscript-language-reference.md

*/

export function defineMode(CodeMirror) {
    CodeMirror.defineMode("brightscript", function (conf, parserConf) {
        const ERRORCLASS = "error";

        function wordRegexp(words) {
            return new RegExp(`^((${words.join(")|(")}))\\b`, "i");
        }

        let singleOperators = /^[+\-/*&\\^<>=]/;
        let doubleOperators = /^((<>)|(<=)|(>=)|(<<)|(>>))/;
        let singleDelimiters = /^[.,;:$%!#&@?]/;
        let brackets = /^[\(\)\[\]\{}]/;
        let functions = /^[_A-Za-z]\w*(?=\()/;
        let identifiers = /^[_A-Za-z]\w*/;

        let openingKeywords = ["sub", "function"];
        let endKeywords = ["endsub", "endfunction"];

        let openingControl = ["while", "if", "for"];
        let middleControl = [
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
        let endControl = ["next", "endif", "endfor", "endwhile"];
        let wordOperators = wordRegexp(["and", "or", "not", "mod"]);
        let commonkeywords = ["dim", "print", "library"];
        let commontypes = [
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

        let atomWords = ["true", "false", "invalid"];
        let builtinFuncsWords = [
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
        let builtinConsts = ["LINE_NUM"];
        let builtinObjsWords = ["global", "m"];
        let knownElements = [
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

        let keywords = wordRegexp(commonkeywords);
        let types = wordRegexp(commontypes);
        let atoms = wordRegexp(atomWords);
        let builtinFuncs = wordRegexp(builtinFuncsWords);
        let builtinObjs = wordRegexp(builtinObjsWords);
        let known = wordRegexp(knownElements);
        let stringPrefixes = '"';

        let opening = wordRegexp(openingKeywords);
        let closing = wordRegexp(endKeywords);
        let openingCtrl = wordRegexp(openingControl);
        let middleCtrl = wordRegexp(middleControl);
        let closingCtrl = wordRegexp(endControl);
        let doubleClosing = wordRegexp(["end"]);
        let doOpening = wordRegexp(["do"]);
        let noIndentWords = wordRegexp(["on error resume next", "exit"]);
        let comment = wordRegexp(["rem"]);

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

            let ch = stream.peek();
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
                stream.match(/^((&H)|(&O))?[0-9.]/i, false) &&
                !stream.match(/^((&H)|(&O))?[0-9.]+[a-z_]/i, false)
            ) {
                let floatLiteral = false;
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
                let intLiteral = false;
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
            const OUTCLASS = "string";
            let singleline = delimiter.length == 1;

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
            let style = state.tokenize(stream, state);
            let current = stream.current();

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

        let external = {
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
                let style = tokenLexer(stream, state);

                state.lastToken = { style: style, content: stream.current() };

                if (style === "space") style = null;

                return style;
            },

            indent: function (state, textAfter) {
                let trueText = textAfter.replace(/(^\s+)|(\s+$)/g, "");
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
