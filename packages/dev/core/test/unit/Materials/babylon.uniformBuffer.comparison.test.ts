import { describe, it, expect } from "vitest";
import { UniformBuffer } from "core/Materials/uniformBuffer";

describe("UniformBuffer shadow comparison", () => {
    const compare = (left: Float32Array, right: Float32Array): boolean =>
        (UniformBuffer.prototype as any)._buffersEqual(left, right);

    it.each([0, 1, 3, 4, 17, 256, 1024])("accepts equal buffers of length %i", (length) => {
        const left = Float32Array.from({ length }, (_, i) => i / 8);
        expect(compare(left, left.slice())).toBe(true);
    });

    it.each([0, 1, 2, 3, 7, 255])("detects a changed element at index %i in either operand", (index) => {
        const left = new Float32Array(256);
        const right = left.slice();
        right[index] = 1;
        expect(compare(left, right)).toBe(false);
        expect(compare(right, left)).toBe(false);
    });

    it("compares subarray values without inspecting bytes outside the views", () => {
        const left = new Float32Array([99, 1, 2, 3, 99]).subarray(1, 4);
        const right = new Float32Array([88, 1, 2, 3, 88]).subarray(1, 4);
        expect(compare(left, right)).toBe(true);
        right[2] = 4;
        expect(compare(left, right)).toBe(false);
    });

    it("retains numeric equality for signed zero and infinities", () => {
        expect(compare(new Float32Array([0, Infinity, -Infinity]), new Float32Array([-0, Infinity, -Infinity]))).toBe(true);
        expect(compare(new Float32Array([Infinity]), new Float32Array([-Infinity]))).toBe(false);
    });

    it("does not consider NaN values equal, including the same buffer", () => {
        const values = new Float32Array([1, NaN]);
        expect(compare(values, values.slice())).toBe(false);
        expect(compare(values, values)).toBe(false);
    });

    it("does not mutate either shadow buffer", () => {
        const left = new Float32Array([1, 2]);
        const right = new Float32Array([1, 3]);
        expect(compare(left, right)).toBe(false);
        expect(Array.from(left)).toEqual([1, 2]);
        expect(Array.from(right)).toEqual([1, 3]);
    });
});
