# Repository notes

<!-- quest-qualification-handoff -->
## Runtime qualification

Versioned material UBOs must remain correct across views and same-frame changes.

Start with the [shared runtime handoff](https://github.com/rebeckerspecialties/BabylonNative/blob/wgpu/Documentation/QuestRuntimeHandoff.md) for artifact pins and related PRs. For Apple performance comparisons, hold the camera path, resolution, AO, brightness and thermal state fixed; no per-call probes. Separate JS CPU, GPU time and display pacing.

- Implementation: Cover invalidation, effect layout differences and disposal; do not share per-view or per-mesh state as material state.
- Device: Compare moving car reflections, sky, under-car shading and stereo materials under same-frame mutation.
