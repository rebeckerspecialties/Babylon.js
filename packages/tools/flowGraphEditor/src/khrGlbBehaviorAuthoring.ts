import { type Node } from "core/node";
import { BuildKhrSelectionRevealGraph } from "./khrSelectionRevealTemplate";
import { BuildKhrTwoStepProcedureGraph, type IKhrTwoStepProcedureNodes } from "./khrTwoStepProcedureTemplate";
import { BuildKhrTriggerZoneGraph, type IKhrTriggerZoneNodes } from "./khrTriggerZoneTemplate";

const GlbMagic = 0x46546c67;
const JsonChunk = 0x4e4f534a;

function _IsRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === "object" && !Array.isArray(value);
}

/** The glTF fields needed while adding a behavior to an existing GLB. Other fields are retained. */
export interface IGlbDocument {
    /** glTF asset metadata. */
    asset?: { version?: string };
    /** Source nodes in stable glTF index order. */
    nodes?: Array<{ children?: number[]; extensions?: Record<string, unknown>; [key: string]: unknown }>;
    /** A graph takes control of every glTF animation in the asset. */
    animations?: unknown;
    /** Root glTF extensions. */
    extensions?: Record<string, unknown>;
    /** Declared glTF extensions. */
    extensionsUsed?: string[];
    /** Required glTF extensions. */
    extensionsRequired?: string[];
    [key: string]: unknown;
}

function _ReadGlb(bytes: Uint8Array): { document: IGlbDocument; suffixOffset: number } {
    if (bytes.byteLength < 20) {
        throw new Error("GLB header or JSON chunk header is incomplete.");
    }
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (view.getUint32(0, true) !== GlbMagic || view.getUint32(4, true) !== 2) {
        throw new Error("Expected a version 2 GLB header.");
    }
    if (view.getUint32(8, true) !== bytes.byteLength) {
        throw new Error("GLB header length does not match the file length.");
    }
    const jsonLength = view.getUint32(12, true);
    if (view.getUint32(16, true) !== JsonChunk) {
        throw new Error("The first GLB chunk must be a JSON chunk.");
    }
    if (jsonLength === 0 || jsonLength % 4 !== 0 || jsonLength > bytes.byteLength - 20) {
        throw new Error("The GLB JSON chunk length is invalid.");
    }
    const suffixOffset = 20 + jsonLength;
    let offset = suffixOffset;
    while (offset < bytes.byteLength) {
        if (bytes.byteLength - offset < 8) {
            throw new Error("The GLB has an incomplete chunk header.");
        }
        const length = view.getUint32(offset, true);
        if (length % 4 !== 0 || length > bytes.byteLength - offset - 8) {
            throw new Error("The GLB has an invalid chunk length.");
        }
        offset += 8 + length;
    }
    let document: IGlbDocument;
    try {
        document = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(20, suffixOffset))) as IGlbDocument;
    } catch {
        throw new Error("The GLB JSON chunk is invalid.");
    }
    if (!document || typeof document !== "object" || Array.isArray(document) || document.asset?.version !== "2.0") {
        throw new Error("The GLB must contain a glTF 2.0 document.");
    }
    return { document, suffixOffset };
}

function _WriteGlb(bytes: Uint8Array, document: IGlbDocument, suffixOffset: number): Uint8Array {
    const encoded = new TextEncoder().encode(JSON.stringify(document));
    const paddedLength = Math.ceil(encoded.length / 4) * 4;
    const suffix = bytes.subarray(suffixOffset);
    const totalLength = 20 + paddedLength + suffix.byteLength;
    if (totalLength > 0xffffffff) {
        throw new Error("The authored GLB exceeds the format's length limit.");
    }
    const result = new Uint8Array(totalLength);
    result.set(bytes.subarray(0, 20));
    const view = new DataView(result.buffer);
    view.setUint32(8, totalLength, true);
    view.setUint32(12, paddedLength, true);
    result.fill(0x20, 20, 20 + paddedLength);
    result.set(encoded, 20);
    result.set(suffix, 20 + paddedLength);
    return result;
}

/**
 * Reads the source glTF document without loading or serializing its scene.
 * @param bytes original GLB bytes
 * @returns parsed glTF document
 */
export function ReadGlbDocument(bytes: Uint8Array): IGlbDocument {
    return _ReadGlb(bytes).document;
}

