import { Engine } from "core/Engines/engine";
import { Scene } from "core/scene";
import { FreeCamera } from "core/Cameras/freeCamera";
import { Vector3 } from "core/Maths/math.vector";
import { ShaderStore } from "core/Engines/shaderStore";
import { RenderTargetTexture } from "core/Materials/Textures/renderTargetTexture";
import { PostProcess } from "core/PostProcesses/postProcess";
import "core/Shaders/postprocess.vertex";

async function run() {
    const n = 128;
    const screen = document.createElement("canvas");
    screen.width = screen.height = n;
    const engine = new Engine(screen, false, { disableWebGL2Support: false });
    if (engine.webGLVersion !== 2) throw Error("WebGL 2 required");
    const scene = new Scene(engine);
    const camera = new FreeCamera("camera", Vector3.Zero(), scene);
    scene.activeCamera = camera;
    const target = new RenderTargetTexture("two slices", {width:n, height:n, layers:2}, scene, false);
    target.renderList = [];
    ShaderStore.ShadersStore.sliceReceiptPixelShader = `precision highp float;
        varying vec2 vUV; uniform float slice;
        void main() {
            vec3 c = mix(vec3(.05,.62,.80),vec3(.92,.38,.10),slice);
            float grid = mod(floor(vUV.x*8.)+floor(vUV.y*8.),2.);
            float disc = step(length(vUV-vec2(.35+.30*slice,.5)),.18);
            gl_FragColor=vec4(mix(c*(.58+.42*grid),vec3(.98),disc),1.);
        }`;
    const own = location.hash !== "#camera";
    const pp = new PostProcess("slice", "sliceReceipt", ["slice"], null, 1, own ? null : camera, undefined, engine);
    if (own) target.addPostProcess(pp);
    let slice = -1;
    target.onBeforeRenderObservable.add(index => {slice = index;});
    pp.onApply = effect => effect.setFloat("slice", slice);
    for (let i=0; !pp.isReady() && i<300; ++i) await new Promise(r=>setTimeout(r,10));
    if (!pp.isReady()) throw Error("Post-process not ready");
    target.render(!own);
    const gl = screen.getContext("webgl2")!;
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    const out = document.createElement("canvas");
    out.width = 2*n; out.height = n;
    const ctx = out.getContext("2d")!;
    const summaries = [];
    for (let i=0; i<2; ++i) {
        gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, target.getInternalTexture()!._hardwareTexture!.underlyingResource,0,i);
        if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE) throw Error("Incomplete slice "+i);
        const px = new Uint8Array(4*n*n);
        gl.readPixels(0,0,n,n,gl.RGBA,gl.UNSIGNED_BYTE,px);
        if(gl.getError()!==gl.NO_ERROR) throw Error("Read failed");
        const img = ctx.createImageData(n,n);
        for(let y=0;y<n;y++) img.data.set(px.subarray((n-1-y)*4*n,(n-y)*4*n),y*4*n);
        ctx.putImageData(img,i*n,0);
        summaries.push(Array.from(px.subarray(0,4)));
    }
    document.body.replaceChildren(out);
    document.body.dataset.result = JSON.stringify(summaries);
    document.body.dataset.png = out.toDataURL();
}
run().catch(e => {document.body.dataset.error=String(e.stack||e);});
