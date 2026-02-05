const Utils = require("./Utils/Utils.js");

function FindAllInstances(Dict, Key, Target) {
    function SearchNode(Tree, SearchKey, TargetValue, CurrentPath = []) {
        let Blocks = [];

        if (Tree !== null && typeof Tree === 'object') {
            if (!Array.isArray(Tree)) {
                if (Object.prototype.hasOwnProperty.call(Tree, SearchKey) && Tree[SearchKey] === TargetValue) {
                    Blocks.push([...CurrentPath]);
                }

                for (const K in Tree) {
                    const Results = SearchNode(Tree[K], SearchKey, TargetValue, [...CurrentPath, K]);
                    Blocks.push(...Results);
                }
            } else {
                Tree.forEach((Item, Index) => {
                    const Results = SearchNode(Item, SearchKey, TargetValue, [...CurrentPath, Index]);
                    Blocks.push(...Results);
                });
            }
        }

        return Blocks;
    }

    return SearchNode(Dict, Key, Target);
}

const GenVar = Utils.GenerateVariable;

function GetNodeInternal(Obj, Path) {
    let CurrentValue = Obj;
    for (const Key of Path) {
        if (CurrentValue === null || CurrentValue === undefined) return undefined;
        CurrentValue = CurrentValue[Key];
    }
    return CurrentValue;
}

function CollectVariables(Ast) {
    const Result = {
        Defined: [],
        ExternalApis: []
    };

    const DefinedNames = new Set();
    const DeclarationTypes = [
        "LocalStatement",
        "AssignmentStatement",
        "FunctionDeclaration",
        "ForNumericStatement",
        "ForGenericStatement"
    ];

    DeclarationTypes.forEach(Type => {
        const Paths = FindAllInstances(Ast, "type", Type);
        Paths.forEach(Path => {
            const Node = GetNodeInternal(Ast, Path);
            if (!Node) return;

            if (Array.isArray(Node.variables)) {
                Node.variables.forEach(V => {
                    if (V && V.type === "Identifier") DefinedNames.add(V.name);
                });
            }

            if (Type === "FunctionDeclaration") {
                if (Node.identifier) {
                    DefinedNames.add(Node.identifier.name);
                }
                if (Array.isArray(Node.parameters)) {
                    Node.parameters.forEach(P => {
                        if (P && P.type === "Identifier") DefinedNames.add(P.name);
                    });
                }
            }

            if (Type === "ForNumericStatement" && Node.variable) {
                if (Node.variable.type === "Identifier") DefinedNames.add(Node.variable.name);
            }
        });
    });

    const AllIdentifierPaths = FindAllInstances(Ast, "type", "Identifier");

    AllIdentifierPaths.forEach(Path => {
        const Node = GetNodeInternal(Ast, Path);
        if (!Node || !Node.name) return;

        const ParentPath = Path.slice(0, -1);
        const ParentField = Path[Path.length - 1];
        const ParentNode = GetNodeInternal(Ast, ParentPath);

        if (!ParentNode) return;

        if (ParentNode.type === "MemberExpression" && ParentField === "identifier") {
            return;
        }

        if (ParentNode.type === "TableKeyString" && ParentField === "key") {
            return;
        }

        if (DefinedNames.has(Node.name)) {
            Result.Defined.push([Path, Node]);
        } else {
            Result.ExternalApis.push([Path, Node]);
        }
    });

    return Result;
}

function RenameVariables(Ast) {
    const RenameDict = {};
    const Analysis = CollectVariables(Ast);

    Analysis.Defined.forEach(([Path, Node]) => {
        const OriginalName = Node.name;
        if (!RenameDict[OriginalName]) {
            RenameDict[OriginalName] = GenVar();
        }

        Node.name = RenameDict[OriginalName];
    });

    return Ast;
}

module.exports = {
    RenameVariables
};
