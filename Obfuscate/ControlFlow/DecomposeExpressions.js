const A2C = require("../Utils/AST2Code.js");
const Utils = require("../Utils/Utils.js");

class ExpressionDecomposer {
    constructor(rootAst) {
        this.root = rootAst;
        this.output = [];
        this.tempCounter = 1;
        this.indent = 0;
    }

    generateTemp() {
        return Utils.GenerateVariable();
    }

    emit(line) {
        if (!line) return;
        const spacing = "  ".repeat(this.indent);
        this.output.push(spacing + line.trim());
    }

    decompose(node) {
        if (!node) return "nil";

        if (node.type === "Identifier") return node.name;
        if (node.type === "VarargLiteral") return "...";
        if (["NumericLiteral", "StringLiteral", "BooleanLiteral", "NilLiteral"].includes(node.type)) {
            return A2C.Handle(node).trim();
        }

        let value;
        switch (node.type) {
            case "BinaryExpression": {
                const left = this.decompose(node.left);
                const right = this.decompose(node.right);
                const result = this.generateTemp();
                this.emit(`${result} = ${left} ${node.operator} ${right}`);
                return result;
            }
            case "LogicalExpression": {
                const left = this.decompose(node.left);
                const result = this.generateTemp();
                if (node.operator === "and") {
                    this.emit(`${result} = ${left}`);
                    this.emit(`if ${result} then`);
                    this.indent++;
                    const right = this.decompose(node.right);
                    this.emit(`${result} = ${right}`);
                    this.indent--;
                    this.emit("end");
                } else if (node.operator === "or") {
                    this.emit(`${result} = ${left}`);
                    this.emit(`if not ${result} then`);
                    this.indent++;
                    const right = this.decompose(node.right);
                    this.emit(`${result} = ${right}`);
                    this.indent--;
                    this.emit("end");
                }
                return result;
            }
            case "UnaryExpression": {
                const arg = this.decompose(node.argument);
                // Ensures unary ops like # (length) are captured in a temp variable
                value = node.operator === "#" ? `${node.operator}${arg}` : `${node.operator} ${arg}`;
                break;
            }
            case "MemberExpression": {
                const base = this.decompose(node.base);

                // 1. Handle Colon (Methods) - Keep existing logic
                if (node.indexer === ":") {
                    return {
                        isColon: true,
                        base: base,
                        identifier: node.identifier.name
                    };
                }

                // 2. Handle Dot Indexer (The change)
                if (node.indexer === ".") {
                    // Create a temp variable for the property name string
                    const propNameVar = this.generateTemp();
                    this.emit(`${propNameVar} = "${node.identifier.name}"`);

                    // Build the new access string: base[propNameVar]
                    value = `${base}[${propNameVar}]`;
                } else {
                    // 3. Handle standard bracket indexer (e.g., base[key])
                    // If it's already a bracket, just decompose the identifier/key
                    const index = this.decompose(node.identifier);
                    value = `${base}[${index}]`;
                }
                break;
            }
            case "CallExpression": {
                const decomposedBase = this.decompose(node.base);
                const args = (node.arguments || []).map(arg => this.decompose(arg));

                if (decomposedBase.isColon) {
                    // Reconstruct the valid Lua syntax: object:method(args)
                    value = `${decomposedBase.base}:${decomposedBase.identifier}(${args.join(", ")})`;
                } else {
                    value = `${decomposedBase}(${args.join(", ")})`;
                }
                break;
            }
            default:
                // Fallback for anything not explicitly handled (e.g. TableConstructors)
                value = A2C.Handle(node).trim();
        }

        const v = this.generateTemp();
        this.emit(`${v} = ${value}`);
        return v;
    }

