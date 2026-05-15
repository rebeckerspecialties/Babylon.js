varying vUV: vec2f;

uniform _Line_Width_: f32;
uniform _Base_Color_: vec4f;
uniform _Line_Color_: vec4f;
uniform _Fade_Out_: f32;

@fragment
fn main(input: FragmentInputs) -> FragmentOutputs {
    let edge: vec2f = abs(input.vUV - vec2f(0.5)) * 2.0;
    let distanceToEdge: f32 = max(edge.x, edge.y);
    let lineWidth: f32 = max(uniforms._Line_Width_ * 6.0, 0.01);
    let border: f32 = smoothstep(1.0 - lineWidth, 1.0, distanceToEdge);
    var color: vec4f = mix(uniforms._Base_Color_, uniforms._Line_Color_, border);
    color.a *= uniforms._Fade_Out_;
    fragmentOutputs.color = color;
}
