import type { ArcRotateCamera } from "../../Cameras/arcRotateCamera";
import type { ICameraInput } from "../../Cameras/cameraInputsManager";
import { CameraInputTypes } from "../../Cameras/cameraInputsManager";
import { ArcRotateCameraInputsManager } from "../../Cameras/arcRotateCameraInputsManager";
import { Tools } from "../../Misc/tools";

// Module augmentation to abstract orientation inputs from camera.
declare module "../../Cameras/arcRotateCameraInputsManager" {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    export interface ArcRotateCameraInputsManager {
        /**
         * Add orientation input support to the input manager.
         * @returns the current input manager
         */
        addVRDeviceOrientation(): ArcRotateCameraInputsManager;
    }
}

/**
 * Add orientation input support to the input manager.
 * @returns the current input manager
 */
ArcRotateCameraInputsManager.prototype.addVRDeviceOrientation = function (): ArcRotateCameraInputsManager {
    this.add(new ArcRotateCameraVRDeviceOrientationInput());
    return this;
};

/**
 * Manage the device orientation inputs (gyroscope) to control an arc rotate camera.
 * @see https://doc.babylonjs.com/features/featuresDeepDive/cameras/customizingCameraInputs
 */
export class ArcRotateCameraVRDeviceOrientationInput implements ICameraInput<ArcRotateCamera> {
    /**
     * Defines the camera the input is attached to.
     */
    public camera: ArcRotateCamera;

    /**
     * Defines a correction factor applied on the alpha value retrieved from the orientation events.
     */
    public alphaCorrection = 1;

    /**
     * Defines a correction factor applied on the gamma value retrieved from the orientation events.
     */
    public gammaCorrection = 1;

    private _alpha = 0;
    private _gamma = 0;
    private _dirty = false;

    private _deviceOrientationHandler: (evt: DeviceOrientationEvent) => void;

    /**
     * Instantiate a new ArcRotateCameraVRDeviceOrientationInput.
     */
    constructor() {
        this._deviceOrientationHandler = (evt: DeviceOrientationEvent) => this._onOrientationEvent(evt);
    }

    /**
     * Attach the input controls to a specific dom element to get the input from.
     * @param noPreventDefault Defines whether event caught by the controls should call preventdefault() (https://developer.mozilla.org/en-US/docs/Web/API/Event/preventDefault)
     */
    public attachControl(noPreventDefault?: boolean): void {
        noPreventDefault = Tools.BackCompatCameraNoPreventDefault(arguments);

        this.camera.attachControl(noPreventDefault);

        const hostWindow = this.camera.getScene().getEngine().getHostWindow();

        if (hostWindow) {
            // check iOS 13+ support
            if (typeof DeviceOrientationEvent !== "undefined" && typeof (<any>DeviceOrientationEvent).requestPermission === "function") {
                (<any>DeviceOrientationEvent)
                    .requestPermission()
                    // eslint-disable-next-line github/no-then
                    .then((response: string) => {
                        if (response === "granted") {
                            hostWindow.addEventListener("deviceorientation", this._deviceOrientationHandler);
                        } else {
                            Tools.Warn("Permission not granted.");
                        }
                    })
                    // eslint-disable-next-line github/no-then
                    .catch((error: any) => {
                        Tools.Error(error);
                    });
            } else {
                hostWindow.addEventListener("deviceorientation", this._deviceOrientationHandler);
            }
        }
    }

    /**
     * @internal
     */
    public _onOrientationEvent(evt: DeviceOrientationEvent): void {
        if (evt.alpha !== null) {
            this._alpha = (+evt.alpha | 0) * this.alphaCorrection;
        }

        if (evt.gamma !== null) {
            this._gamma = (+evt.gamma | 0) * this.gammaCorrection;
        }
        this._dirty = true;
    }

    /**
     * Update the current camera state depending on the inputs that have been used this frame.
     * This is a dynamically created lambda to avoid the performance penalty of looping for inputs in the render loop.
     */
    public checkInputs(): void {
        if (this._dirty) {
            this._dirty = false;

            if (this._gamma < 0) {
                this._gamma = 180 + this._gamma;
            }

            this.camera.alpha = (((-this._alpha / 180.0) * Math.PI) % Math.PI) * 2;
            this.camera.beta = (this._gamma / 180.0) * Math.PI;
        }
    }

    /**
     * Detach the current controls from the specified dom element.
     */
    public detachControl(): void {
        window.removeEventListener("deviceorientation", this._deviceOrientationHandler);
    }

    /**
     * Gets the class name of the current input.
     * @returns the class name
     */
    public getClassName(): string {
        return "ArcRotateCameraVRDeviceOrientationInput";
    }

    /**
     * Get the friendly name associated with the input class.
     * @returns the input friendly name
     */
    public getSimpleName(): string {
        return "VRDeviceOrientation";
    }
}

(<any>CameraInputTypes)["ArcRotateCameraVRDeviceOrientationInput"] = ArcRotateCameraVRDeviceOrientationInput;