/**
 * Resolves parent indices from the source glTF hierarchy, independent of Babylon primitive wrappers.
 * @param document parsed glTF document
 * @returns the parent index for each node, or undefined for root nodes
 */
export function GetGlbNodeParents(document: IGlbDocument): Array<number | undefined> {
    const nodes = document.nodes;
    if (!Array.isArray(nodes)) {
        throw new Error("The source GLB has no glTF nodes.");
    }
    const parents = new Array<number | undefined>(nodes.length);
    for (const [parent, node] of nodes.entries()) {
        if (!node || typeof node !== "object" || Array.isArray(node) || (node.children !== undefined && !Array.isArray(node.children))) {
            throw new Error("The source GLB has malformed node hierarchy.");
        }
        for (const child of node.children ?? []) {
            if (!Number.isSafeInteger(child) || child < 0 || child >= nodes.length || parents[child] !== undefined) {
                throw new Error("The source GLB has malformed node hierarchy.");
            }
            parents[child] = parent;
        }
    }
    return parents;
}

/**
 * Finds the glTF node index recorded by the loader, including on a primitive's parent.
 * @param node loaded Babylon node
 * @param nodeCount number of nodes in the source glTF document
 * @returns the source glTF node index, if unambiguous
 */
export function GetGlbNodeIndex(node: Node, nodeCount: number): number | undefined {
    for (let current: Node | null = node; current; current = current.parent) {
        const pointers = (current as Node & { _internalMetadata?: { gltf?: { pointers?: unknown } } })._internalMetadata?.gltf?.pointers;
        if (!Array.isArray(pointers)) {
            continue;
        }
        const indices = new Set<number>();
        for (const pointer of pointers) {
            const match = typeof pointer === "string" ? /^\/nodes\/(0|[1-9]\d*)$/.exec(pointer) : null;
            if (match) {
                indices.add(Number(match[1]));
            }
        }
        if (indices.size > 0) {
            const index = indices.values().next().value as number;
            return indices.size === 1 && Number.isSafeInteger(index) && index < nodeCount ? index : undefined;
        }
    }
    return undefined;
}

