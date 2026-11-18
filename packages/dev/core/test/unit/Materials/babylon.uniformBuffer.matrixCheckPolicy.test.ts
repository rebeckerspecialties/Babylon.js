import { describe, it, expect } from "vitest";
import { UniformBuffer } from "core/Materials/uniformBuffer";

/**
 * Runs updateUniform against the minimal state it reads, counting how often the engine's matrix policy is consulted.
 * @param options initial state of the buffer
 * @param options.hardCheck whether the engine compares matrices element by element
 * @param options.dynamic whether the buffer skips the static cache
 * @param options.copyOnWrite whether the first write must move to a new CPU buffer
 * @returns the buffer stand-in
 */
function createBuffer(options: { hardCheck?: boolean; dynamic?: boolean; copyOnWrite?: boolean } = {}) {
    const buffer = {
        _uniformLocations: { value: 4 } as Record<string, number>,
        _bufferData: new Float32Array(64),
        _buffer: {},
        _dynamic: !!options.dynamic,
        _createBufferOnWrite: !!options.copyOnWrite,
        _needSync: false,
        _dataGeneration: 0,
        hardCheck: !!options.hardCheck,
        policyReads: 0,
        replaced: [] as Float32Array[],
        _checkNewFrame() {},
        _createNewBuffer() {
            this.replaced.push(this._bufferData);
            this._bufferData = this._bufferData.slice();
            this._createBufferOnWrite = false;
        },
        _engine: {
            _features: {
                get uniformBufferHardCheckMatrix(): boolean {
                    buffer.policyReads++;
                    return buffer.hardCheck;
                },
            },
        },
        update(data: ArrayLike<number>, size: number = data.length) {
            UniformBuffer.prototype.updateUniform.call(this, "value", data as any, size);
        },
    };
    return buffer;
}

describe("UniformBuffer matrix check policy", () => {
    it("commits an unchanged matrix when the engine does not hard-check matrices", () => {
        const buffer = createBuffer();
        buffer.update(new Float32Array(16));
        expect(buffer._needSync).toBe(true);
        expect(buffer._dataGeneration).toBe(1);
        expect(buffer.policyReads).toBe(1);
    });

    it("compares a matrix element by element when the engine hard-checks matrices", () => {
        const buffer = createBuffer({ hardCheck: true });
        buffer.update(new Float32Array(16));
        expect(buffer._needSync).toBe(false);
        expect(buffer._dataGeneration).toBe(0);

        const changed = new Float32Array(16);
        changed[15] = 0.5;
        buffer.update(changed);
        expect(buffer._needSync).toBe(true);
        expect(buffer._dataGeneration).toBe(1);
        expect(buffer._bufferData[4 + 15]).toBe(0.5);
        expect(buffer.policyReads).toBe(2);
    });

    it.each([0, 1, 3, 4, 9, 32])("compares non-matrix data of size %i whatever the policy", (size) => {
        for (const hardCheck of [false, true]) {
            const buffer = createBuffer({ hardCheck });
            buffer.update(new Float32Array(size));
            expect(buffer._needSync).toBe(false);
            expect(buffer.policyReads).toBe(0);
            if (size > 0) {
                const changed = new Float32Array(size);
                changed[size - 1] = 2;
                buffer.update(changed);
                expect(buffer._needSync).toBe(true);
                expect(buffer._bufferData[4 + size - 1]).toBe(2);
            }
        }
    });

    it("reads the policy again on every call", () => {
        const buffer = createBuffer({ hardCheck: true });
        buffer.update(new Float32Array(16));
        expect(buffer._dataGeneration).toBe(0);
        buffer.hardCheck = false;
        buffer.update(new Float32Array(16));
        expect(buffer._dataGeneration).toBe(1);
        buffer.hardCheck = true;
        buffer.update(new Float32Array(16));
        expect(buffer._dataGeneration).toBe(1);
        expect(buffer.policyReads).toBe(3);
    });

    it("writes every element into the buffer that copy-on-write creates during the loop", () => {
        const buffer = createBuffer({ copyOnWrite: true });
        const data = Float32Array.from({ length: 16 }, (_, i) => i + 1);
        buffer.update(data);
        expect(buffer.replaced.length).toBe(1);
        expect(Array.from(buffer.replaced[0])).toEqual(new Array(64).fill(0));
        expect(Array.from(buffer._bufferData.subarray(4, 20))).toEqual(Array.from(data));
    });

    it("treats NaN as changed and signed zero as unchanged, as before", () => {
        const buffer = createBuffer({ hardCheck: true });
        buffer.update(new Float32Array(16).fill(NaN));
        buffer._needSync = false;
        buffer.update(new Float32Array(16).fill(NaN));
        expect(buffer._needSync).toBe(true);

        const zero = createBuffer({ hardCheck: true });
        zero.update(new Float32Array(16).fill(-0));
        expect(zero._needSync).toBe(false);
    });

    it("does not consult the policy for dynamic buffers", () => {
        const buffer = createBuffer({ dynamic: true });
        buffer.update(new Float32Array(16));
        expect(buffer._dataGeneration).toBe(1);
        expect(buffer.policyReads).toBe(0);
    });
});
