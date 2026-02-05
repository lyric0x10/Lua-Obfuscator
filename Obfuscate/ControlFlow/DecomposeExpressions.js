const AstToCode = require("../Utils/AST2Code.js");
const Utils = require("../Utils/Utils.js");

class ExpressionDecomposer {
    constructor(RootAst) {
        this.Root = RootAst;
        this.Output = [];
        this.TempCounter = 1;
        this.Indent = 0;
    }

    GenerateTemp() {
        return Utils.GenerateVariable();
    }

    Emit(Line) {
        if (!Line) return;
        const Spacing = "  ".repeat(this.Indent);
        this.Output.push(Spacing + Line.trim());
    }

    Decompose(Node) {
        if (!Node) return "nil";

        if (Node.type === "Identifier") return Node.name;
        if (Node.type === "VarargLiteral") return "...";
        if (["NumericLiteral", "StringLiteral", "BooleanLiteral", "NilLiteral"].includes(Node.type)) {
            return AstToCode.Handle(Node).trim();
        }

        let Value;
        switch (Node.type) {
            case "BinaryExpression": {
                const Left = this.Decompose(Node.left);
                const Right = this.Decompose(Node.right);
                const Result = this.GenerateTemp();
                this.Emit(`${Result} = ${Left} ${Node.operator} ${Right}`);
                return Result;
            }
            case "LogicalExpression": {
                const Left = this.Decompose(Node.left);
                const Result = this.GenerateTemp();
                if (Node.operator === "and") {
                    this.Emit(`${Result} = ${Left}`);
                    this.Emit(`if ${Result} then`);
                    this.Indent++;
                    const Right = this.Decompose(Node.right);
                    this.Emit(`${Result} = ${Right}`);
                    this.Indent--;
                    this.Emit("end");
                } else if (Node.operator === "or") {
                    this.Emit(`${Result} = ${Left}`);
                    this.Emit(`if not ${Result} then`);
                    this.Indent++;
                    const Right = this.Decompose(Node.right);
                    this.Emit(`${Result} = ${Right}`);
                    this.Indent--;
                    this.Emit("end");
                }
                return Result;
            }
            case "UnaryExpression": {
                const Arg = this.Decompose(Node.argument);
                Value = Node.operator === "#" ? `${Node.operator}${Arg}` : `${Node.operator} ${Arg}`;
                break;
            }
            case "MemberExpression": {
                const Base = this.Decompose(Node.base);

                if (Node.indexer === ":") {
                    return {
                        IsColon: true,
                        Base: Base,
                        Identifier: Node.identifier.name
                    };
                }

                if (Node.indexer === ".") {
                    const PropNameVar = this.GenerateTemp();
                    this.Emit(`${PropNameVar} = "${Node.identifier.name}"`);
                    Value = `${Base}[${PropNameVar}]`;
                } else {
                    const Index = this.Decompose(Node.identifier);
                    Value = `${Base}[${Index}]`;
                }
                break;
            }
            case "CallExpression": {
                const DecomposedBase = this.Decompose(Node.base);
                const Args = (Node.arguments || []).map(Arg => this.Decompose(Arg));

                if (DecomposedBase.IsColon) {
                    Value = `${DecomposedBase.Base}:${DecomposedBase.Identifier}(${Args.join(", ")})`;
                } else {
                    Value = `${DecomposedBase}(${Args.join(", ")})`;
                }
                break;
            }
            default:
                Value = AstToCode.Handle(Node).trim();
        }

        const V = this.GenerateTemp();
        this.Emit(`${V} = ${Value}`);
        return V;
    }

