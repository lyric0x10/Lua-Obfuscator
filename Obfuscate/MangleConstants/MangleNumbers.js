const Utils = require("../Utils/Utils.js");
const A2C = require("../Utils/AST2Code.js");
const _Math = require("../Utils/Math.js");

const N2E = _Math.Number2Equation
const FindAllInstances = Utils.FindAllInstances

function MangleNumbers(AST, Percentage = 75) {
    let Numbers = FindAllInstances(AST, "type", "NumericLiteral")
    Numbers = Utils.GetRandomSample(Numbers, Percentage)
    for (const Path of Numbers) {
        let ParentNode = AST;
        for (const Key of Path.slice(0, -1)) {
            ParentNode = ParentNode[Key];
        }

        let Value = ParentNode["value"];
        let Mangled = N2E(Value);

        if (eval(Mangled) !== Value) {
            throw new Error(`Math Mangle Failed: ${Mangled} does not equal ${Value}`);
        }

        ParentNode["raw"] = "(" + Mangled + ")";
    }

    const NewCode = A2C.AST2Code(AST);
    return Utils.Parse(NewCode);
}

module.exports = {
    MangleNumbers
}