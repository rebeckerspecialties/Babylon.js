# Repository notes

<!-- quest-qualification-handoff -->
## Runtime qualification

Only inline accessor expressions when receiver identity and evaluation count are preserved.

Start with the [shared runtime handoff](https://github.com/rebeckerspecialties/BabylonNative/blob/wgpu/Documentation/QuestRuntimeHandoff.md) for artifact pins and related PRs. For Apple performance comparisons, hold the camera path, resolution, AO, brightness and thermal state fixed; no per-call probes. Separate JS CPU, GPU time and display pacing.

- Implementation: Pin impure getters, overridden accessors and changed receivers; retain unchanged bundle fallback.
- Device: Run moving-camera release A/B on interpreter-bound hardware; check same-frame and multi-view material changes.
