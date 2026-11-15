import { beforeEach, describe, expect, it, vi } from "vitest";
import { UniformBuffer } from "core/Materials/uniformBuffer";
import { Matrix } from "core/Maths/math.vector";

interface GpuBuffer {
    uniqueId: number;
    gpu: Float32Array;
}

describe("Shared uniform buffer versions", () => {
    let engine: any;
    let material: UniformBuffer;
    const current = (ubo: UniformBuffer) => ubo.getBuffer() as unknown as GpuBuffer;

    beforeEach(() => {
        let nextId = 0;
        engine = {
            supportsUniformBuffers: true,
            frameId: 1,
            _uniformBuffers: [],
            _features: { trackUbosInFrame: true, checkUbosContentBeforeUpload: true, uniformBufferHardCheckMatrix: false },
            createUniformBuffer: vi.fn((data: Float32Array) => ({ uniqueId: nextId++, gpu: data.slice() })),
            updateUniformBuffer: vi.fn((buffer: GpuBuffer, data: Float32Array) => {
                buffer.gpu = data.slice();
            }),
            _releaseBuffer: vi.fn(() => true),
        };
        material = new UniformBuffer(engine);
        material.addUniform("color", 4);
        material.create();
    });

    function draw(value: number) {
        material.updateFloat4("color", value, 0.5, 0.25, 1);
        material.update();
        return current(material);
    }

    it.each([0, 1, 40])("does not scan, upload, or allocate for %i additional unchanged draws", (count) => {
        const first = draw(1);
        engine.updateUniformBuffer.mockClear();
        engine.createUniformBuffer.mockClear();
        const compare = vi.spyOn(material as any, "_buffersEqual");
        for (let i = 0; i < count; i++) expect(draw(1)).toBe(first);
        expect(compare).not.toHaveBeenCalled();
        expect(engine.updateUniformBuffer).not.toHaveBeenCalled();
        expect(engine.createUniformBuffer).not.toHaveBeenCalled();
    });

    it("preserves every earlier draw when a material changes twice in the same frame", () => {
        const first = draw(1);
        const second = draw(2);
        const third = draw(1);
        expect(first).not.toBe(second);
        expect(second).not.toBe(third);
        expect([first.gpu[0], second.gpu[0], third.gpu[0]]).toEqual([1, 2, 1]);
    });

    it("reuses unchanged versions across frames without a full-buffer comparison", () => {
        draw(1);
        engine.updateUniformBuffer.mockClear();
        const compare = vi.spyOn(material as any, "_buffersEqual");
        for (let frame = 2; frame < 50; frame++) {
            engine.frameId = frame;
            draw(1);
        }
        expect(compare).not.toHaveBeenCalled();
        expect(engine.updateUniformBuffer).not.toHaveBeenCalled();
        expect(material._numBuffers).toBe(1);
    });

    it("keeps multiple views separate while sharing the unchanged material", () => {
        const view = new UniformBuffer(engine);
        view.addUniform("viewProjection", 16);
        view.create();
        const materialBuffers: GpuBuffer[] = [];
        const viewBuffers: GpuBuffer[] = [];
        const matrices = [Matrix.Translation(1, 0, 0), Matrix.Translation(2, 0, 0)];
        for (const matrix of [matrices[0], matrices[1], matrices[0]]) {
            view.updateMatrix("viewProjection", matrix);
            view.update();
            viewBuffers.push(current(view));
            materialBuffers.push(draw(1));
        }
        expect(new Set(materialBuffers).size).toBe(1);
        expect(viewBuffers.map((buffer) => buffer.gpu[12])).toEqual([1, 2, 1]);
        expect(new Set(viewBuffers).size).toBe(3);
    });

    it("retains per-view material changes and bounds buffer reuse over many frames", () => {
        for (let frame = 1; frame <= 100; frame++) {
            engine.frameId = frame;
            const left = draw(1);
            const right = draw(2);
            expect(left.gpu[0]).toBe(1);
            expect(right.gpu[0]).toBe(2);
            expect(left).not.toBe(right);
        }
        expect(material._numBuffers).toBe(2);
    });

    it("does not confuse equal version numbers in different materials", () => {
        const other = new UniformBuffer(engine);
        other.addUniform("color", 4);
        other.create();
        const first = draw(1);
        other.updateFloat4("color", 2, 0.5, 0.25, 1);
        other.update();
        expect(first).not.toBe(current(other));
        expect([first.gpu[0], current(other).gpu[0]]).toEqual([1, 2]);
    });

    it("recreates GPU data after context loss instead of trusting stale versions", () => {
        const first = draw(3);
        material._rebuildAfterContextLost();
        expect(draw(3)).not.toBe(first);
        expect(current(material).gpu[0]).toBe(3);
    });
});
