import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { NullEngine } from "core/Engines/nullEngine";
import { Scene } from "core/scene";
import { PBRMaterial } from "core/Materials/PBR/pbrMaterial";
import { StandardMaterial } from "core/Materials/standardMaterial";
import { ShaderLanguage } from "core/Materials/shaderLanguage";
import { WebGPUShaderProcessorWGSL } from "core/Engines/WebGPU/webgpuShaderProcessorsWGSL";
import { WebGPUShaderProcessingContext } from "core/Engines/WebGPU/webgpuShaderProcessingContext";

describe("PBR WGSL material buffer ownership", () => {
    let engine: NullEngine;
    let scene: Scene;

    beforeEach(() => {
        engine = new NullEngine();
        Object.defineProperties(engine, { isWebGPU: { value: true }, supportsUniformBuffers: { value: true } });
        engine.createUniformBuffer = vi.fn(() => ({ references: 1 }) as any);
        scene = new Scene(engine);
    });

    afterEach(() => {
        scene.dispose();
        engine.dispose();
    });

    it("uses one material buffer with matching base and plugin field order", () => {
        const material = new PBRMaterial("shared", scene);
        material.buildUniformLayout();
        expect(material._uniformBuffer.useUbo).toBe(true);
        const processor = new WebGPUShaderProcessorWGSL();
        const context = new WebGPUShaderProcessingContext(ShaderLanguage.WGSL, true);
        processor.initializeShaders(context);
        const source = readFileSync("packages/dev/core/src/ShadersWGSL/ShadersInclude/pbrUboDeclaration.fx", "utf8").replace(
            "#define ADDITIONAL_UBO_DECLARATION",
            (material.pluginManager as any)._uboDeclaration
        );
        for (const line of source.split(/\r?\n/)) if (processor.uniformRegexp.test(line)) processor.uniformProcessor(line, true, {});
        expect((processor as any)._namedUniformBuffers.get("Material").map((uniform: any) => uniform.name)).toEqual((material._uniformBuffer as any)._uniformNames);
        expect(context.leftOverUniforms).toEqual([]);
    });

    it("keeps the existing loose-uniform path for other WGSL material shaders", () => {
        const material = new StandardMaterial("standard", scene);
        expect(material._uniformBuffer.useUbo).toBe(false);
    });

    it("preserves custom PBR shader update behavior", () => {
        const material = new PBRMaterial("custom", scene);
        material.customShaderNameResolve = () => "customPbr";
        material.buildUniformLayout();
        expect(material._uniformBuffer.useUbo).toBe(false);
        expect((material.pluginManager as any)._uboDeclaration).not.toContain("uniform<Material>");
    });

    it("does not change GLSL material buffer ownership", () => {
        const material = new PBRMaterial("glsl", scene, true);
        material.buildUniformLayout();
        expect(material.shaderLanguage).toBe(ShaderLanguage.GLSL);
        expect(material._uniformBuffer.useUbo).toBe(true);
        expect((material.pluginManager as any)._uboDeclaration).not.toContain("uniform<Material>");
    });

    it("rebuilds ownership when a custom shader is installed or removed after compilation", () => {
        const material = new PBRMaterial("custom-later", scene);
        material.buildUniformLayout();
        expect(material._uniformBuffer.useUbo).toBe(true);
        const version = material._drawCacheVersion;
        material.customShaderNameResolve = () => "customPbr";
        (material as any)._ensureUniformBufferLayout();
        expect(material._uniformBuffer.useUbo).toBe(false);
        expect(material._drawCacheVersion).toBeGreaterThan(version);
        material.customShaderNameResolve = undefined;
        (material as any)._ensureUniformBufferLayout();
        expect(material._uniformBuffer.useUbo).toBe(true);
    });
});
