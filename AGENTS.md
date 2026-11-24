# Repository notes

<!-- quest-qualification-handoff -->
## Runtime qualification

Reserve command storage without changing opcode layout, order or fallback semantics.

Start with the [shared runtime handoff](https://github.com/rebeckerspecialties/BabylonNative/blob/wgpu/Documentation/QuestRuntimeHandoff.md) for artifact pins and related PRs. For Apple performance comparisons, hold the camera path, resolution, AO, brightness and thermal state fixed; no per-call probes. Separate JS CPU, GPU time and display pacing.

- Implementation: Keep exact word counts, capacity growth and rejected pass behavior covered.
- Device: Compare recorded/direct pixel results and bridge traversals at identical draw counts.
