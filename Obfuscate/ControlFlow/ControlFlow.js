const Utils = require("../Utils/Utils.js");
const A2C = require("../Utils/AST2Code.js");
const _Math = require("../Utils/Math.js");

function FindAllBodies(Ast) {
    function SearchNode(Tree, CurrentPath = [], Depth = 0) {
        if (Depth > 30) return [];
        let Blocks = [];
        if (Tree !== null && typeof Tree === 'object' && !Array.isArray(Tree)) {
            if (Object.prototype.hasOwnProperty.call(Tree, "body") && Array.isArray(Tree["body"])) {
                Blocks.push([...CurrentPath, "body"]);
            }
            for (const K in Tree) {
                const Results = SearchNode(Tree[K], [...CurrentPath, K], Depth + 1);
                Blocks.push(...Results);
            }
        } else if (Array.isArray(Tree)) {
            Tree.forEach((Item, Index) => {
                const Results = SearchNode(Item, [...CurrentPath, Index], Depth + 1);
                Blocks.push(...Results);
            });
        }
        return Blocks;
    }
    return SearchNode(Ast);
}

function GenerateTree(Blocks, Var = "State") {
    const Count = Blocks.length;

    if (Count === 0) {
        return ["", "nil"];
    }

    const Numbers = [];
    while (Numbers.length < Count) {
        const Num = _Math.Random(-2e9, 2e9);
        if (!Numbers.includes(Num)) Numbers.push(Num);
    }

    const ProcessedBlocks = Blocks.map((Block, Index) => {
        const NextVal = (Index + 1 < Count) ? Numbers[Index + 1] : "nil";

        const trimmedBlock = Block.trim();

        if (trimmedBlock.startsWith("return") || trimmedBlock === "break") {
            return Block;
        }

        return `${Block}\n${Var} = ${NextVal}`;
    });

    const SortedPairs = Numbers
        .map((Value, OriginalIndex) => [Value, OriginalIndex])
        .sort((A, B) => A[0] - B[0]);

    function BuildBranch(Pairs, IndentLevel) {
        const Indent = "    ".repeat(IndentLevel);
        if (Pairs.length === 1) {
            const [_, OriginalIndex] = Pairs[0];
            return ProcessedBlocks[OriginalIndex]
                .trim()
                .split('\n')
                .map(Line => `${Indent}${Line}`)
                .join('\n');
        }

        const MidPoint = Math.floor(Pairs.length / 2);
        const LeftHalf = Pairs.slice(0, MidPoint);
        const RightHalf = Pairs.slice(MidPoint);

        const Mode = _Math.Random(0, 3);
        let Operator, Pivot, TrueBranch, FalseBranch;
        const LeftLast = LeftHalf[LeftHalf.length - 1][0];
        const RightFirst = RightHalf[0][0];

        switch (Mode) {
            case 0:
                Operator = "<";
                Pivot = RightFirst;
                TrueBranch = LeftHalf;
                FalseBranch = RightHalf;
                break;
            case 1:
                Operator = "<=";
                Pivot = LeftLast;
                TrueBranch = LeftHalf;
                FalseBranch = RightHalf;
                break;
            case 2:
                Operator = ">";
                Pivot = LeftLast;
                TrueBranch = RightHalf;
                FalseBranch = LeftHalf;
                break;
            case 3:
                Operator = ">=";
                Pivot = RightFirst;
                TrueBranch = RightHalf;
                FalseBranch = LeftHalf;
                break;
        }

        return [
            `${Indent}if ${Var} ${Operator} ${Pivot} then`,
            BuildBranch(TrueBranch, IndentLevel + 1),
            `${Indent}else`,
            BuildBranch(FalseBranch, IndentLevel + 1),
            `${Indent}end`
        ].join('\n');
    }

    return [BuildBranch(SortedPairs, 0), Numbers[0]];
}

function ProcessBlock(BlockList) {
    let StrBlocks = [];
    for (const Node of BlockList) {
        StrBlocks.push(A2C.AST2Code(Node));
    }

    const ValueVariable = Utils.GenerateVariable();
    const Tree = GenerateTree(StrBlocks, ValueVariable);
    const TreeCode = Tree[0];
    const FirstID = Tree[1];

    let FinalCode = `${ValueVariable} = ${FirstID}\nwhile ${ValueVariable} ~= nil do\n${TreeCode}\nend`;

    try {
        return Utils.Parse(FinalCode);
    } catch {
        console.error("Syntax ERROR in block:");
        console.error("--------------------------");
        console.error(FinalCode);
        console.error("--------------------------");
    }
}


function ControlFlow(AST) {
    const GetNodeFromPath = (Path) => {
        const NodePath = [...Path];
        NodePath.pop();
        return Utils.GetKey(AST, NodePath);
    };
    Utils.FindAllInstances(AST, "type", "LocalStatement").forEach(Path => {
        let Node = GetNodeFromPath(Path);
        Node.type = "AssignmentStatement"
    })

    const Bodies = FindAllBodies(AST);
    Bodies.sort((a, b) => b.length - a.length);

    for (const Path of Bodies) {
        let ParentNode = AST;
        for (const Key of Path.slice(0, -1)) {
            ParentNode = ParentNode[Key];
        }

        const TargetKey = Path.at(-1);
        const OriginalStatements = ParentNode[TargetKey];

        const ObfuscatedStatements = ProcessBlock(OriginalStatements);
        ParentNode[TargetKey] = ObfuscatedStatements;
    }

    if (AST.body && Array.isArray(AST.body)) {
        const NewAST = ProcessBlock(AST.body);
        AST.body = NewAST.body;
    } else {
        AST = ProcessBlock(AST)
    }

    return AST;
}

module.exports = {
    ControlFlow
};