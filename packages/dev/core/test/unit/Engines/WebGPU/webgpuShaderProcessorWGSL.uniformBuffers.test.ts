import { beforeEach, describe, expect, it } from "vitest";
import { WebGPUShaderProcessorWGSL } from "core/Engines/WebGPU/webgpuShaderProcessorsWGSL";
import { WebGPUShaderProcessingContext } from "core/Engines/WebGPU/webgpuShaderProcessingContext";
import { ShaderLanguage } from "core/Materials/shaderLanguage";

describe("WGSL explicitly owned uniforms", () => {
    let processor: WebGPUShaderProcessorWGSL;
    let context: WebGPUShaderProcessingContext;

    beforeEach(() => {
        processor = new WebGPUShaderProcessorWGSL();
        context = new WebGPUShaderProcessingContext(ShaderLanguage.WGSL, true);
        processor.pureMode = true;
        processor.initializeShaders(context);
    });

    function shaders(expression = "uniforms.color") {
        return processor.finalizeShaders(
            "@vertex fn main(input: VertexInputs) -> FragmentInputs {}",
            `@fragment fn main(input: FragmentInputs) -> FragmentOutputs { fragmentOutputs.color = ${expression}; }`
        );
    }

    it("leaves ordinary uniforms in the effect buffer", () => {
        processor.uniformProcessor("uniform color: vec4f;", true, {});
        const result = shaders();
        expect(context.leftOverUniforms).toEqual([{ name: "color", type: "vec4f", length: 0 }]);
        expect(result.fragmentCode).toContain("uniforms.color");
        expect(context.availableBuffers.Material).toBeUndefined();
    });

    it("shares an explicit buffer between stages without duplicating its fields", () => {
        processor.uniformProcessor("uniform<Material> color: vec4f;", false, {});
        processor.uniformProcessor("uniform<Material> color: vec4f;", true, {});
        const result = shaders();
        expect(context.leftOverUniforms).toEqual([]);
        expect(context.availableBuffers.Material).toBeDefined();
        for (const code of [result.vertexCode, result.fragmentCode]) {
            expect(code.match(/color : vec4f/g)).toHaveLength(1);
            expect(code).toContain("var<uniform> _uniformsMaterial: Material");
        }
        expect(result.fragmentCode).toContain("_uniformsMaterial.color");
    });

    it("can retain the loose-uniform path for a custom material shader", () => {
        processor.uniformProcessor("uniform<Material> color: vec4f;", true, { DISABLE_MATERIAL_UNIFORM_BUFFER: "" });
        expect(shaders().fragmentCode).toContain("uniforms.color");
        expect(context.leftOverUniforms).toEqual([{ name: "color", type: "vec4f", length: 0 }]);
        expect(context.availableBuffers.Material).toBeUndefined();
    });

    it("keeps material, custom shared, and per-draw values separate", () => {
        processor.uniformProcessor("uniform<Material> color: vec4f;", true, {});
        processor.uniformProcessor("uniform<SharedParameters> intensity: f32;", true, {});
        processor.uniformProcessor("uniform world: mat4x4f;", false, {});
        const result = shaders("uniforms.color * uniforms.intensity + uniforms.world[0]");
        expect(context.leftOverUniforms.map((uniform) => uniform.name)).toEqual(["world"]);
        expect(context.availableBuffers.SharedParameters).toBeDefined();
        expect(result.fragmentCode).toContain("_uniformsMaterial.color * _uniformsSharedParameters.intensity + uniforms.world[0]");
    });

    it("preserves std140 array strides and preprocessor array lengths", () => {
        processor.uniformProcessor("uniform<Material> weights: array<f32, COUNT>;", true, { COUNT: "3" });
        processor.uniformProcessor("uniform<Material> matrix: mat4x4f;", true, {});
        const result = shaders("vec4f(uniforms.weights[2]) + uniforms.matrix[0]");
        expect(result.fragmentCode).toContain("@size(16)");
        expect(result.fragmentCode).toMatch(/weights : array<Material_\d+_strided_arr, 3>/);
        expect(result.fragmentCode).toContain("_uniformsMaterial.weights[2].el");
        expect(result.fragmentCode).toContain("_uniformsMaterial.matrix[0]");
    });

    it("does not rewrite longer identifiers or other objects", () => {
        processor.uniformProcessor("uniform<Material> color: vec4f;", true, {});
        const result = shaders("uniforms.color + uniforms.colorScale + other.color + myuniforms.color");
        expect(result.fragmentCode).toContain("_uniformsMaterial.color + uniforms.colorScale + other.color + myuniforms.color");
    });

    it("retains the component type in padded vector arrays", () => {
        processor.uniformProcessor("uniform<Material> offsets: array<vec2<f32>, 2>;", true, {});
        const result = shaders("vec4f(uniforms.offsets[0], 0.0, 1.0)");
        expect(result.fragmentCode).toContain("el: vec2<f32>");
        expect(result.fragmentCode).toContain("_uniformsMaterial.offsets[0].el");
    });

    it.each(["uniform color: vec4f;", "uniform<Other> color: vec4f;"])("rejects ambiguous ownership: %s", (declaration) => {
        processor.uniformProcessor("uniform<Material> color: vec4f;", false, {});
        expect(() => processor.uniformProcessor(declaration, true, {})).toThrow("Uniform color is declared in both Material");
    });

    it("rejects inconsistent declarations across stages", () => {
        processor.uniformProcessor("uniform<Material> color: vec4f;", false, {});
        expect(() => processor.uniformProcessor("uniform<Material> color: vec3f;", true, {})).toThrow("inconsistent declarations");
    });

    it.each(["LeftOver", "Internals"])("rejects the reserved buffer name %s", (name) => {
        expect(() => processor.uniformProcessor(`uniform<${name}> color: vec4f;`, false, {})).toThrow("reserved");
    });

    it("does not retain ownership when reused for another effect", () => {
        processor.uniformProcessor("uniform<Material> color: vec4f;", false, {});
        context = new WebGPUShaderProcessingContext(ShaderLanguage.WGSL, true);
        processor.initializeShaders(context);
        processor.uniformProcessor("uniform color: vec4f;", true, {});
        expect(shaders().fragmentCode).not.toContain("_uniformsMaterial");
        expect(context.availableBuffers.Material).toBeUndefined();
    });
});
