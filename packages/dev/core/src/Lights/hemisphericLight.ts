import { serializeAsColor3, serializeAsVector3 } from "../Misc/decorators";
import type { Nullable } from "../types";
import type { Scene } from "../scene";
import { Matrix, Vector3 } from "../Maths/math.vector";
import { Color3 } from "../Maths/math.color";
import { Node } from "../node";
import type { Effect } from "../Materials/effect";
import { Light } from "./light";
import type { IShadowGenerator } from "./Shadows/shadowGenerator";
import { RegisterClass } from "../Misc/typeStore";

Node.AddNodeConstructor("Light_Type_3", (name, scene) => {
    return () => new HemisphericLight(name, Vector3.Zero(), scene);
});

/**
 * The HemisphericLight simulates the ambient environment light,
 * so the passed direction is the light reflection direction, not the incoming direction.
 */
export class HemisphericLight extends Light {
    /**
     * The groundColor is the light in the opposite direction to the one specified during creation.
     * You can think of the diffuse and specular light as coming from the centre of the object in the given direction and the groundColor light in the opposite direction.
     */
    @serializeAsColor3()
    public groundColor = new Color3(0.0, 0.0, 0.0);

    /**
     * The light reflection direction, not the incoming direction.
     */
    @serializeAsVector3()
    public direction: Vector3;

    /**
     * Creates a HemisphericLight object in the scene according to the passed direction (Vector3).
     * The HemisphericLight simulates the ambient environment light, so the passed direction is the light reflection direction, not the incoming direction.
     * The HemisphericLight can't cast shadows.
     * Documentation : https://doc.babylonjs.com/features/featuresDeepDive/lights/lights_introduction
     * @param name The friendly name of the light
     * @param direction The direction of the light reflection
     * @param scene The scene the light belongs to
     */
    constructor(name: string, direction: Vector3, scene?: Scene) {
        super(name, scene);
        this.direction = direction || Vector3.Up();
    }

    protected _buildUniformLayout(): void {
        this._uniformBuffer.addUniform("vLightData", 4);
        this._uniformBuffer.addUniform("vLightDiffuse", 4);
        this._uniformBuffer.addUniform("vLightSpecular", 4);
        this._uniformBuffer.addUniform("vLightGround", 3);
        this._uniformBuffer.addUniform("shadowsInfo", 3);
        this._uniformBuffer.addUniform("depthValues", 2);
        this._uniformBuffer.create();
    }

    /**
     * Returns the string "HemisphericLight".
     * @returns The class name
     */
    public override getClassName(): string {
        return "HemisphericLight";
    }

    /**
     * Sets the HemisphericLight direction towards the passed target (Vector3).
     * Returns the updated direction.
     * @param target The target the direction should point to
     * @returns The computed direction
     */
    public setDirectionToTarget(target: Vector3): Vector3 {
        this.direction = Vector3.Normalize(target.subtract(Vector3.Zero()));
        return this.direction;
    }

    /**
     * Returns the shadow generator associated to the light.
     * @returns Always null for hemispheric lights because it does not support shadows.
     */
    public override getShadowGenerator(): Nullable<IShadowGenerator> {
        return null;
    }

    /**
     * Sets the passed Effect object with the HemisphericLight normalized direction and color and the passed name (string).
     * @param _effect The effect to update
     * @param lightIndex The index of the light in the effect to update
     * @returns The hemispheric light
     */
    public transferToEffect(_effect: Effect, lightIndex: string): HemisphericLight {
        const normalizeDirection = Vector3.Normalize(this.direction);
        this._uniformBuffer.updateFloat4("vLightData", normalizeDirection.x, normalizeDirection.y, normalizeDirection.z, 0.0, lightIndex);
        this._uniformBuffer.updateColor3("vLightGround", this.groundColor.scale(this.intensity), lightIndex);
        return this;
    }

    public transferToNodeMaterialEffect(effect: Effect, lightDataUniformName: string) {
        const normalizeDirection = Vector3.Normalize(this.direction);
        effect.setFloat3(lightDataUniformName, normalizeDirection.x, normalizeDirection.y, normalizeDirection.z);
        return this;
    }

    /**
     * Computes the world matrix of the node
     * @returns the world matrix
     */
    public override computeWorldMatrix(): Matrix {
        if (!this._worldMatrix) {
            this._worldMatrix = Matrix.Identity();
        }
        return this._worldMatrix;
    }

    /**
     * Returns the integer 3.
     * @returns The light Type id as a constant defines in Light.LIGHTTYPEID_x
     */
    // eslint-disable-next-line @typescript-eslint/naming-convention
    public override getTypeID(): number {
        return Light.LIGHTTYPEID_HEMISPHERICLIGHT;
    }

    /**
     * Prepares the list of defines specific to the light type.
     * @param defines the list of defines
     * @param lightIndex defines the index of the light for the effect
     */
    public prepareLightSpecificDefines(defines: any, lightIndex: number): void {
        defines["HEMILIGHT" + lightIndex] = true;
    }
}

// Register Class Name
RegisterClass("BABYLON.HemisphericLight", HemisphericLight);
