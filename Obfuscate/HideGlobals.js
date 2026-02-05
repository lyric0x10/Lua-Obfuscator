const Utils = require("./Utils/Utils.js");
const AST2Code = require("./Utils/AST2Code.js");
const _Math = require("./Utils/Math.js");

const GenVar = Utils.GenerateVariable;

function PredictShuffle(seed, args) {
    let state = seed;
    let n = args.length;

    let indexMap = Array.from({
        length: n
    }, (_, i) => i);

    for (let i = n; i >= 2; i--) {
        state = (1103515245 * state + 12345) % 2147483648;

        let j = Math.floor(state % i) + 1;
        let idxI = i - 1;
        let idxJ = j - 1;

        // Swap the trackers
        let temp = indexMap[idxI];
        indexMap[idxI] = indexMap[idxJ];
        indexMap[idxJ] = temp;
    }

    let result = {};
    indexMap.forEach((originalIndex, currentIndex) => {
        result[originalIndex] = currentIndex;
    });

    return result;
}

function GenerateDeadCode() {
    // Generates a random hex or decimal constant that looks like a memory offset
    const getConst = () => {
        return _Math.Random(0, 1) > 0.5 ?
            `0x${_Math.Random(0x100, 0xFFFFFF).toString(16).toUpperCase()}` :
            `${_Math.Random(1000, 9999999)}`;
    };

    const archetypes = [
        // Type 1: Deeply Nested Arithmetic (Mimics hash/checksum logic)
        () => {
            const op = () => ['+', '-', '*', '%'][_Math.Random(0, 3)];
            return `((${getConst()} ${op()} ${getConst()}) ${op()} (${getConst()} ${op()} ${getConst()}))`;
        },

        // Type 2: Fake Boolean Logic (Mimics environment or state flags)
        () => {
            const v1 = getConst();
            const v2 = getConst();
            const comp = ['>', '<', '==', '~='][_Math.Random(0, 3)];
            return `(${v1} ${comp} ${v2} and ${getConst()} or ${getConst()})`;
        },

        // Type 3: Bitwise-Simulation (Matches your Output.lua math style)
        () => {
            const seed = _Math.Random(1000000, 9999999);
            const shift = _Math.Random(2, 8);
            // Looks like a bit-shift or a modular reduction used in VM dispatchers
            return `((${seed} / ${Math.pow(2, shift)}) % ${_Math.Random(128, 255)})`;
        },

        // Type 4: String-Math Noise (Safe for parsers)
        () => {
            // Uses string length as a constant to look like data-driven logic
            const str = Array.from({
                length: _Math.Random(5, 15)
            }, () => String.fromCharCode(_Math.Random(65, 90))).join('');
            return `(#("${str}") * ${getConst()})`;
        }
    ];

    const generator = archetypes[_Math.Random(0, archetypes.length - 1)];
    return generator();
}

function HideGlobals(Ast) {
    const VariableNames = [GenVar(), GenVar(), GenVar(), GenVar(), GenVar()];
    const ProxyName = VariableNames[3]; // This is our ENV proxy
    const Args = [];
    let ArgsAmt = _Math.Random(10, 25);
    let r = _Math.Random(0, ArgsAmt);

    for (let i = 0; i <= ArgsAmt; i++) {
        Args.push(i === r ? "(_ENV or getfenv())" : GenerateDeadCode());
    }

    let Seed = _Math.Random(0, 9e9);
    const PredictionMap = PredictShuffle(Seed, Args);
    const ENV_Index = PredictionMap[r.toString()];

    // IMPROVEMENT: Use the Scope Stack logic from VariableRenamer Step 6
    let ScopeStack = [new Set()];
    const pushScope = () => ScopeStack.push(new Set());
    const popScope = () => ScopeStack.pop();
    const addToScope = (name) => ScopeStack[ScopeStack.length - 1].add(name);

    const isLocal = (name) => {
        for (let i = ScopeStack.length - 1; i >= 0; i--) {
            if (ScopeStack[i].has(name)) return true;
        }
        return false;
    };

    // We only need one pass here because we track scope during the Rename pass
    function Process(Node) {
        if (!Node) return;
        if (Array.isArray(Node)) {
            Node.forEach(N => Process(N));
            return;
        }

        switch (Node.type) {
            case "DoStatement":
                pushScope();
                Process(Node.body);
                popScope();
                break;

            case "LocalStatement":
                if (Node.init) Process(Node.init);
                Node.variables.forEach(V => {
                    if (V.type === "Identifier") addToScope(V.name);
                });
                break;

            case "FunctionDeclaration":
                // If it's a local function, the name belongs to the current scope
                if (Node.isLocal && Node.identifier) addToScope(Node.identifier.name);

                pushScope();
                Node.parameters.forEach(P => {
                    if (P.type === "Identifier") addToScope(P.name);
                });
                Process(Node.body);
                popScope();
                break;

            case "ForGenericStatement":
            case "ForNumericStatement":
                pushScope();
                if (Node.type === "ForGenericStatement") {
                    Node.variables.forEach(V => addToScope(V.name));
                    Process(Node.iterators);
                } else {
                    addToScope(Node.variable.name);
                    Process(Node.start);
                    Process(Node.end);
                    if (Node.step) Process(Node.step);
                }
                Process(Node.body);
                popScope();
                break;

                // Inside HideGlobals.js
            case "Identifier":
                if (!isLocal(Node.name)) {
                    const originalName = Node.name;
                    Node.type = "MemberExpression";
                    Node.indexer = "[";
                    Node.base = {
                        type: "Identifier",
                        name: ProxyName
                    };
                    Node.identifier = {
                        type: "StringLiteral",
                        value: originalName,
                        raw: `"${originalName}"`
                    };
                    delete Node.name;
                }
                break;

            case "MemberExpression":
                Process(Node.base);
                // Only process the identifier if it's bracketed and dynamic
                if (Node.indexer === "[") {
                    Process(Node.identifier);
                }
                break;

            default:
                Object.keys(Node).forEach(Key => {
                    // 1. Keep ignoring dot properties (math.abs)
                    if (Node.type === "MemberExpression" && Key === "identifier" && Node.indexer === ".") return;

                    // 2. ADD THIS: Ignore identifiers used as table keys (local t = { key = 1 })
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

        local ${ProxyName} = ${VariableNames[0]}[${ENV_Index + 1}]
        
        ${AST2Code.AST2Code(Ast)}
    end)(${Args.join(", ")})
    `;

    return Utils.Parse(Code);
}

module.exports = {
    HideGlobals
};