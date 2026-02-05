const Utils = require("./Utils/Utils.js");
const AST2Code = require("./Utils/AST2Code.js");

function AntiTamper(AST) {
    let Code = `do
        local a = true
        local b = debug and debug.sethook or function()
            end
        local c = nil
        local d = 0
        local function e()
            d = d + 1
        end
        b(
            function(f, g)
                if not g then
                    return
                end
                e()
                if c then
                    if c ~= g then
                        b(error, "l", 5)
                    end
                else
                    c = g
                end
            end,
            "l",
            5
        )
        e()
        e()
        b()
        if d < 2 then
            a = false
        end
        local h = {pcall, string.char, debug.getinfo, string.dump}
        for i = 1, #h do
            local j = h[i]
            if debug.getinfo(j).what ~= "C" then
                a = false
            end
            if debug.getupvalue(j, 1) then
                a = false
            end
            if pcall(string.dump, j) then
                a = false
            end
        end
        if not a then
            local k = function()
                while true do
                end
            end
            k()
        end

        ${AST2Code.AST2Code(AST)}
    end`

    
    return Utils.Parse(Code)
}

module.exports = {
    AntiTamper
}