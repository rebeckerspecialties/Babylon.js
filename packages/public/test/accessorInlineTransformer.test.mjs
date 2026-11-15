import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const { createAccessorInlineTransformers, getAccessorInlineOptionsFromEnv } = await import("../accessorInlineTransformer.mjs");

function compile(source, options = {}) {
    const directory = mkdtempSync(join(tmpdir(), "babylon-accessor-test-"));
    try {
        const file = join(directory, "fixture.ts");
        writeFileSync(file, source);
        const program = ts.createProgram([file], { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None, noLib: true });
        const transformer = createAccessorInlineTransformers(program, {
            mode: "all",
            allowMapped: true,
            downcastPolicy: "site",
            siblingRule: true,
            scanExternalPackages: false,
            ...options,
        });
        let code;
        program.emit(
            undefined,
            (name, text) => {
                if (name.endsWith(".js")) code = text;
            },
            undefined,
            undefined,
            transformer
        );
        const context = vm.createContext({});
        vm.runInContext(code, context);
        return { code, result: JSON.parse(JSON.stringify(context.result)), report: transformer.buildReport() };
    } finally {
        rmSync(directory, { recursive: true, force: true });
    }
}

test("inlines trivial reads and leaves setters, compound assignments and deletes intact", () => {
    const f = compile(`class Value { _value = 3; writes = 0; get value() { return this._value; } set value(n: number) { this.writes++; this._value = n; } }
        const v = new Value(); v.value = 4; v.value += 2; const read = v.value; delete v.value;
        globalThis.result = [read, v.writes, v._value];`);
    assert.deepEqual(f.result, [6, 2, 6]);
    assert.ok(f.report.total > 0);
    assert.match(f.code, /const read = v\._value/);
    assert.match(f.code, /v\.value \+= 2/);
    assert.match(f.code, /delete v\.value/);
});

test("zero candidates remains a correct no-op", () => {
    const f = compile("const value = { plain: 9 }; globalThis.result = value.plain;");
    assert.equal(f.result, 9);
    assert.equal(f.report.total, 0);
});

test("known subclass overrides are not bypassed through a base-typed argument", () => {
    const f = compile(`class Base { _value = 3; get value() { return this._value; } }
        class Child extends Base { get value() { return 17; } }
        function read(value: Base) { return value.value; }
        globalThis.result = [read(new Base()), read(new Child())];`);
    assert.deepEqual(f.result, [3, 17]);
    assert.equal(f.report.total, 0);
});

test("runtime property definitions and side-effecting getters keep normal dispatch", () => {
    const f = compile(`class Value { _value = 3; calls = 0; get value() { return this._value; } get counted() { return ++this.calls; } }
        const v = new Value(); Object.defineProperty(v, "value", { get() { return 12; } });
        globalThis.result = [v.value, v.counted, v.counted];`);
    assert.deepEqual(f.result, [12, 1, 2]);
    assert.equal(f.report.total, 0);
});

test("optional reads and effectful receivers are evaluated exactly once", () => {
    const f = compile(`class Value { _value = 4; get value() { return this._value; } }
        let count = 0; function getValue(): Value { count++; return new Value(); }
        function read(value: Value | null) { return value?.value; }
        globalThis.result = [getValue().value, count, read(null) ?? -1, read(new Value())];`);
    assert.deepEqual(f.result, [4, 1, -1, 4]);
    assert.ok(f.report.total > 0);
});

test("narrowing assertions and sibling class probes keep their original behavior", () => {
    const f = compile(`class Base {} class Mesh extends Base { _value = 5; get material() { return this._value; } }
        class Sibling extends Base { material = 19; }
        function read(value: Base) { return (value as Mesh).material; }
        globalThis.result = [read(new Mesh()), read(new Sibling())];`);
    assert.deepEqual(f.result, [5, 19]);
});

test("structural interface arguments remain public-property reads", () => {
    const f = compile(`class Value { _value = 3; get value() { return this._value; } }
        interface Shape { value: number; } function read(value: Shape) { return value.value; }
        globalThis.result = [read(new Value()), read({ value: 25 })];`);
    assert.deepEqual(f.result, [3, 25]);
    assert.equal(f.report.total, 0);
});

test("off is opt-in safe and an unknown mode fails rather than silently disabling", () => {
    const previous = process.env.BABYLON_ACCESSOR_INLINE;
    try {
        process.env.BABYLON_ACCESSOR_INLINE = "off";
        assert.equal(getAccessorInlineOptionsFromEnv(), undefined);
        process.env.BABYLON_ACCESSOR_INLINE = "typo";
        assert.throws(getAccessorInlineOptionsFromEnv, /unknown mode/);
    } finally {
        if (previous === undefined) delete process.env.BABYLON_ACCESSOR_INLINE;
        else process.env.BABYLON_ACCESSOR_INLINE = previous;
    }
});
