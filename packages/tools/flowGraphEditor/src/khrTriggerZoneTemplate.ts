import { type TransformNode } from "core/Meshes/transformNode";
import { type Node } from "core/node";

/** glTF nodes used by a spherical trigger zone. */
export interface IKhrTriggerZoneNodes<T> {
    /** The center of the zone. */
    zone: T;
    /** The point whose translation is tracked. */
    tracked: T;
    /** A cue shown only while the tracked point is inside. */
    cue: T;
}

/**
 * Validates the shared parent space used by the sphere calculation.
 * @param nodes scene nodes assigned to the zone roles
 * @param radius zone radius in the nodes' shared parent space
 * @param checkRuntimeParent whether to compare Babylon parents; imported GLBs use source glTF parents instead
 */
export function ValidateKhrTriggerZoneNodes(nodes: IKhrTriggerZoneNodes<TransformNode>, radius: number, checkRuntimeParent = true): void {
    if (!Number.isFinite(radius) || radius <= 0) {
        throw new Error("The zone radius must be a positive finite number.");
    }
    if (new Set(Object.values(nodes)).size !== 3) {
        throw new Error("Choose three different nodes for the trigger zone.");
    }
    if (nodes.zone.getScene() !== nodes.tracked.getScene() || nodes.zone.getScene() !== nodes.cue.getScene()) {
        throw new Error("Trigger-zone nodes must belong to the same scene.");
    }
    if (checkRuntimeParent && nodes.zone.parent !== nodes.tracked.parent) {
        throw new Error("The zone and tracked point must have the same parent coordinate space.");
    }
    if (!nodes.zone.isEnabled() || !nodes.tracked.isEnabled() || !nodes.cue.isEnabled()) {
        throw new Error("Trigger-zone nodes must be enabled.");
    }
}

/**
 * Builds a portable KHR_interactivity graph using sibling node translations.
 * The cue changes only when the tracked point crosses the sphere boundary.
 * @param indices glTF node indices for the zone roles
 * @param radius zone radius in the nodes' shared parent space
 * @returns the KHR_interactivity extension
 */
export function BuildKhrTriggerZoneGraph(indices: IKhrTriggerZoneNodes<number>, radius: number) {
    if (!Number.isFinite(radius) || radius <= 0) {
        throw new Error("The zone radius must be a positive finite number.");
    }
    const nodeIndices = Object.values(indices);
    if (nodeIndices.some((index) => !Number.isSafeInteger(index) || index < 0) || new Set(nodeIndices).size !== 3) {
        throw new Error("Trigger-zone roles must resolve to three different glTF nodes.");
    }
    return {
        graph: 0,
        graphs: [
            {
                name: "Sphere trigger zone",
                types: [{ signature: "bool" }, { signature: "float" }, { signature: "float3" }],
                variables: [{ name: "insideZone", type: 0, value: [false] }],
                declarations: [
                    { op: "pointer/get" },
                    { op: "math/sub" },
                    { op: "math/length" },
                    { op: "math/le" },
                    { op: "variable/get" },
                    { op: "math/xor" },
                    { op: "event/onTick" },
                    { op: "flow/branch" },
                    { op: "flow/sequence" },
                    { op: "variable/set" },
                    { op: "pointer/set" },
                    { op: "event/onStart" },
                ],
                nodes: [
                    { declaration: 0, configuration: { pointer: { value: [`/nodes/${indices.zone}/translation`] }, type: { value: [2] } } },
                    { declaration: 0, configuration: { pointer: { value: [`/nodes/${indices.tracked}/translation`] }, type: { value: [2] } } },
                    { declaration: 1, values: { a: { node: 1 }, b: { node: 0 } } },
                    { declaration: 2, values: { a: { node: 2 } } },
                    { declaration: 3, values: { a: { node: 3 }, b: { type: 1, value: [radius] } } },
                    { declaration: 4, configuration: { variable: { value: [0] } } },
                    { declaration: 5, values: { a: { node: 4 }, b: { node: 5 } } },
                    { declaration: 6, flows: { out: { node: 8, socket: "in" } } },
                    { declaration: 7, values: { condition: { node: 6 } }, flows: { true: { node: 9, socket: "in" } } },
                    { declaration: 8, flows: { [String(0)]: { node: 10, socket: "in" }, [String(1)]: { node: 11, socket: "in" } } },
                    { declaration: 9, configuration: { variables: { value: [0] } }, values: { [String(0)]: { node: 4 } } },
                    {
                        declaration: 10,
                        configuration: { pointer: { value: [`/nodes/${indices.cue}/extensions/KHR_node_visibility/visible`] }, type: { value: [0] } },
                        values: { value: { node: 4 } },
                    },
                    { declaration: 11, flows: { out: { node: 13, socket: "in" } } },
                    { declaration: 8, flows: { [String(0)]: { node: 14, socket: "in" }, [String(1)]: { node: 15, socket: "in" } } },
                    { declaration: 9, configuration: { variables: { value: [0] } }, values: { [String(0)]: { type: 0, value: [false] } } },
                    {
                        declaration: 10,
                        configuration: { pointer: { value: [`/nodes/${indices.cue}/extensions/KHR_node_visibility/visible`] }, type: { value: [0] } },
                        values: { value: { type: 0, value: [false] } },
                    },
                ],
            },
        ],
    };
}

interface ITriggerZoneExportContext {
    getNodeIndex(node: Node): number | undefined;
    setNodeExtension(nodeIndex: number, extensionName: string, value: unknown): void;
}

/**
 * Creates a KHR_interactivity provider for a new scene's sphere zone.
 * @param nodes scene nodes assigned to the zone roles
 * @param radius zone radius in the nodes' shared parent space
 * @returns a KHR_interactivity export provider
 */
export function CreateKhrTriggerZoneTemplate(nodes: IKhrTriggerZoneNodes<TransformNode>, radius: number) {
    ValidateKhrTriggerZoneNodes(nodes, radius);
    return {
        required: true,
        additionalExtensionsUsed: ["KHR_node_visibility"],
        additionalExtensionsRequired: ["KHR_node_visibility"],
        build(context: ITriggerZoneExportContext) {
            const indices = {
                zone: context.getNodeIndex(nodes.zone),
                tracked: context.getNodeIndex(nodes.tracked),
                cue: context.getNodeIndex(nodes.cue),
            };
            if (Object.values(indices).some((index) => index === undefined)) {
                throw new Error("All trigger-zone nodes must be exported as glTF nodes.");
            }
            const graph = BuildKhrTriggerZoneGraph(indices as IKhrTriggerZoneNodes<number>, radius);
            context.setNodeExtension(indices.cue!, "KHR_node_visibility", { visible: false });
            return graph;
        },
    };
}