    HandleStatement(Node) {
        if (!Node) return;

        switch (Node.type) {
            case "LocalStatement":
            case "AssignmentStatement": {
                const IsLocal = Node.type === "LocalStatement" ? "local " : "";
                const VarNames = Node.variables.map(V => AstToCode.Handle(V).trim());

                const LastExpr = Node.init[Node.init.length - 1];
                const PrefixExprs = Node.init.slice(0, -1);

                const TempValues = PrefixExprs.map(Expr => this.Decompose(Expr));

                if (LastExpr && LastExpr.type === "CallExpression") {
                    for (let I = 0; I < TempValues.length; I++) {
                        this.Emit(`${IsLocal}${VarNames[I]} = ${TempValues[I]}`);
                    }

                    const RemainingVars = VarNames.slice(TempValues.length).join(", ");

                    const CallBase = this.Decompose(LastExpr.base);
                    const CallArgs = (LastExpr.arguments || []).map(Arg => this.Decompose(Arg));
                    const CallStr = LastExpr.base.indexer === ":" ?
                        `${CallBase.Base}:${CallBase.Identifier}(${CallArgs.join(", ")})` :
                        `${CallBase}(${CallArgs.join(", ")})`;

                    this.Emit(`${IsLocal}${RemainingVars} = ${CallStr}`);
                } else {
                    const LastVal = this.Decompose(LastExpr);
                    TempValues.push(LastVal);

                    VarNames.forEach((Name, I) => {
                        const Val = TempValues[I] || "nil";
                        this.Emit(`${IsLocal}${Name} = ${Val}`);
                    });
                }
                break;
            }
            case "IfStatement": {
                Node.clauses.forEach((Clause, Index) => {
                    if (Clause.condition) {
                        const Cond = this.Decompose(Clause.condition);
                        this.Emit(`${Index === 0 ? "if" : "elseif"} ${Cond} then`);
                    } else {
                        this.Emit("else");
                    }
                    this.Indent++;
                    (Clause.body || []).forEach(N => this.HandleStatement(N));
                    this.Indent--;
                });
                this.Emit("end");
                break;
            }
            case "WhileStatement": {
                const CondVar = this.Decompose(Node.condition);
                this.Emit(`while ${CondVar} do`);
                this.Indent++;

                (Node.body || []).forEach(N => this.HandleStatement(N));

                const IsLiteral = ["NumericLiteral", "StringLiteral", "BooleanLiteral", "NilLiteral"].includes(Node.condition.type);

                if (!IsLiteral) {
                    const ReEval = this.Decompose(Node.condition);
                    if (CondVar !== "true" && CondVar !== "false" && CondVar !== "nil") {
                        this.Emit(`${CondVar} = ${ReEval}`);
                    }
                }

                this.Indent--;
                this.Emit("end");
                break;
            }
            case "ForNumericStatement": {
                const Start = this.Decompose(Node.start);
                const End = this.Decompose(Node.end);
                const Step = Node.step ? `, ${this.Decompose(Node.step)}` : "";
                this.Emit(`for ${Node.variable.name} = ${Start}, ${End}${Step} do`);
                this.Indent++;
                (Node.body || []).forEach(N => this.HandleStatement(N));
                this.Indent--;
                this.Emit("end");
                break;
            }
            case "ForGenericStatement": {
                const Iterators = (Node.iterators || []).map(It => {
                    if (It.type === "CallExpression" || It.type === "MethodCallExpression") {
                        const Base = this.Decompose(It.base || It.identifier);
                        const Args = (It.arguments || []).map(A => this.Decompose(A));
                        return `${Base}(${Args.join(", ")})`;
                    }
                    return this.Decompose(It);
                });

                const Names = Node.variables.map(V => V.name).join(", ");
                this.Emit(`for ${Names} in ${Iterators.join(", ")} do`);
                this.Indent++;
                (Node.body || []).forEach(N => this.HandleStatement(N));
                this.Indent--;
                this.Emit("end");
                break;
            }
            case "ReturnStatement": {
                const Values = (Node.arguments || []).map(Arg => this.Decompose(Arg));
                this.Emit(`return ${Values.join(", ")}`);
                break;
            }
            case "CallStatement":
                this.Decompose(Node.expression);
                break;
            case "FunctionDeclaration": {
                const Name = AstToCode.Handle(Node.identifier).trim();

                const Params = Node.parameters.map(P => {
                    if (P.type === "VarargLiteral") return "...";
                    return P.name;
                }).join(", ");

                this.Emit(`${Node.isLocal ? "local " : ""}function ${Name}(${Params})`);
                this.Indent++;
                (Node.body || []).forEach(N => this.HandleStatement(N));
                this.Indent--;
                this.Emit("end");
                break;
            }
            default:
                this.Emit(AstToCode.Handle(Node));
        }
    }

    Process() {
        const Body = Array.isArray(this.Root) ? this.Root : (this.Root.body || [this.Root]);
        Body.forEach(Node => this.HandleStatement(Node));
        return this.Output.join("\n");
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
    const BodyPaths = FindAllBodies(Ast);
    BodyPaths.sort((A, B) => B.length - A.length);

    for (const Path of BodyPaths) {
        const TargetBlock = Utils.GetKey(Ast, Path);
        const Decomposer = new ExpressionDecomposer(TargetBlock);
        const FlattenedCode = Decomposer.Process();

        try {
            const NewNodes = Utils.Parse(FlattenedCode);
            let Parent = Ast;
            for (let I = 0; I < Path.length - 1; I++) {
                Parent = Parent[Path[I]];
            }
            Parent[Path[Path.length - 1]] = NewNodes.body || NewNodes;
        } catch (E) {
            console.error("DECOMPOSITION ERROR in block:");
            console.error("--------------------------");
            console.error(FlattenedCode);
            console.error("--------------------------");
            throw E;
        }
    }

    const RootDecomposer = new ExpressionDecomposer(Ast);
    const OutputCode = RootDecomposer.Process();

    try {
        return Utils.Parse(OutputCode);
    } catch (E) {
        console.error("DECOMPOSITION ERROR in final root block:");
        console.error("--------------------------");
        console.error(OutputCode);
        console.error("--------------------------");
        throw E;
    }
}

module.exports = {
    DecomposeExpressions
};