function _PatchKhrSelectionRevealDocument(document: IGlbDocument, triggerIndex: number, revealIndex: number): void {
    if (document.animations !== undefined && (!Array.isArray(document.animations) || document.animations.length > 0)) {
        throw new Error("Adding a behavior graph would stop the source GLB's animations from playing automatically; animated GLBs need explicit animation behavior.");
    }
    const nodes = document.nodes;
    if (!Array.isArray(nodes)) {
        throw new Error("The source GLB has no glTF nodes.");
    }
    if (
        nodes.some(
            (node) =>
                !node ||
                typeof node !== "object" ||
                Array.isArray(node) ||
                (node.extensions !== undefined && (!node.extensions || typeof node.extensions !== "object" || Array.isArray(node.extensions)))
        ) ||
        (document.extensions !== undefined && (!document.extensions || typeof document.extensions !== "object" || Array.isArray(document.extensions))) ||
        (document.extensionsUsed !== undefined && (!Array.isArray(document.extensionsUsed) || document.extensionsUsed.some((name) => typeof name !== "string"))) ||
        (document.extensionsRequired !== undefined && (!Array.isArray(document.extensionsRequired) || document.extensionsRequired.some((name) => typeof name !== "string")))
    ) {
        throw new Error("The source GLB has malformed nodes or extension declarations.");
    }
    if (
        !Number.isSafeInteger(triggerIndex) ||
        !Number.isSafeInteger(revealIndex) ||
        triggerIndex < 0 ||
        revealIndex < 0 ||
        triggerIndex >= nodes.length ||
        revealIndex >= nodes.length
    ) {
        throw new Error("A selected glTF node index is outside the source document.");
    }
    if (triggerIndex === revealIndex) {
        throw new Error("Select two different glTF nodes.");
    }
    const visited = new Set<number>();
    const isAncestor = (index: number): boolean => {
        if (index === triggerIndex) {
            return true;
        }
        if (visited.has(index)) {
            return false;
        }
        visited.add(index);
        return Array.isArray(nodes[index]?.children) && nodes[index].children!.some((child) => Number.isInteger(child) && child >= 0 && child < nodes.length && isAncestor(child));
    };
    if (isAncestor(revealIndex)) {
        throw new Error("The reveal glTF node cannot be an ancestor of the trigger.");
    }
    if (
        (document.extensions &&
            (Object.prototype.hasOwnProperty.call(document.extensions, "KHR_interactivity") || Object.prototype.hasOwnProperty.call(document.extensions, "BABYLON_flow_graph"))) ||
        document.extensionsUsed?.includes("KHR_interactivity") ||
        document.extensionsUsed?.includes("BABYLON_flow_graph")
    ) {
        throw new Error("The source GLB already has a behavior graph.");
    }
    const triggerSelectability = nodes[triggerIndex].extensions?.KHR_node_selectability;
    if (triggerSelectability !== undefined && (!_IsRecord(triggerSelectability) || (triggerSelectability.selectable !== undefined && triggerSelectability.selectable !== true))) {
        throw new Error("The trigger selectability extension is malformed or disables selection.");
    }
    const revealVisibility = nodes[revealIndex].extensions?.KHR_node_visibility;
    if (revealVisibility !== undefined && (!_IsRecord(revealVisibility) || (revealVisibility.visible !== undefined && typeof revealVisibility.visible !== "boolean"))) {
        throw new Error("The reveal visibility extension is malformed.");
    }
    const parents = Array.from({ length: nodes.length }, () => new Array<number>());
    for (const [index, node] of nodes.entries()) {
        if (Array.isArray(node.children)) {
            for (const child of node.children) {
                if (Number.isInteger(child) && child >= 0 && child < nodes.length) {
                    parents[child].push(index);
                }
            }
        }
    }
    const pending = [triggerIndex];
    const checked = new Set<number>();
    while (pending.length > 0) {
        const index = pending.pop()!;
        if (checked.has(index)) {
            continue;
        }
        checked.add(index);
        const ancestorSelectability = nodes[index].extensions?.KHR_node_selectability;
        if (
            ancestorSelectability !== undefined &&
            (!_IsRecord(ancestorSelectability) ||
                (ancestorSelectability.selectable !== undefined && typeof ancestorSelectability.selectable !== "boolean") ||
                ancestorSelectability.selectable === false)
        ) {
            throw new Error("The trigger or an ancestor disables selectability.");
        }
        const ancestorVisibility = nodes[index].extensions?.KHR_node_visibility;
        if (
            ancestorVisibility !== undefined &&
            (!_IsRecord(ancestorVisibility) ||
                (ancestorVisibility.visible !== undefined && typeof ancestorVisibility.visible !== "boolean") ||
                ancestorVisibility.visible === false)
        ) {
            throw new Error("The trigger or an ancestor disables visibility.");
        }
        for (const parent of parents[index]) {
            pending.push(parent);
        }
    }
    document.extensions ??= {};
    document.extensions.KHR_interactivity = BuildKhrSelectionRevealGraph(triggerIndex, revealIndex);
    nodes[triggerIndex].extensions ??= {};
    nodes[triggerIndex].extensions.KHR_node_selectability ??= { selectable: true };
    nodes[revealIndex].extensions ??= {};
    if (_IsRecord(revealVisibility)) {
        revealVisibility.visible = false;
    } else {
        nodes[revealIndex].extensions.KHR_node_visibility = { visible: false };
    }
    for (const name of ["KHR_interactivity", "KHR_node_selectability", "KHR_node_visibility"]) {
        document.extensionsUsed ??= [];
        document.extensionsRequired ??= [];
        if (!document.extensionsUsed.includes(name)) {
            document.extensionsUsed.push(name);
        }
        if (!document.extensionsRequired.includes(name)) {
            document.extensionsRequired.push(name);
        }
    }
}

/**
 * Adds only the behavior extension fields; the BIN and subsequent chunks stay byte-identical.
 * @param bytes original GLB bytes
 * @param triggerIndex source glTF trigger node index
 * @param revealIndex source glTF reveal node index
 * @returns the authored GLB bytes
 */
export function PatchKhrSelectionRevealGlb(bytes: Uint8Array, triggerIndex: number, revealIndex: number): Uint8Array {
    const { document, suffixOffset } = _ReadGlb(bytes);
    _PatchKhrSelectionRevealDocument(document, triggerIndex, revealIndex);
    return _WriteGlb(bytes, document, suffixOffset);
}

/**
 * Adds an ordered procedure to a source GLB without serializing its scene.
 * @param bytes original GLB bytes
 * @param indices stable source glTF node indices for the procedure roles
 * @returns the authored GLB bytes
 */
