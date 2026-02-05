const FS = require("node:fs");
const AST2Code = require("./Obfuscate/Utils/AST2Code.js")
const Formatter = require("./Obfuscate/Utils/Formatter.js")
const Utils = require("./Obfuscate/Utils/Utils.js");

const MangleNumbers = require("./Obfuscate/MangleConstants/MangleNumbers.js").MangleNumbers
const MangleBools = require("./Obfuscate/MangleConstants/MangleBools.js").MangleBools
const ESModule = require("./Obfuscate/MangleConstants/EncryptStrings.js");
const EncryptStrings = ESModule.EncryptStrings
const ControlFlow = require("./Obfuscate/ControlFlow/ControlFlow.js").ControlFlow
const DecomposeExpressions = require("./Obfuscate/ControlFlow/DecomposeExpressions.js").DecomposeExpressions
const HideGlobals = require("./Obfuscate/HideGlobals.js").HideGlobals
const RenameVariables = require("./Obfuscate/VariableRenamer.js").RenameVariables
const AntiTamper = require("./Obfuscate/AntiTamper.js").AntiTamper

const Settings = {
    "Beautify": false,
    "Mangle Numbers": true,
    "Mangle Bools": true,
    "Encrypt Strings": true,
    "Hide Globals": true,
    "Anti Tamper": true,
    "Control Flow": true,
    "Decompose Expressions": true,
}


console.log("[*] Reading input file")
let Code = FS.readFileSync("Input.lua", "utf8");

console.log("[*] Generating AST")
let AST = Utils.Parse(Code)

if (Settings["Anti Tamper"]) {
    if (Settings["Beautify"]) {
        console.log("[-] Failed to add Anti Tamper - Beautify enabled")
    } else {
        console.log("[*] Adding Anti Tamper")
        AST = AntiTamper(AST)
    }
}

if (Settings["Hide Globals"]) {
    console.log("[*] Hiding Globals")
    AST = HideGlobals(AST)
}

if (Settings["Encrypt Strings"]) {
    console.log("[*] Encrypting Strings ")
    AST = ESModule.StringifyMemberExpressions(AST)
    AST = EncryptStrings(AST)
}


if (Settings["Decompose Expressions"]) {
    console.log("[*] Decomposing Expressions")
    AST = DecomposeExpressions(AST)
}

if (Settings["Control Flow"]) {
    console.log("[*] Adding Control Flow")
    AST = ControlFlow(AST)
}

if (Settings["Mangle Numbers"]) {
    console.log("[*] Mangling Numbers")
    AST = MangleNumbers(AST)
}

if (Settings["Mangle Bools"]) {
    console.log("[*] Mangling Bools")
    AST = MangleBools(AST)
}


console.log("[*] Renaming Variables")
AST = RenameVariables(AST)

console.log("[*] Rebuilding code")
Code = AST2Code.AST2Code(AST)

if (Settings["Beautify"]) {
    console.log("[*] Beautifying code")
    Code = Formatter.Beautify(Code)
} else {
    console.log("[*] Minifying code")
    Code = Formatter.Minify(Code)
}

console.log("[*] Writing output")
FS.writeFileSync("Output.lua", Code, "utf8")