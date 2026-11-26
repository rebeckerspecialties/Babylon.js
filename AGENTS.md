# Repository notes

<!-- quest-qualification-handoff -->
## Runtime qualification

Uniform matrix policy is per update, not a frame-wide constant.

Start with the [shared runtime handoff](https://github.com/rebeckerspecialties/BabylonNative/blob/wgpu/Documentation/QuestRuntimeHandoff.md) for artifact pins and related PRs. For Apple performance comparisons, hold the camera path, resolution, AO, brightness and thermal state fixed; no per-call probes. Separate JS CPU, GPU time and display pacing.

- Implementation: Pin same-frame policy changes and preserve behavior when the receiver or matrix changes.
- Device: A/B uninstrumented moving-camera runs and verify both views see updated transforms.
