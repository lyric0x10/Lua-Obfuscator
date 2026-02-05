const {
    Minify,
    Beautify,
    UltraBeautify
} = require("./Formatter");

function Handle(Block) {
    let BlockName = Block["type"];
    let Code = "";
    switch (BlockName) {
        case "AssignmentStatement": {
            let Variables = AST2CodeHandler(Block["variables"], true);
            let Values = AST2CodeHandler(Block["init"], true);

            Code += (Values != "" ? `${Variables} = ${Values}` : `${Variables} = nil`);
            break;
        }
        case "LocalStatement": {
            let Variables = AST2CodeHandler(Block["variables"], true);
            let Values = AST2CodeHandler(Block["init"], true);
            Code += (Values != "" ? `local ${Variables} = ${Values}` : `local ${Variables}`);
            break;
        }
        case "Identifier": {
            Code += Block["name"];
            break;
        }
        case "BooleanLiteral":
        case "StringLiteral":
        case "NumericLiteral": {
            Code += Block["raw"];
            break;
        }
        case "FunctionDeclaration": {
            let AnonymousFunction = Block["identifier"] == null;
            if (AnonymousFunction == false) {
                let Name = Handle(Block["identifier"]);
                let Parameters = AST2CodeHandler(Block["parameters"], true);

                let Body = AST2CodeHandler(Block["body"]);
                if (Block["islocal"]) {
                    Code += `local ${Name} = function(${Parameters})`;
                } else {
                    Code += `${Name} = function(${Parameters})`;
                }

                Code += "\n" + Body + "\n";

                Code += "end\n";
            } else {
                let Parameters = AST2CodeHandler(Block["parameters"], true);
                let Body = AST2CodeHandler(Block["body"]);

                Code += `(function(${Parameters})`;

                Code += "\n" + Body + "\n";

                Code += "end)";
            }

            break;
        }
        case "CallStatement": {
            Code += Handle(Block["expression"]);
            break;
        }
        case "CallExpression": {
            let Base = Handle(Block["base"]);
            let Arguments = AST2CodeHandler(Block["arguments"], true);

            Code += Base + "(" + Arguments + ")";
            break;
        }
        case "BinaryExpression": {
            let Operator = Block["operator"];
            let Left = Handle(Block["left"]);
            let Right = Handle(Block["right"]);

            Code += ` (${Left} ${Operator} ${Right}) `;
            break;
        }
        case "ReturnStatement": {
            let Arguments = AST2CodeHandler(Block["arguments"], true);
            Code += `return ${Arguments}; `;
            break;
        }
        case "DoStatement": {
            let Body = AST2CodeHandler(Block["body"]);
            Code += `do ${Body} end `;
            break;
        }
        case "WhileStatement": {
            let Condition = Handle(Block["condition"]);
            let Body = AST2CodeHandler(Block["body"]);
            Code += `while (${Condition}) do ${Body} end `;
            break;
        }
        case "TableConstructorExpression": {
            let Fields = AST2CodeHandler(Block["fields"], true);
            Code += `{${Fields}}`;
            break;
        }
        case "TableValue": {
            let Value = Handle(Block["value"]);
            Code += Value;
            break;
        }
        case "TableKey": {
            let Key = Handle(Block["key"])
            let Value = Handle(Block["value"])
            Code += `[${Key}]=${Value}`
            break
        }
        case "MemberExpression": {
            let Indexer = Block["indexer"];
            let Base = Handle(Block["base"]);
            let Identifier = Handle(Block["identifier"]);

            let ClosingBracket = Indexer === "[" ? "]" : "";

            const safeTypes = ["Identifier", "MemberExpression", "IndexExpression"];

            if (safeTypes.includes(Block.base.type)) {
                Code += `${Base}${Indexer}${Identifier}${ClosingBracket}`;
            } else {
                Code += `(${Base})${Indexer}${Identifier}${ClosingBracket}`;
            }
            break;
        }
        case "ForGenericStatement": {
            let Variables = AST2CodeHandler(Block["variables"], true);
            let Iterators = AST2CodeHandler(Block["iterators"], true);
            let Body = AST2CodeHandler(Block["body"]);
            Code += `for ${Variables} in ${Iterators} do ${Body} end `;
            break;
        }
        case "ForNumericStatement": {
            let Variable = Handle(Block["variable"]);
            let Start = Handle(Block["start"]);
            let End = Handle(Block["end"]);
            let Step = Block["step"] || Block["Step"];
            let Body = "";

            if (Array.isArray(Block["body"])) {
                Body = AST2CodeHandler(Block["body"]);
            } else if (Block["body"] && Block["body"].type) {
                Body = Handle(Block["body"]);
            }

            if (Step == null) {
                Step = "";
            } else {
                Step = `,${Handle(Step)}`;
            }

            Code += `for ${Variable} = ${Start},${End}${Step} do ${Body} end `;
            break;
        }
        case "IfStatement": {
            let Clauses = Block["clauses"]
            Clauses.forEach(Clause => {
                Code += Handle(Clause)
            })
            Code += " end"
            break
        }
        case "IfClause":
        case "ElseifClause": {
            let Else = BlockName.includes("Else")
            let Body = AST2CodeHandler(Block.body)
            let Condition = Handle(Block.condition)
            Code += `${{true:"elseif",false:"if"}[Else]} ${Condition} then ${Body} `
            break;
        }
        case "ElseClause": {
            let Body = AST2CodeHandler(Block.body)
            Code += `else ${Body} `
            break;
        }
        case "UnaryExpression": {
            let Operator = Block["operator"]
            let Argument = Handle(Block["argument"])

            Code += ` ${Operator} ${Argument} `
            break
        }
        case "IndexExpression": {
            let Base = Handle(Block["base"]);
            let Index = Handle(Block["index"]);

            const unsafeTypes = ["TableConstructorExpression", "FunctionDeclaration", "BooleanLiteral", "StringLiteral", "NumericLiteral", "NilLiteral"];

            if (unsafeTypes.includes(Block.base.type)) {
                Code += `(${Base})[${Index}]`;
            } else {
                Code += `${Base}[${Index}]`;
            }
            break;
        }
        case "LogicalExpression": {
            let Operator = Block["operator"]
            let Left = Handle(Block["left"])
            let Right = Handle(Block["right"])

            Code += `(${Left} ${Operator} ${Right})`
            break;
        }
        case "TableKeyString": {
            let Key = Handle(Block["key"])
            let Value = Handle(Block["value"])
            Code += `${Key} = ${Value}`
            break
        }
        case "BreakStatement": {
            Code += " break "
            break
        }
        case "Chunk": {
            if (Array.isArray(Block.body)) {
                Code += AST2CodeHandler(Block.body);
            }
            break;
        }
        case "VarargLiteral": {
            Code += "...";
            break;
        }
        case "NilLiteral": {
            Code += "nil";
            break;
        }
        case "RepeatStatement": {
            let Body = AST2CodeHandler(Block["body"]);
            let Condition = Handle(Block["condition"]);
            Code += `repeat ${Body} until ${Condition}`;
            break;
        }
        default: {
            console.log("Unknown block, ", BlockName);
        }
    }
    return Code;
}

function AST2CodeHandler(AST, joinWithComma = false) {
    if (Array.isArray(AST)) {
        const CodeArray = AST.map(block => Handle(block));
        return joinWithComma ? CodeArray.join(', ') : CodeArray.join('\n');
    } else if (AST && Array.isArray(AST.body)) {
        return AST2CodeHandler(AST.body, joinWithComma);
    } else if (AST && AST.type) {
        return Handle(AST);
    } else {
        console.warn("Unhandled AST structure:", AST);
        return "";
    }
}

function AST2Code(AST) {
    const nodes = AST && AST.type ? [AST] : AST;
    try {
        return UltraBeautify(AST2CodeHandler(nodes));
    } catch (error) {
        return (AST2CodeHandler(nodes));
    }
}

module.exports = {
    AST2Code,
    AST2CodeHandler,
    Handle
};