export function PatchKhrTwoStepProcedureGlb(bytes: Uint8Array, indices: IKhrTwoStepProcedureNodes<number>): Uint8Array {
    const { document, suffixOffset } = _ReadGlb(bytes);
    const nodes = document.nodes;
    if (!Array.isArray(nodes)) {
        throw new Error("The source GLB has no glTF nodes.");
    }
    const roleIndices = [indices.first, indices.second, indices.nextCue, indices.completionCue, indices.reset];
    if (roleIndices.some((index) => !Number.isSafeInteger(index) || index < 0 || index >= nodes.length)) {
        throw new Error("A procedure glTF node index is outside the source document.");
    }
    if (new Set(roleIndices).size !== roleIndices.length) {
        throw new Error("Choose five different glTF nodes for the procedure.");
    }
    const parents = Array.from({ length: nodes.length }, () => new Array<number>());
    for (const [index, node] of nodes.entries()) {
        if (!node || typeof node !== "object" || Array.isArray(node) || (node.children !== undefined && !Array.isArray(node.children))) {
            throw new Error("The source GLB has malformed node hierarchy.");
        }
        for (const child of node.children ?? []) {
            if (!Number.isInteger(child) || child < 0 || child >= nodes.length) {
                throw new Error("The source GLB has malformed node hierarchy.");
            }
            parents[child].push(index);
        }
    }
    const reaches = (start: number, target: number): boolean => {
        const pending = [start];
        const visited = new Set<number>();
        while (pending.length > 0) {
            const index = pending.pop()!;
            if (index === target) {
                return true;
            }
            if (visited.has(index)) {
                continue;
            }
            visited.add(index);
            pending.push(...(nodes[index].children ?? []));
        }
        return false;
    };
    for (let i = 0; i < roleIndices.length; i++) {
        for (let j = i + 1; j < roleIndices.length; j++) {
            if (reaches(roleIndices[i], roleIndices[j]) || reaches(roleIndices[j], roleIndices[i])) {
                throw new Error("Procedure glTF nodes cannot be an ancestor or descendant of each other.");
            }
        }
    }
    for (const control of [indices.first, indices.second, indices.reset]) {
        const pending = [control];
        const visited = new Set<number>();
        while (pending.length > 0) {
            const index = pending.pop()!;
            if (visited.has(index)) {
                continue;
            }
            visited.add(index);
            const selectability = nodes[index].extensions?.KHR_node_selectability;
            if (selectability !== undefined && (!_IsRecord(selectability) || (selectability.selectable !== undefined && selectability.selectable !== true))) {
                throw new Error("A procedure control or ancestor disables selectability.");
            }
            const visibility = nodes[index].extensions?.KHR_node_visibility;
            if (visibility !== undefined && (!_IsRecord(visibility) || (visibility.visible !== undefined && visibility.visible !== true))) {
                throw new Error("A procedure control or ancestor disables visibility.");
            }
            pending.push(...parents[index]);
        }
    }
    for (const cue of [indices.nextCue, indices.completionCue]) {
        const visibility = nodes[cue].extensions?.KHR_node_visibility;
        if (visibility !== undefined && (!_IsRecord(visibility) || (visibility.visible !== undefined && typeof visibility.visible !== "boolean"))) {
            throw new Error("A procedure cue has malformed visibility.");
        }
        const pending = [...parents[cue]];
        const visited = new Set<number>();
        while (pending.length > 0) {
            const index = pending.pop()!;
            if (visited.has(index)) {
                continue;
            }
            visited.add(index);
            const ancestorVisibility = nodes[index].extensions?.KHR_node_visibility;
            if (ancestorVisibility !== undefined && (!_IsRecord(ancestorVisibility) || (ancestorVisibility.visible !== undefined && ancestorVisibility.visible !== true))) {
                throw new Error("A procedure cue ancestor disables visibility.");
            }
            pending.push(...parents[index]);
        }
    }

    // Reuse the selection template's graph and animation guards, then replace its graph.
    _PatchKhrSelectionRevealDocument(document, indices.first, indices.completionCue);
    document.extensions!.KHR_interactivity = BuildKhrTwoStepProcedureGraph(indices);
    for (const control of [indices.second, indices.reset]) {
        document.nodes![control].extensions ??= {};
        document.nodes![control].extensions!.KHR_node_selectability ??= { selectable: true };
    }
    document.nodes![indices.nextCue].extensions ??= {};
    const nextCueVisibility = document.nodes![indices.nextCue].extensions!.KHR_node_visibility;
    if (_IsRecord(nextCueVisibility)) {
        nextCueVisibility.visible = false;
    } else {
        document.nodes![indices.nextCue].extensions!.KHR_node_visibility = { visible: false };
    }
    return _WriteGlb(bytes, document, suffixOffset);
}

