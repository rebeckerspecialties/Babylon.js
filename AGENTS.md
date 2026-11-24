# Repository notes

<!-- quest-qualification-handoff -->
## Quest runtime qualification

Thin-instance buffers affect release animation cost, not static menu fill rate.

Start with the [shared Quest handoff](https://github.com/rebeckerspecialties/BabylonNative/blob/wgpu/Documentation/QuestRuntimeHandoff.md) for verified artifact pins, the camera ownership audit, and links to related PRs. Use normal logging, confirm both eyes on the physical display, and verify Home passthrough before and after a single test. Do not use compositor submission count as visual evidence or trigger hosted simulator screenshots for this handoff.

- Implementation: Compare against retained/partial writes in webapp #1322; preserve instance picking, bounds and update order.
- Device: Measure the first releases and the same year-two checkpoint in both eyes, including buffer churn.
