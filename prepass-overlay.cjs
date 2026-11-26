// Run with Chromium, playwright-core and pngjs. Supply a browser bundle exporting the
// Babylon classes used below as BABYLON, and an output prefix, e.g. "overlay-before".
const { chromium } = require("playwright-core");
const { PNG } = require("pngjs");
const fs = require("node:fs");

(async () => {
    const browser = await chromium.launch({ executablePath: process.env.CHROMIUM, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
    try {
        const page = await browser.newPage();
        await page.goto("about:blank");
        await page.addScriptTag({ path: process.argv[2] });
        const { pixels, clears } = await page.evaluate(async () => {
            const B = window.BABYLON;
            const canvas = document.createElement("canvas");
            canvas.width = canvas.height = 96;
            const gl = canvas.getContext("webgl2");
            const engine = new B.Engine(gl, false);
            const scene = new B.Scene(engine);
            const overlay = new B.Scene(engine);
            const camera = new B.FreeCamera("eye", B.Vector3.Zero(), scene);
            B.Effect.ShadersStore.eyeProofPixelShader = `precision highp float;
                varying vec2 vUV; uniform float eye;
                void main() {
                    vec3 c = mix(vec3(.05,.62,.80), vec3(.92,.38,.10), eye);
                    float grid = mod(floor(vUV.x*8.)+floor(vUV.y*8.),2.);
                    float disc = step(length(vUV-vec2(.35+.30*eye,.5)),.18);
                    gl_FragColor=vec4(mix(c*(.58+.42*grid),vec3(.98),disc),1.);
                }`;
            const pp = new B.PostProcess("pattern", "eyeProof", ["eye"], null, 1, null, undefined, engine);
            const effect = pp.getEffect() ?? await new Promise(r => pp.onEffectCreatedObservable.addOnce(r));
            await effect.whenCompiledAsync();
            const prepass = Object.assign(Object.create(B.PrePassRenderer.prototype), {
                _engine: engine, _scene: scene, _enabled: true, _postProcessesSourceForThisPass: [],
                _currentTarget: {enabled:true, _beforeCompositionPostProcesses:[pp]},
            });
            const pixels = [], clears = [];
            for (const eye of [0,1]) {
                const target = new B.RenderTargetTexture("eye", 96, scene, false);
                camera.outputRenderTarget = target;
                let firstClear = true, phase = "main";
                target.onClearObservable.add(() => {
                    if (firstClear) {
                        firstClear = false;
                        clears.push(phase);
                        engine.clear(new B.Color4(0,0,0,1), true, true, true);
                    }
                });
                pp.onApply = e => e.setFloat("eye",eye);
                prepass._afterDraw();
                phase = "overlay";
                overlay._bindFrameBuffer(camera);
                // A small, solid overlay marker; the rest must retain the main composition.
                engine.scissorClear(12,12,72,6,new B.Color4(1,1,0,1));
                const rgba = new Uint8Array(96*96*4);
                gl.readPixels(0,0,96,96,gl.RGBA,gl.UNSIGNED_BYTE,rgba);
                if (gl.getError() !== gl.NO_ERROR) throw Error("Framebuffer readback failed");
                pixels.push(Array.from(rgba));
            }
            engine.dispose();
            return {pixels, clears};
        });
        const result = new PNG({width:192,height:96});
        for (let y=0;y<96;y++) for(let eye=0;eye<2;eye++) {
            const start=(95-y)*96*4;
            result.data.set(pixels[eye].slice(start,start+96*4), (y*192+eye*96)*4);
        }
        const crop=new PNG({width:256,height:256});
        for(let y=0;y<256;y++) for(let x=0;x<256;x++) {
            const i=((58+(y>>3))*192+80+(x>>3))*4;
            result.data.copy(crop.data,(y*256+x)*4,i,i+4);
        }
        fs.writeFileSync(process.argv[3]+".png", PNG.sync.write(result));
        fs.writeFileSync(process.argv[3]+"-zoom.png", PNG.sync.write(crop));
        console.log("First clear for each eye:",clears, "Main pixels:",pixels.map(p=>p.slice(0,4)));
    } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
