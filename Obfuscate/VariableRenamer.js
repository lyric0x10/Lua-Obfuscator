const Utils = require("./Utils/Utils.js");

/**
 * Finds all nodes matching a specific key-value pair.
 * Returns the path to the OBJECT node, not the key's path.
 */
function FindAllInstances(Dict, Key, Target) {
    function SearchNode(Tree, SearchKey, TargetValue, CurrentPath = []) {
        let Blocks = [];

        if (Tree !== null && typeof Tree === 'object') {
            if (!Array.isArray(Tree)) {
                // Check if this object is the target node
                if (Object.prototype.hasOwnProperty.call(Tree, SearchKey) && Tree[SearchKey] === TargetValue) {
                    Blocks.push([...CurrentPath]); // Return path to the object
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

const GenVar = Utils.GenerateVariable


function GetNodeInternal(Obj, Path) {
    let CurrentValue = Obj;
    for (const Key of Path) {
        if (CurrentValue === null || CurrentValue === undefined) return undefined;
        CurrentValue = CurrentValue[Key];
    }
    return CurrentValue;
}

function CollectVariables(AST) {
    const result = {
        Defined: [],
        ExternalAPIs: []
    };

    const definedNames = new Set();
    // Types that introduce new variable names in Luaparser
    const declarationTypes = [
        "LocalStatement",
        "AssignmentStatement",
        "FunctionDeclaration",
        "ForNumericStatement",
        "ForGenericStatement"
    ];

    declarationTypes.forEach(type => {
        const paths = FindAllInstances(AST, "type", type);
        paths.forEach(path => {
            const node = GetNodeInternal(AST, path);
            if (!node) return;

            // Handle standard variable lists (LocalStatement, AssignmentStatement, ForGenericStatement)
            if (Array.isArray(node.variables)) {
                node.variables.forEach(v => {
                    if (v && v.type === "Identifier") definedNames.add(v.name);
                });
            }

            // Handle Function names and parameters
            if (type === "FunctionDeclaration") {
                if (node.identifier) {
                    definedNames.add(node.identifier.name);
                }
                if (Array.isArray(node.parameters)) {
                    node.parameters.forEach(p => {
                        if (p && p.type === "Identifier") definedNames.add(p.name);
                    });
                }
            }

            // Handle ForNumericStatement (uses singular 'variable' property)
            if (type === "ForNumericStatement" && node.variable) {
                if (node.variable.type === "Identifier") definedNames.add(node.variable.name);
            }
        });
    });

    // Locate every Identifier to categorize it
    const allIdentifierPaths = FindAllInstances(AST, "type", "Identifier");

    allIdentifierPaths.forEach(path => {
        const node = GetNodeInternal(AST, path);
        if (!node || !node.name) return;

        const parentPath = path.slice(0, -1);
        const parentField = path[path.length - 1];
        const parentNode = GetNodeInternal(AST, parentPath);

        if (!parentNode) return;

        // --- FILTERING LOGIC ---

        // Skip identifiers that are property names in math.abs (MemberExpression identifier)
        if (parentNode.type === "MemberExpression" && parentField === "identifier") {
            return;
        }

        // Skip identifiers that are literal keys in tables { key = value }
        if (parentNode.type === "TableKeyString" && parentField === "key") {
            return;
        }

        // Categorize based on definedNames set
        if (definedNames.has(node.name)) {
            result.Defined.push([path, node]);
        } else {
            result.ExternalAPIs.push([path, node]);
        }
    });

    return result;
}

function RenameVariables(AST) {
    const RenameDict = {};
    const Analysis = CollectVariables(AST);

    // Update nodes directly by reference
    Analysis.Defined.forEach(([Path, Node]) => {
        const OriginalName = Node.name;
        if (!RenameDict[OriginalName]) {
            RenameDict[OriginalName] = GenVar();
        }

        Node.name = RenameDict[OriginalName];
    });

    return AST;
}

module.exports = {
    RenameVariables
};