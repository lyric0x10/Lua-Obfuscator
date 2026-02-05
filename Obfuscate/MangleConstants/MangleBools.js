const Utils = require("../Utils/Utils.js");
const A2C = require("../Utils/AST2Code.js");
const _Math = require("../Utils/Math.js");

const FindAllInstances = Utils.FindAllInstances
const N2E = _Math.Number2Equation
const Random = _Math.Random

function GenerateExpression(Value) {
    const Mode = Random(0, 4);
    let Left = Random(-9e9, 9e9);
    let Right, Operator;

    const Config = [
        ["~=", "=="], 
        [">",  "<="], 
        [">=", "<" ], 
        ["<",  ">="], 
        ["<=", ">" ]  
    ];

    Operator = Value ? Config[Mode][0] : Config[Mode][1];

    switch (Mode) {
        case 0:
            Right = Left + Random(1, 9e5);
            break;
        case 1:
        case 2:
            Right = Left - Random(1, 9e5);
            break;
        case 3:
        case 4:
            Right = Left + Random(1, 9e5);
            break;
    }

    return `(${Left} ${Operator} ${Right})`;
}

function MangleBools(AST, Percentage = 80) {
    let Bools = FindAllInstances(AST, "type", "BooleanLiteral")
    Bools = Utils.GetRandomSample(Bools, Percentage)

    for (const Path of Bools) {
        let ParentNode = AST;
        for (const Key of Path.slice(0, -1)) {
            ParentNode = ParentNode[Key];
        }
        let Value = ParentNode["value"]
        ParentNode["raw"] = "(" + GenerateExpression(Value) + ")";
    }
    
    const NewCode = A2C.AST2Code(AST);
    return Utils.Parse(NewCode);
}

module.exports = {
    MangleBools
}