/**
 * Adds a spherical zone graph using two sibling node translations.
 * @param bytes original GLB bytes
 * @param indices stable source glTF node indices for the zone roles
 * @param radius zone radius in the shared parent coordinate space
 * @returns the authored GLB bytes
 */
export function PatchKhrTriggerZoneGlb(bytes: Uint8Array, indices: IKhrTriggerZoneNodes<number>, radius: number): Uint8Array {
    const { document, suffixOffset } = _ReadGlb(bytes);
    const graph = BuildKhrTriggerZoneGraph(indices, radius);
    if (document.animations !== undefined && (!Array.isArray(document.animations) || document.animations.length > 0)) {
        throw new Error("Adding a behavior graph would stop the source GLB's animations from playing automatically; animated GLBs need explicit animation behavior.");
    }
    const nodes = document.nodes;
    if (!Array.isArray(nodes) || Object.values(indices).some((index) => index >= nodes.length)) {
        throw new Error("A trigger-zone glTF node index is outside the source document.");
    }
    if (
        nodes.some((node) => !node || typeof node !== "object" || Array.isArray(node) || (node.extensions !== undefined && !_IsRecord(node.extensions))) ||
        (document.extensions !== undefined && !_IsRecord(document.extensions)) ||
        (document.extensionsUsed !== undefined && (!Array.isArray(document.extensionsUsed) || document.extensionsUsed.some((name) => typeof name !== "string"))) ||
        (document.extensionsRequired !== undefined && (!Array.isArray(document.extensionsRequired) || document.extensionsRequired.some((name) => typeof name !== "string")))
    ) {
        throw new Error("The source GLB has malformed nodes or extension declarations.");
    }
    if (
        document.extensions?.KHR_interactivity !== undefined ||
        document.extensions?.BABYLON_flow_graph !== undefined ||
        document.extensionsUsed?.includes("KHR_interactivity") ||
        document.extensionsUsed?.includes("BABYLON_flow_graph")
    ) {
        throw new Error("The source GLB already has a behavior graph.");
    }
    const parents = GetGlbNodeParents(document);
    if (parents[indices.zone] !== parents[indices.tracked]) {
        throw new Error("The zone and tracked glTF nodes must have the same parent coordinate space.");
    }
    if (nodes[indices.zone].matrix !== undefined || nodes[indices.tracked].matrix !== undefined) {
        throw new Error("The zone and tracked glTF nodes must use translation properties, not matrix transforms.");
    }
    const cueVisibility = nodes[indices.cue].extensions?.KHR_node_visibility;
    if (cueVisibility !== undefined && (!_IsRecord(cueVisibility) || (cueVisibility.visible !== undefined && typeof cueVisibility.visible !== "boolean"))) {
        throw new Error("The trigger-zone cue has malformed visibility.");
    }
    const visited = new Set<number>();
    for (let parent = parents[indices.cue]; parent !== undefined; parent = parents[parent]) {
        if (visited.has(parent)) {
            throw new Error("The source GLB has malformed node hierarchy.");
        }
        visited.add(parent);
        const visibility = nodes[parent].extensions?.KHR_node_visibility;
        if (visibility !== undefined && (!_IsRecord(visibility) || (visibility.visible !== undefined && visibility.visible !== true))) {
            throw new Error("A trigger-zone cue ancestor disables visibility.");
        }
    }
    document.extensions ??= {};
    document.extensions.KHR_interactivity = graph;
    nodes[indices.cue].extensions ??= {};
    if (_IsRecord(cueVisibility)) {
        cueVisibility.visible = false;
    } else {
        nodes[indices.cue].extensions!.KHR_node_visibility = { visible: false };
    }
    for (const extension of ["KHR_interactivity", "KHR_node_visibility"]) {
        document.extensionsUsed ??= [];
        document.extensionsRequired ??= [];
        if (!document.extensionsUsed.includes(extension)) {
            document.extensionsUsed.push(extension);
        }
        if (!document.extensionsRequired.includes(extension)) {
            document.extensionsRequired.push(extension);
        }
    }
    return _WriteGlb(bytes, document, suffixOffset);
}
