import { NullEngine } from "core/Engines/nullEngine";
import { CreateBox } from "core/Meshes/Builders/boxBuilder";
import { Scene } from "core/scene";
import { BuildKhrTriggerZoneGraph, CreateKhrTriggerZoneTemplate } from "flow-graph-editor/khrTriggerZoneTemplate";
import { CreateKHRInteractivityDocument } from "loaders/glTF/2.0/Extensions/KHR_interactivity/pure";
import { describe, expect, it } from "vitest";

describe("KHR trigger-zone authoring", () => {
    it("builds a strict sphere-zone graph with edge-triggered cue changes", () => {
        const graph = BuildKhrTriggerZoneGraph({ zone: 4, tracked: 2, cue: 7 }, 1.5);
        const model = CreateKHRInteractivityDocument(graph, new Set(["KHR_node_visibility"]), 8);
        expect(model.diagnostics).toEqual([]);
        expect(model.graphs[0].diagnostics).toEqual([]);
        expect(model.graphs[0].valid).toBe(true);
        expect(graph.graphs[0].variables).toEqual([{ name: "insideZone", type: 0, value: [false] }]);
        expect(graph.graphs[0].nodes.filter((node: any) => node.configuration?.pointer).map((node: any) => node.configuration.pointer.value[0])).toEqual([
            "/nodes/4/translation",
            "/nodes/2/translation",
            "/nodes/7/extensions/KHR_node_visibility/visible",
            "/nodes/7/extensions/KHR_node_visibility/visible",
        ]);
    });

    it("rejects shared roles, unrelated coordinate spaces, and invalid radii", () => {
        const engine = new NullEngine();
        const scene = new Scene(engine);
        const zone = CreateBox("zone", {}, scene);
        const tracked = CreateBox("tracked", {}, scene);
        const cue = CreateBox("cue", {}, scene);
        expect(() => CreateKhrTriggerZoneTemplate({ zone, tracked: zone, cue }, 1)).toThrow("different");
        tracked.parent = zone;
        expect(() => CreateKhrTriggerZoneTemplate({ zone, tracked, cue }, 1)).toThrow("same parent");
        tracked.parent = null;
        expect(() => CreateKhrTriggerZoneTemplate({ zone, tracked, cue }, 0)).toThrow("positive finite");
        expect(() => BuildKhrTriggerZoneGraph({ zone: 0, tracked: 1, cue: 2 }, Number.NaN)).toThrow("positive finite");
        scene.dispose();
        engine.dispose();
    });
});
