import { Position, SourceMapConsumer } from "source-map";
import * as tstl from "../../src";
import * as util from "../util";

test.each([
    {
        typeScriptSource: `
            const abc = "foo";
            const def = "bar";

            const xyz = "baz";`,

        assertPatterns: [
            { luaPattern: "abc", typeScriptPattern: "abc" },
            { luaPattern: "def", typeScriptPattern: "def" },
            { luaPattern: "xyz", typeScriptPattern: "xyz" },
            { luaPattern: `"foo"`, typeScriptPattern: `"foo"` },
            { luaPattern: `"bar"`, typeScriptPattern: `"bar"` },
            { luaPattern: `"baz"`, typeScriptPattern: `"baz"` },
        ],
    },
    {
        typeScriptSource: `
            function abc() {
                return def();
            }
            function def() {
                return "foo";
            }
            return abc();`,

        assertPatterns: [
            { luaPattern: "function abc(", typeScriptPattern: "function abc() {" },
            { luaPattern: "function def(", typeScriptPattern: "function def() {" },
            { luaPattern: "return abc(", typeScriptPattern: "return abc(" },
        ],
    },
    {
        typeScriptSource: `
            const enum abc { foo = 2, bar = 4 };
            const xyz = abc.foo;`,

        assertPatterns: [
            { luaPattern: "xyz", typeScriptPattern: "xyz" },
            { luaPattern: "2", typeScriptPattern: "abc.foo" },
        ],
    },
])("Source map has correct mapping (%p)", async ({ typeScriptSource, assertPatterns }) => {
    // Act
    const { file } = util.transpileStringResult(typeScriptSource);

    // Assert
    if (!util.expectToBeDefined(file.lua) || !util.expectToBeDefined(file.sourceMap)) return;

    const consumer = await new SourceMapConsumer(file.sourceMap);
    for (const { luaPattern, typeScriptPattern } of assertPatterns) {
        const luaPosition = lineAndColumnOf(file.lua, luaPattern);
        const mappedPosition = consumer.originalPositionFor(luaPosition);

        const typescriptPosition = lineAndColumnOf(typeScriptSource, typeScriptPattern);

        const mappedLineColumn = { line: mappedPosition.line, column: mappedPosition.column };
        expect(mappedLineColumn).toEqual(typescriptPosition);
    }
});

test("sourceMapTraceback saves sourcemap in _G", () => {
    // Arrange
    const typeScriptSource = `
        function abc() {
            return "foo";
        }
        return JSONStringify(_G.__TS__sourcemap);`;

    const options: tstl.CompilerOptions = {
        sourceMapTraceback: true,
        luaLibImport: tstl.LuaLibImportKind.Inline,
    };

    // Act
    const transpiledLua = util.transpileString(typeScriptSource, options);

    const sourceMapJson = util.transpileAndExecute(
        typeScriptSource,
        options,
        undefined,
        "declare const _G: {__TS__sourcemap: any};",
    );

    // Assert
    expect(sourceMapJson).toBeDefined();

    const sourceMap = JSON.parse(sourceMapJson);

    const sourceMapFiles = Object.keys(sourceMap);

    expect(sourceMapFiles.length).toBe(1);
    expect(sourceMap[sourceMapFiles[0]]).toBeDefined();

    const assertPatterns = [
        { luaPattern: "function abc(", typeScriptPattern: "function abc() {" },
        { luaPattern: `return "foo"`, typeScriptPattern: `return "foo"` },
    ];

    for (const { luaPattern, typeScriptPattern } of assertPatterns) {
        const luaPosition = lineAndColumnOf(transpiledLua, luaPattern);
        const mappedLine = sourceMap[sourceMapFiles[0]][luaPosition.line.toString()];

        const typescriptPosition = lineAndColumnOf(typeScriptSource, typeScriptPattern);

        // Add 1 to account for transpiledAndExecute-added function header
        expect(mappedLine).toEqual(typescriptPosition.line + 1);
    }
});

test("Inline sourcemaps", () => {
    const typeScriptSource = `
        function abc() {
            return def();
        }
        function def() {
            return "foo";
        }
        return abc();`;

    const compilerOptions: tstl.CompilerOptions = { inlineSourceMap: true };

    const { file } = util.transpileStringResult(typeScriptSource, compilerOptions);
    if (!util.expectToBeDefined(file.lua)) return;

    const inlineSourceMapMatch = file.lua.match(
        /--# sourceMappingURL=data:application\/json;base64,([A-Za-z0-9+/=]+)/,
    );

    if (util.expectToBeDefined(inlineSourceMapMatch)) {
        const inlineSourceMap = Buffer.from(inlineSourceMapMatch[1], "base64").toString();
        expect(file.sourceMap).toBe(inlineSourceMap);

        expect(util.executeLua(file.lua)).toBe("foo");
    }
});

// Helper functions

function lineAndColumnOf(text: string, pattern: string): Position {
    const pos = text.indexOf(pattern);
    if (pos === -1) {
        return { line: -1, column: -1 };
    }

    const lineLengths = text.split("\n").map(s => s.length);

    let totalPos = 0;
    for (let line = 1; line <= lineLengths.length; line++) {
        // Add + 1 for the removed \n
        const lineLength = lineLengths[line - 1] + 1;
        if (pos < totalPos + lineLength) {
            return { line, column: pos - totalPos };
        }

        totalPos += lineLengths[line - 1] + 1;
    }

    return { line: -1, column: -1 };
}
