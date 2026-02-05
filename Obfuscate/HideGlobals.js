const Utils = require("./Utils/Utils.js");
const Ast2Code = require("./Utils/AST2Code.js");
const MathUtils = require("./Utils/Math.js");

const GenVar = Utils.GenerateVariable;

function PredictShuffle(Seed, Args) {
    let State = Seed;
    let N = Args.length;

    let IndexMap = Array.from({
        length: N
    }, (_, I) => I);

    for (let I = N; I >= 2; I--) {
        State = (1103515245 * State + 12345) % 2147483648;

        let J = Math.floor(State % I) + 1;
        let IdxI = I - 1;
        let IdxJ = J - 1;

        let Temp = IndexMap[IdxI];
        IndexMap[IdxI] = IndexMap[IdxJ];
        IndexMap[IdxJ] = Temp;
    }

    let Result = {};
    IndexMap.forEach((OriginalIndex, CurrentIndex) => {
        Result[OriginalIndex] = CurrentIndex;
    });

    return Result;
}

function GenerateDeadCode() {
    const GetConst = () => {
        return MathUtils.Random(0, 1) > 0.5 ?
            `0x${MathUtils.Random(0x100, 0xFFFFFF).toString(16).toUpperCase()}` :
            `${MathUtils.Random(1000, 9999999)}`;
    };

    const Archetypes = [
        () => {
            const Op = () => ['+', '-', '*', '%'][MathUtils.Random(0, 3)];
            return `((${GetConst()} ${Op()} ${GetConst()}) ${Op()} (${GetConst()} ${Op()} ${GetConst()}))`;
        },

        () => {
            const V1 = GetConst();
            const V2 = GetConst();
            const Comp = ['>', '<', '==', '~='][MathUtils.Random(0, 3)];
            return `(${V1} ${Comp} ${V2} and ${GetConst()} or ${GetConst()})`;
        },

        () => {
            const Seed = MathUtils.Random(1000000, 9999999);
            const Shift = MathUtils.Random(2, 8);
            return `((${Seed} / ${Math.pow(2, Shift)}) % ${MathUtils.Random(128, 255)})`;
        },

        () => {
            const Str = Array.from({
                length: MathUtils.Random(5, 15)
            }, () => String.fromCharCode(MathUtils.Random(65, 90))).join('');
            return `(#("${Str}") * ${GetConst()})`;
        }
    ];

    const Generator = Archetypes[MathUtils.Random(0, Archetypes.length - 1)];
    return Generator();
}

function HideGlobals(Ast) {
    const VariableNames = [GenVar(), GenVar(), GenVar(), GenVar(), GenVar()];
    const ProxyName = VariableNames[3]; // This is our ENV proxy
    const Args = [];
    let ArgsAmt = MathUtils.Random(10, 25);
    let R = MathUtils.Random(0, ArgsAmt);

    for (let I = 0; I <= ArgsAmt; I++) {
        Args.push(I === R ? "(_ENV or getfenv())" : GenerateDeadCode());
    }

    let Seed = MathUtils.Random(0, 9e9);
    const PredictionMap = PredictShuffle(Seed, Args);
    const EnvIndex = PredictionMap[R.toString()];

    let ScopeStack = [new Set()];
    const PushScope = () => ScopeStack.push(new Set());
    const PopScope = () => ScopeStack.pop();
    const AddToScope = (Name) => ScopeStack[ScopeStack.length - 1].add(Name);

    const IsLocal = (Name) => {
        for (let I = ScopeStack.length - 1; I >= 0; I--) {
            if (ScopeStack[I].has(Name)) return true;
        }
        return false;
    };

    function Process(Node) {
        if (!Node) return;
        if (Array.isArray(Node)) {
            Node.forEach(N => Process(N));
            return;
        }

        switch (Node.type) {
            case "DoStatement":
                PushScope();
                Process(Node.body);
                PopScope();
                break;

            case "LocalStatement":
                if (Node.init) Process(Node.init);
                Node.variables.forEach(V => {
                    if (V.type === "Identifier") AddToScope(V.name);
                });
                break;

            case "FunctionDeclaration":
                if (Node.isLocal && Node.identifier) AddToScope(Node.identifier.name);

                PushScope();
                Node.parameters.forEach(P => {
                    if (P.type === "Identifier") AddToScope(P.name);
                });
                Process(Node.body);
                PopScope();
                break;

            case "ForGenericStatement":
            case "ForNumericStatement":
                PushScope();
                if (Node.type === "ForGenericStatement") {
                    Node.variables.forEach(V => AddToScope(V.name));
                    Process(Node.iterators);
                } else {
                    AddToScope(Node.variable.name);
                    Process(Node.start);
                    Process(Node.end);
                    if (Node.step) Process(Node.step);
                }
                Process(Node.body);
                PopScope();
                break;

            case "Identifier":
                if (!IsLocal(Node.name)) {
                    const OriginalName = Node.name;
                    Node.type = "MemberExpression";
                    Node.indexer = "[";
                    Node.base = {
                        type: "Identifier",
                        name: ProxyName
                    };
                    Node.identifier = {
                        type: "StringLiteral",
                        value: OriginalName,
                        raw: `"${OriginalName}"`
                    };
                    delete Node.name;
                }
                break;

            case "MemberExpression":
                Process(Node.base);
                if (Node.indexer === "[") {
                    Process(Node.identifier);
                }
                break;

            default:
                Object.keys(Node).forEach(Key => {
                    if (Node.type === "MemberExpression" && Key === "identifier" && Node.indexer === ".") return;

                    if (Node.type === "TableKeyString" && Key === "key") return;

                    if (typeof Node[Key] === "object") Process(Node[Key]);
                });
                break;
        }
    }

    Process(Ast.body || Ast);

    const Code = `
    return (function(...)
        local ${VariableNames[0]} = {...}
        local ${VariableNames[1]} = ${Seed}
        local function ${VariableNames[4]}(limit)
            ${VariableNames[1]} = (1103515245 * ${VariableNames[1]} + 12345) % 2147483648
            return (${VariableNames[1]} % limit) + 1
        end

        local ${VariableNames[2]} = #${VariableNames[0]}
        for i = ${VariableNames[2]}, 2, -1 do
            local j = ${VariableNames[4]}(i)
            local temp = ${VariableNames[0]}[i]
            ${VariableNames[0]}[i] = ${VariableNames[0]}[j]
            ${VariableNames[0]}[j] = temp
        end

        local ${ProxyName} = ${VariableNames[0]}[${EnvIndex + 1}]
        
        ${Ast2Code.AST2Code(Ast)}
    end)(${Args.join(", ")})
    `;

    return Utils.Parse(Code);
}

module.exports = {
    HideGlobals
};
