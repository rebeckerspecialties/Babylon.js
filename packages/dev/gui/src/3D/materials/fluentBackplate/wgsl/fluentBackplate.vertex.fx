attribute position: vec3f;
attribute normal: vec3f;

uniform world: mat4x4f;
uniform viewProjection: mat4x4f;

varying vUV: vec2f;

@vertex
fn main(input: VertexInputs) -> FragmentInputs {
    let worldPos: vec4f = uniforms.world * vec4f(vertexInputs.position, 1.0);
    vertexOutputs.position = uniforms.viewProjection * worldPos;
    vertexOutputs.vUV = vertexInputs.position.xy * 2.0 + vec2f(0.5);
}
