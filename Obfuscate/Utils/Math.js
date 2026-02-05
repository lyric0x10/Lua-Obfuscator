const Crypto = require('crypto');

function Random(Min, Max) {
    return Crypto.randomInt(Min, Max + 1);
}

function Floor(num) {
    if (num >= 0) {
        return Math.trunc(num);
    } else {
        return Math.trunc(num) === num ? num : Math.trunc(num) - 1;
    }
}


function Eval(expression) {
    return eval(expression);
}

function ToHex(Value) {
    const IsNegative = Value < 0;
    const AbsoluteValue = Math.abs(Value);
    const HexString = "0x" + AbsoluteValue.toString(16).toUpperCase();
    return IsNegative ? `-${HexString}` : HexString;
}

function Number2Equation(TargetNumber, Length = 2) {
    let CurrentLength = 1;
    let FirstValue = Random(-1e6, 1e6);
    let RunningValue = Math.floor(FirstValue);

    let EquationParts = [ToHex(RunningValue)];
    const Operations = ["+", "-", "*"];

    while (CurrentLength < Length) {
        let Operation = Operations[Random(0, Operations.length - 1)];
        let Operand;

        if (Operation === "*") {
            Operand = Random(1, 1000);
            if (Math.abs(RunningValue * Operand) > 1e14) {
                Operation = "+";
            }
        }

        if (Operation !== "*") {
            Operand = Random(1, 1e6);
        }

        if (Operation === "+") RunningValue += Operand;
        if (Operation === "-") RunningValue -= Operand;
        if (Operation === "*") RunningValue *= Operand;

        EquationParts.unshift("(");
        EquationParts.push(Operation);
        EquationParts.push(ToHex(Operand));
        EquationParts.push(")");

        CurrentLength += 1;
    }

    let FinalOffset = TargetNumber - RunningValue;
    let OffsetOp = FinalOffset >= 0 ? "+" : "-";

    EquationParts.push(OffsetOp);
    EquationParts.push(ToHex(Math.abs(FinalOffset)));

    return "(" + EquationParts.join("") + ")";
}


module.exports = {
    Random,
    Floor,
    Number2Equation
};