    handleStatement(node) {
        if (!node) return;

        switch (node.type) {
            case "LocalStatement":
            case "AssignmentStatement": {
                const isLocal = node.type === "LocalStatement" ? "local " : "";
                const varNames = node.variables.map(v => A2C.Handle(v).trim());

                // 1. Separate the last expression from the rest
                const lastExpr = node.init[node.init.length - 1];
                const prefixExprs = node.init.slice(0, -1);

                // 2. Decompose all expressions except the last one normally
                const tempValues = prefixExprs.map(expr => this.decompose(expr));

                // 3. Check if the last expression is a function call
                if (lastExpr && lastExpr.type === "CallExpression") {
                    // Handle prefix variables (1-to-1)
                    for (let i = 0; i < tempValues.length; i++) {
                        this.emit(`${isLocal}${varNames[i]} = ${tempValues[i]}`);
                    }

                    // Handle the remaining variables and the "raw" call to allow expansion
                    const remainingVars = varNames.slice(tempValues.length).join(", ");

                    // Use a special helper to get the call string without wrapping it in a temp variable
                    const callBase = this.decompose(lastExpr.base);
                    const callArgs = (lastExpr.arguments || []).map(arg => this.decompose(arg));
                    const callStr = lastExpr.base.indexer === ":" ?
                        `${callBase.base}:${callBase.identifier}(${callArgs.join(", ")})` :
                        `${callBase}(${callArgs.join(", ")})`;

                    this.emit(`${isLocal}${remainingVars} = ${callStr}`);
                } else {
                    // Standard logic for non-call assignments
                    const lastVal = this.decompose(lastExpr);
                    tempValues.push(lastVal);

                    varNames.forEach((name, i) => {
                        const val = tempValues[i] || "nil";
                        this.emit(`${isLocal}${name} = ${val}`);
                    });
                }
                break;
            }
            case "IfStatement": {
                node.clauses.forEach((clause, index) => {
                    if (clause.condition) {
                        const cond = this.decompose(clause.condition);
                        this.emit(`${index === 0 ? "if" : "elseif"} ${cond} then`);
                    } else {
                        this.emit("else");
                    }
                    this.indent++;
                    (clause.body || []).forEach(n => this.handleStatement(n));
                    this.indent--;
                });
                this.emit("end");
                break;
            }
            case "WhileStatement": {
                const condVar = this.decompose(node.condition);
                this.emit(`while ${condVar} do`);
                this.indent++;

                (node.body || []).forEach(n => this.handleStatement(n));

                const isLiteral = ["NumericLiteral", "StringLiteral", "BooleanLiteral", "NilLiteral"].includes(node.condition.type);

                if (!isLiteral) {
                    const reEval = this.decompose(node.condition);
                    if (condVar !== "true" && condVar !== "false" && condVar !== "nil") {
                        this.emit(`${condVar} = ${reEval}`);
                    }
                }

                this.indent--;
                this.emit("end");
                break;
            }
            case "ForNumericStatement": {
                const start = this.decompose(node.start);
                const end = this.decompose(node.end);
                const step = node.step ? `, ${this.decompose(node.step)}` : "";
                this.emit(`for ${node.variable.name} = ${start}, ${end}${step} do`);
                this.indent++;
                (node.body || []).forEach(n => this.handleStatement(n));
                this.indent--;
                this.emit("end");
                break;
            }
            case "ForGenericStatement": {
                const iterators = (node.iterators || []).map(it => {
                    if (it.type === "CallExpression" || it.type === "MethodCallExpression") {
                        const base = this.decompose(it.base || it.identifier);
                        const args = (it.arguments || []).map(a => this.decompose(a));
                        return `${base}(${args.join(", ")})`;
                    }
                    return this.decompose(it);
                });

                const names = node.variables.map(v => v.name).join(", ");
                this.emit(`for ${names} in ${iterators.join(", ")} do`);
                this.indent++;
                (node.body || []).forEach(n => this.handleStatement(n));
                this.indent--;
                this.emit("end");
                break;
            }
            case "ReturnStatement": {
                const values = (node.arguments || []).map(arg => this.decompose(arg));
                this.emit(`return ${values.join(", ")}`);
                break;
            }
            case "CallStatement":
                this.decompose(node.expression);
                break;
            case "FunctionDeclaration": {
                const name = A2C.Handle(node.identifier).trim();

                // Fix: Handle both regular names and VarargLiterals
                const params = node.parameters.map(p => {
                    if (p.type === "VarargLiteral") return "...";
                    return p.name;
                }).join(", ");

                this.emit(`${node.isLocal ? "local " : ""}function ${name}(${params})`);
                this.indent++;
                (node.body || []).forEach(n => this.handleStatement(n));
                this.indent--;
                this.emit("end");
                break;
            }
            default:
                this.emit(A2C.Handle(node));
        }
    }

    process() {
        const body = Array.isArray(this.root) ? this.root : (this.root.body || [this.root]);
        body.forEach(node => this.handleStatement(node));
        return this.output.join("\n");
    }
}

function FindAllBodies(Ast) {
    function SearchNode(Tree, CurrentPath = [], Depth = 0) {
        if (Depth > 50) return [];
        let Blocks = [];
        if (Tree !== null && typeof Tree === 'object' && !Array.isArray(Tree)) {
            if (Object.prototype.hasOwnProperty.call(Tree, "body") && Array.isArray(Tree["body"])) {
                Blocks.push([...CurrentPath, "body"]);
            }
            for (const K in Tree) {
                Blocks.push(...SearchNode(Tree[K], [...CurrentPath, K], Depth + 1));
            }
        } else if (Array.isArray(Tree)) {
            Tree.forEach((Item, Index) => {
                Blocks.push(...SearchNode(Item, [...CurrentPath, Index], Depth + 1));
            });
        }
        return Blocks;
    }
    return SearchNode(Ast);
}

function DecomposeExpressions(Ast) {
    const bodyPaths = FindAllBodies(Ast);
    bodyPaths.sort((a, b) => b.length - a.length);

    for (const path of bodyPaths) {
        const targetBlock = Utils.GetKey(Ast, path);
        const decomposer = new ExpressionDecomposer(targetBlock);
        const flattenedCode = decomposer.process();

        try {
            const newNodes = Utils.Parse(flattenedCode);
            let Parent = Ast;
            for (let i = 0; i < path.length - 1; i++) {
                Parent = Parent[path[i]];
            }
            Parent[path[path.length - 1]] = newNodes.body || newNodes;
        } catch (e) {
            console.error("DECOMPOSITION ERROR in block:");
            console.error("--------------------------");
            console.error(flattenedCode);
            console.error("--------------------------");
            throw e;
        }
    }


    const rootDecomposer = new ExpressionDecomposer(Ast);
    const OutputCode = rootDecomposer.process();

    try {
        return Utils.Parse(OutputCode);
    } catch (e) {
        console.error("DECOMPOSITION ERROR in final root block:");
        console.error("--------------------------");
        console.error(OutputCode);
        console.error("--------------------------");
        throw e;
    }
}

module.exports = {
    DecomposeExpressions
};