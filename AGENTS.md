# Repository notes

<!-- quest-qualification-handoff -->
## Runtime qualification

Uniform comparison length caching must preserve zero-length updates and immediate same-frame writes.

Start with the [shared runtime handoff](https://github.com/rebeckerspecialties/BabylonNative/blob/wgpu/Documentation/QuestRuntimeHandoff.md) for artifact pins and related PRs. For Apple performance comparisons, hold the camera path, resolution, AO, brightness and thermal state fixed; no per-call probes. Separate JS CPU, GPU time and display pacing.

- Implementation: Retain regression tests for dirty ranges and mutation; distinguish CPU-side shadow data from depth comparison sampling.
- Device: A/B with identical visuals and report sustained JS CPU, not just FPS.
