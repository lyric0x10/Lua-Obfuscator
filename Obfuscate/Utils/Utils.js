const luaparse = require("luaparse");
const { Random } = require("./Math");

function Parse(Code) {
    return luaparse.parse(Code).body
}

function FindAllInstances(Dict, Key, Target) {
    function SearchNode(Tree, SearchKey, TargetValue, CurrentPath = []) {
        let Blocks = [];

        if (Tree !== null && typeof Tree === 'object' && !Array.isArray(Tree)) {
            if (Object.prototype.hasOwnProperty.call(Tree, SearchKey)) {
                if (Tree[SearchKey] === TargetValue) {
                    Blocks.push([...CurrentPath, SearchKey]);
                }
            }

            for (const K in Tree) {
                const NewPath = [...CurrentPath, K];
                const Results = SearchNode(Tree[K], SearchKey, TargetValue, NewPath);
                Blocks.push(...Results);
            }
        } else if (Array.isArray(Tree)) {
            Tree.forEach((Item, Index) => {
                const NewPath = [...CurrentPath, Index];
                const Results = SearchNode(Item, SearchKey, TargetValue, NewPath);
                Blocks.push(...Results);
            });
        }

        return Blocks;
    }

    const FinalResult = SearchNode(Dict, Key, Target);
    return FinalResult;
}

function GenerateVariable(Length = 10, Type = 1) {
    let Letters, Numbers;
    if (Type == 1) {
        Letters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
        Numbers = "0123456789";
    } else if (Type == 2) {
        Letters = "lIjJi";
        Numbers = "1";
        Length = 15;
    }

    const AllCharacters = Letters + Numbers;
    let Variable = '';
    const FirstIndex = Math.floor(Math.random() * Letters.length);
    Variable += Letters.charAt(FirstIndex);

    for (let Index = 1; Index < Length; Index++) {
        const CharacterIndex = Math.floor(Math.random() * AllCharacters.length);
        Variable += AllCharacters.charAt(CharacterIndex);
    }

    return Variable;
}

function GetRandomSample(List, Percentage) {
    const SampleSize = Math.ceil(List.length * (Percentage / 100));
    let Result = [...List];

    for (let I = Result.length - 1; I > 0; I--) {
        const J = Math.floor(Math.random() * (I + 1));
        [Result[I], Result[J]] = [Result[J], Result[I]];
    }

    return Result.slice(0, SampleSize);
}

function GetKey(Obj, Path) {
    let CurrentValue = Obj;
    Path.forEach((Key) => {
        CurrentValue = CurrentValue[Key];
    });

    return CurrentValue;
}




module.exports = {
    Parse,
    FindAllInstances,
    GenerateVariable,
    GetRandomSample,
    GetKey,
};