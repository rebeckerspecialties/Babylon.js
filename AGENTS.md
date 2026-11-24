# Repository notes

<!-- quest-qualification-handoff -->
## Quest runtime qualification

Fast snapshot rendering group clears must preserve visible group ordering.

Start with the [shared Quest handoff](https://github.com/rebeckerspecialties/BabylonNative/blob/wgpu/Documentation/QuestRuntimeHandoff.md) for verified artifact pins, the camera ownership audit, and links to related PRs. Use normal logging, confirm both eyes on the physical display, and verify Home passthrough before and after a single test. Do not use compositor submission count as visual evidence or trigger hosted simulator screenshots for this handoff.

- Implementation: Verify replay and non-snapshot clear behavior against the same recorded clear flags.
- Device: Test dialog/cube transparency and spectator output with snapshot rendering on and off.
