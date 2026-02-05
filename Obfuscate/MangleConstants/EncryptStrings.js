const Utils = require("../Utils/Utils.js");
const Ast2Code = require("../Utils/AST2Code.js");
const MathUtils = require("../Utils/Math.js");

const FindAllInstances = Utils.FindAllInstances;

function StringifyMemberExpressions(Ast) {
    const MemberExpressions = FindAllInstances(Ast, "type", "MemberExpression");
    for (const Path of MemberExpressions) {
        let ParentNode = Ast;
        for (const Key of Path.slice(0, -1)) {
            ParentNode = ParentNode[Key];
        }

        const TargetKey = Path.at(-1);
        const Node = ParentNode[TargetKey];
        if (Node.indexer == ".") {
            ParentNode[TargetKey] = {
                "type": "IndexExpression",
                "base": Node.base,
                "index": {
                    "type": "StringLiteral",
                    "value": null,
                    "raw": `"${Node.identifier.name}"`
                }
            };
        }
    }
    return Ast;
}

function UnescapeLuaString(StringInput) {
    const Bytes = [];
    let Index = 0;

    while (Index < StringInput.length) {
        const Char = StringInput[Index];
        if (Char === '\\') {
            const NextChar = StringInput[Index + 1];
            if (/\d/.test(NextChar)) {
                let DecimalString = StringInput.substr(Index + 1, 3).match(/^\d+/)[0];
                Bytes.push(parseInt(DecimalString, 10));
                Index += DecimalString.length + 1;
            } else {
                const EscapeMap = {
                    'n': 10,
                    'r': 13,
                    't': 9,
                    'v': 11,
                    'b': 8,
                    'f': 12,
                    '\\': 92,
                    '"': 34,
                    "'": 39
                };
                Bytes.push(EscapeMap[NextChar] || NextChar.charCodeAt(0));
                Index += 2;
            }
        } else {
            const CodePoint = StringInput.codePointAt(Index);
            if (CodePoint > 0xFFFF) {
                const TempBuffer = Buffer.from(String.fromCodePoint(CodePoint), 'utf8');
                for (const Byte of TempBuffer) Bytes.push(Byte);
                Index += 2;
            } else {
                const TempBuffer = Buffer.from(StringInput[Index], 'utf8');
                for (const Byte of TempBuffer) Bytes.push(Byte);
                Index++;
            }
        }
    }
    return Buffer.from(Bytes);
}

const BaseStarEncode = (DataBuffer, Alphabet) => {
    let LargeNumber = BigInt('0x' + DataBuffer.toString('hex'));
    if (LargeNumber === 0n) return Alphabet[0];

    const BaseValue = BigInt(Alphabet.length);
    let ResultString = '';

    while (LargeNumber > 0n) {
        ResultString = Alphabet[Number(LargeNumber % BaseValue)] + ResultString;
        LargeNumber /= BaseValue;
    }
    return ResultString;
};

function EncryptStrings(Ast, Percentage = 100) {
    const PossibleCharacters = "!#$%&()*+,-.:;<=>?@[]^_{}~0123456789ABCDEFGHJKLMNOPQRSTUVWXYZ".split("");

    function Encode(EncryptedBuffer, EncryptionKey) {
        const AlphabetSize = Math.floor(Math.random() * (PossibleCharacters.length - 16 + 1)) + 16;
        const RandomizedAlphabet = PossibleCharacters.sort(() => Math.random() - 0.5).slice(0, AlphabetSize);

        const EncodedString = BaseStarEncode(EncryptedBuffer, RandomizedAlphabet);

        let LowercasePool = "abcdefghijklmnopqrstuvwxyz";
        let DelimiterString = PossibleCharacters.sort(() => Math.random() - 0.5).slice(0, 4).join("") + LowercasePool[MathUtils.Random(0, LowercasePool.length - 1)];

        let FinalPayload = DelimiterString + RandomizedAlphabet.join("") + DelimiterString + EncodedString;

        return `${DecryptorVariableName}("${FinalPayload}", "${EncryptionKey}")`;
    }

    function EncryptToBuffer(InputBuffer, KeyString) {
        const KeyBuffer = Buffer.from(KeyString, 'binary');
        const OutputBuffer = Buffer.alloc(InputBuffer.length);

        for (let Index = 0; Index < InputBuffer.length; Index++) {
            OutputBuffer[Index] = InputBuffer[Index] ^ KeyBuffer[Index % KeyBuffer.length];
        }
        return OutputBuffer;
    }

    const DecryptorVariableName = Utils.GenerateVariable();

    let LuaDecryptorCode = `local ${DecryptorVariableName} = function(b, c)
        if not b or b == "" then return "" end
        local d = b:sub(1, 5)
        local e, f = b:find(d, 6, true)
        if not e then return "" end
        local g = b:sub(6, e - 1)
        local h = b:sub(f + 1)
        local i = {}
        for j = 1, #g do i[g:sub(j, j)] = j - 1 end
        
        local k = {0}
        for j = 1, #h do
            local l = i[h:sub(j, j)]
            if l then
                for m = #k, 1, -1 do
                    local n = k[m] * #g + l
                    k[m] = n % 256
                    l = math.floor(n / 256)
                end
                while l > 0 do
                    table.insert(k, 1, l % 256)
                    l = math.floor(l / 256)
                end
            end
        end
        
        local o = ""
        local p = #c
        for j = 1, #k do
            local q = k[j]
            local r = c:byte((j - 1) % p + 1)
            local s, t = 0, 1
            for BitIndex = 1, 8 do
                if q % 2 ~= r % 2 then s = s + t end
                q = math.floor(q / 2)
                r = math.floor(r / 2)
                t = t * 2
            end
            o = o .. string.char(s)
        end
        return o
    end\n`;

    let StringNodes = FindAllInstances(Ast, "type", "StringLiteral");
    StringNodes = Utils.GetRandomSample(StringNodes, Percentage);

    for (const Path of StringNodes) {
        let ParentNode = Ast;
        for (const Key of Path.slice(0, -1)) {
            ParentNode = ParentNode[Key];
        }

        let RawValue = ParentNode["raw"];
        let StringBuffer;

        if (RawValue.startsWith("[") && RawValue.endsWith("]")) {
            let Content = RawValue.replace(/^\[(=*)\[\n?/, "$1").replace(/\](=*)\]$/, "$1");
            StringBuffer = Buffer.from(Content, 'utf8');
        } else {
            let Content = RawValue.slice(1, -1);
            StringBuffer = UnescapeLuaString(Content);
        }

        if (StringBuffer.length > 0) {
            let GeneratedKey = (PossibleCharacters.sort(() => Math.random() - 0.5).slice(0, MathUtils.Random(5, 40))).join("");
            let EncryptedBuffer = EncryptToBuffer(StringBuffer, GeneratedKey);

            ParentNode["raw"] = Encode(EncryptedBuffer, GeneratedKey);
        }
    }

    const TranspiledCode = Ast2Code.AST2Code(Ast);
    return Utils.Parse(LuaDecryptorCode + TranspiledCode);
}

module.exports = {
    StringifyMemberExpressions,
    EncryptStrings
};
