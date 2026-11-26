# Post-process array-layer readback

The fixture renders into a two-slice RGBA8 array texture with WebGL2. Slice
zero should be teal; slice one should be orange. Each half of the PNG is
read from its own framebuffer attachment. Transparent pixels are untouched.

Before: Babylon.js `8bee37ae4b`. After: `862669dc53`.
Both the RTT's own post-process and the camera's post-process were tested.
The zooms show the same 48 by 32 source pixels at (104, 48), enlarged 8x
with nearest-neighbor sampling.

To repeat on either revision, generate the core shaders as for a normal
Babylon build. Bundle `array-render.ts` with esbuild, aliasing `core` to the
absolute path to `packages/dev/core/src`. Load it in an empty HTML body in
a WebGL2 browser. Use URL fragment `#own` or `#camera`. The page displays
the readback and sets `document.body.dataset.png` and `.result` on success,
or `.error` on failure. The recorded renderer was Chromium with SwiftShader.
