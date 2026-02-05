const Utils = require("../Utils/Utils.js");
const A2C = require("../Utils/AST2Code.js");
const _Math = require("../Utils/Math.js");

const FindAllInstances = Utils.FindAllInstances

function StringifyMemberExpressions(AST) {
    const MEs = FindAllInstances(AST, "type", "MemberExpression")
    for (const Path of MEs) {
        let ParentNode = AST;
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
    return AST
}


function unescapeLuaString(s) {
    const bytes = [];
    let i = 0;

    while (i < s.length) {
        const char = s[i];
        if (char === '\\') {
            const next = s[i + 1];
            if (/\d/.test(next)) {
                let decimalStr = s.substr(i + 1, 3).match(/^\d+/)[0];
                bytes.push(parseInt(decimalStr, 10));
                i += decimalStr.length + 1;
            } else {
                const escapes = {
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
                bytes.push(escapes[next] || next.charCodeAt(0));
                i += 2;
            }
        } else {
            const code = s.codePointAt(i);
            if (code > 0xFFFF) {
                const tempBuf = Buffer.from(String.fromCodePoint(code), 'utf8');
                for (const b of tempBuf) bytes.push(b);
                i += 2;
            } else {
                const tempBuf = Buffer.from(s[i], 'utf8');
                for (const b of tempBuf) bytes.push(b);
                i++;
            }
        }
    }
    return Buffer.from(bytes);
}

const BaseStarEncode = (dataBuffer, alphabet) => {
    let num = BigInt('0x' + dataBuffer.toString('hex'));
    if (num === 0n) return alphabet[0];

    const base = BigInt(alphabet.length);
    let result = '';

    while (num > 0n) {
        result = alphabet[Number(num % base)] + result;
        num /= base;
    }
    return result;
};



function EncryptStrings(AST, Percentage = 100) {
    const PossibleChars = "!#$%&()*+,-.:;<=>?@[]^_{}~0123456789ABCDEFGHJKLMNOPQRSTUVWXYZ".split("");

    function Encode(EncryptedBuffer, Key) {
        const Size = Math.floor(Math.random() * (PossibleChars.length - 16 + 1)) + 16;
        const Alphabet = PossibleChars.sort(() => Math.random() - 0.5).slice(0, Size);

        const Encoded = BaseStarEncode(EncryptedBuffer, Alphabet);

        let Other = "abcdefghijklmnopqrstuvwxyz";
        let Delimiter = PossibleChars.sort(() => Math.random() - 0.5).slice(0, 4).join("") + Other[_Math.Random(0, Other.length - 1)];

        let Payload = Delimiter + Alphabet.join("") + Delimiter + Encoded;

        return `${Decryptor}("${Payload}", "${Key}")`;
    }

    function EncryptToBuffer(InputBuffer, KeyString) {
        const KeyBuffer = Buffer.from(KeyString, 'binary');
        const Output = Buffer.alloc(InputBuffer.length);

        for (let i = 0; i < InputBuffer.length; i++) {
            Output[i] = InputBuffer[i] ^ KeyBuffer[i % KeyBuffer.length];
        }
        return Output;
    }

    const Decryptor = Utils.GenerateVariable();

    let Code = `local ${Decryptor} = function(b, c)
        if not b or b == "" then return "" end
        local d = b:sub(1, 5)
        local e, f = b:find(d, 6, true)
        if not e then return "" end
        local g = b:sub(6, e - 1) -- Fix: Use 'e' (start of delim) not 'f'
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
            for _bit = 1, 8 do -- Fix: Renamed loop var to avoid shadowing 'e'
                if q % 2 ~= r % 2 then s = s + t end
                q = math.floor(q / 2)
                r = math.floor(r / 2)
                t = t * 2
            end
            o = o .. string.char(s)
        end
        return o
    end\n`;
    let Strings = FindAllInstances(AST, "type", "StringLiteral")
    Strings = Utils.GetRandomSample(Strings, Percentage)

    for (const Path of Strings) {
        let ParentNode = AST;
        for (const Key of Path.slice(0, -1)) {
            ParentNode = ParentNode[Key];
        }

        let RawValue = ParentNode["raw"];
        let InputBuffer;

        if (RawValue.startsWith("[") && RawValue.endsWith("]")) {
            let content = RawValue.replace(/^\[(=*)\[\n?/, "$1").replace(/\](=*)\]$/, "$1");
            InputBuffer = Buffer.from(content, 'utf8');
        } else {
            let content = RawValue.slice(1, -1);
            InputBuffer = unescapeLuaString(content);
        }

        if (InputBuffer.length > 0) {
            // A. Encrypt first
            let Key = (PossibleChars.sort(() => Math.random() - 0.5).slice(0, _Math.Random(5,40))).join("");
            let EncryptedBuffer = EncryptToBuffer(InputBuffer, Key);

            // B. Encode the encrypted result
            ParentNode["raw"] = Encode(EncryptedBuffer, Key);
        }
    }

    const NewCode = A2C.AST2Code(AST);
    return Utils.Parse(Code + NewCode);
}

module.exports = {
    StringifyMemberExpressions,
    EncryptStrings
}