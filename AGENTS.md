# Repository notes

<!-- quest-qualification-handoff -->
## Quest runtime qualification

Render-command recorder support has moved upstream; use the published optional recorder contract.

Start with the [shared Quest handoff](https://github.com/rebeckerspecialties/BabylonNative/blob/wgpu/Documentation/QuestRuntimeHandoff.md) for verified artifact pins, the camera ownership audit, and links to related PRs. Use normal logging, confirm both eyes on the physical display, and verify Home passthrough before and after a single test. Do not use compositor submission count as visual evidence or trigger hosted simulator screenshots for this handoff.

- Implementation: Compare current upstream atomic replay and fallback before carrying remaining patches.
- Device: Exercise with provider absent, present and rejected; compare pixels, call counts and scene timing.
