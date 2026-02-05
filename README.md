# Lua Obfuscator
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Lua](https://img.shields.io/badge/Lua-2C2D72?style=for-the-badge&logo=lua&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)
[![Ask DeepWiki](https://devin.ai/assets/askdeepwiki.png)](https://deepwiki.com/lyric0x10/Lua-Obfuscator)

This repository contains a powerful, multi-layered Lua obfuscator written in Node.js. It transforms readable Lua source code into a highly complex and difficult-to-understand equivalent by applying a series of configurable obfuscation techniques to an Abstract Syntax Tree (AST).

## Features

-   **Control-Flow Flattening:** Restructures the code's logic into a large `while` loop and a state machine, obscuring the original execution path.
-   **Expression De-composition:** Breaks down complex expressions into sequential, single-operation statements using temporary variables.
-   **String Encryption:** Encrypts string literals and injects a decryption routine into the final script.
-   **Constant Mangling:** Replaces numeric and boolean constants with intricate expressions that resolve to the original value at runtime.
-   **Global Hiding:** Proxies access to global variables (including the environment `_ENV`) through a shuffled table to deter static analysis.
-   **Variable Renaming:** Renames all local variables to meaningless, randomly generated names.
-   **Anti-Tampering:** Injects runtime checks to detect debugging and modifications to core Lua functions (`pcall`, `debug.getinfo`, etc.), triggering an infinite loop if tampering is detected.

## How It Works

The obfuscator follows a pipeline approach:

1.  **Parse:** The script reads the source code from `Input.lua` and parses it into an Abstract Syntax Tree (AST) using `luaparse`.
2.  **Transform:** A series of transformation modules are applied sequentially to the AST. Each module modifies the tree to implement a specific obfuscation feature.
3.  **Generate:** The modified AST is converted back into Lua code.
4.  **Format:** The final code is either minified or beautified based on the configuration.
5.  **Output:** The resulting obfuscated code is written to `Output.lua`.

## Usage

### Prerequisites

-   [Node.js](https://nodejs.org/)

### Installation

1.  Clone the repository:
    ```sh
    git clone https://github.com/lyric0x10/lua-obfuscator.git
    cd lua-obfuscator
    ```

2.  Install dependencies:
    ```sh
    npm install luaparse
    ```

### Running the Obfuscator

1.  Place your Lua code into `Input.lua`.
2.  Run the main script from your terminal:
    ```sh
    node Main.js
    ```
3.  The obfuscated output will be generated in `Output.lua`.

## Configuration

You can enable or disable specific obfuscation passes by modifying the `Settings` object in `Main.js`.

```javascript
const Settings = {
    "Beautify": false,
    "Mangle Numbers": true,
    "Mangle Bools": true,
    "Encrypt Strings": true,
    "Hide Globals": true,
    "Anti Tamper": true,
    "Control Flow": true,
    "Decompose Expressions": true,
}
```

-   **`Beautify`**: If `true`, the output code will be formatted for readability. If `false`, it will be minified.
-   **`Mangle Numbers`**: Replaces numbers with complex mathematical expressions.
-   **`Mangle Bools`**: Replaces `true`/`false` with conditional expressions.
-   **`Encrypt Strings`**: Encrypts all string literals.
-   **`Hide Globals`**: Wraps the script to proxy access to global variables.
-   **`Anti Tamper`**: Adds anti-debugging and integrity checks. Note: This requires `Beautify` to be `false`.
-   **`Control Flow`**: Enables control-flow flattening.
-   **`Decompose Expressions`**: Breaks down expressions into simpler, sequential parts.

## Project Structure

-   `Main.js`: The main entry point that orchestrates the obfuscation pipeline based on the settings.
-   `Input.lua`: The input file for the Lua code you want to obfuscate.
-   `Output.lua`: The file where the obfuscated code is written.
-   `Obfuscate/`: Directory containing all obfuscation modules.
    -   `AntiTamper.js`: Adds anti-tampering and anti-debugging checks.
    -   `HideGlobals.js`: Hides global variable and environment access.
    -   `VariableRenamer.js`: Renames variables to random strings.
    -   `ControlFlow/`:
        -   `ControlFlow.js`: Implements control-flow flattening using a state machine.
        -   `DecomposeExpressions.js`: Breaks complex expressions into simpler temp-variable assignments.
    -   `MangleConstants/`:
        -   `EncryptStrings.js`: Encrypts string literals and handles member expression stringification.
        -   `MangleBools.js`: Replaces booleans with equivalent conditional expressions.
        -   `MangleNumbers.js`: Replaces numbers with arithmetic expressions.
    -   `Utils/`:
        -   `AST2Code.js`: Converts the Abstract Syntax Tree (AST) back to Lua code.
        -   `Formatter.js`: Provides robust code minification and beautification based on a custom Lua parser.
        -   `Math.js`: Helper functions for generating randomized mathematical expressions.
        -   `Utils.js`: Core utilities for AST parsing (`luaparse`), random variable generation, and other helpers.
