import { Observable } from "../Misc/observable";
import { IsWindowObjectExist } from "../Misc/domManagement";
import type { Nullable } from "../types";
import type { Scene } from "../scene";
import { Xbox360Pad } from "./xboxGamepad";
import { Gamepad, GenericPad } from "./gamepad";
import { DualShockPad } from "./dualShockGamepad";
import { Tools } from "../Misc/tools";
import { AbstractEngine } from "core/Engines/abstractEngine";
/**
 * Manager for handling gamepads
 */
export class GamepadManager {
    private _babylonGamepads: Array<Gamepad> = [];
    private _oneGamepadConnected: boolean = false;

    /** @internal */
    public _isMonitoring: boolean = false;
    private _gamepadEventSupported: boolean;
    private _gamepadSupport?: () => Array<any>;

    /**
     * observable to be triggered when the gamepad controller has been connected
     */
    public onGamepadConnectedObservable: Observable<Gamepad>;

    /**
     * observable to be triggered when the gamepad controller has been disconnected
     */
    public onGamepadDisconnectedObservable = new Observable<Gamepad>();

    private _onGamepadConnectedEvent: Nullable<(evt: any) => void>;
    private _onGamepadDisconnectedEvent: Nullable<(evt: any) => void>;

    /**
     * Initializes the gamepad manager
     * @param _scene BabylonJS scene
     */
    constructor(private _scene?: Scene) {
        if (!IsWindowObjectExist()) {
            this._gamepadEventSupported = false;
        } else {
            this._gamepadEventSupported = "GamepadEvent" in window;
            this._gamepadSupport = navigator && navigator.getGamepads;
        }

        this.onGamepadConnectedObservable = new Observable<Gamepad>((observer) => {
            // This will be used to raise the onGamepadConnected for all gamepads ALREADY connected
            for (const i in this._babylonGamepads) {
                const gamepad = this._babylonGamepads[i];
                if (gamepad && gamepad._isConnected) {
                    this.onGamepadConnectedObservable.notifyObserver(observer, gamepad);
                }
            }
        });

        this._onGamepadConnectedEvent = (evt) => {
            const gamepad = evt.gamepad;

            if (gamepad.index in this._babylonGamepads) {
                if (this._babylonGamepads[gamepad.index].isConnected) {
                    return;
                }
            }

            let newGamepad: Gamepad;

            if (this._babylonGamepads[gamepad.index]) {
                newGamepad = this._babylonGamepads[gamepad.index];
                newGamepad.browserGamepad = gamepad;
                newGamepad._isConnected = true;
            } else {
                newGamepad = this._addNewGamepad(gamepad);
            }
            this.onGamepadConnectedObservable.notifyObservers(newGamepad);
            this._startMonitoringGamepads();
        };

        this._onGamepadDisconnectedEvent = (evt) => {
            const gamepad = evt.gamepad;

            // Remove the gamepad from the list of gamepads to monitor.
            for (const i in this._babylonGamepads) {
                if (this._babylonGamepads[i].index === gamepad.index) {
                    const disconnectedGamepad = this._babylonGamepads[i];
                    disconnectedGamepad._isConnected = false;

                    this.onGamepadDisconnectedObservable.notifyObservers(disconnectedGamepad);
                    if (disconnectedGamepad.dispose) {
                        disconnectedGamepad.dispose();
                    }
                    break;
                }
            }
        };

        if (this._gamepadSupport) {
            //first add already-connected gamepads
            this._updateGamepadObjects();
            if (this._babylonGamepads.length) {
                this._startMonitoringGamepads();
            }
            // Checking if the gamepad connected event is supported (like in Firefox)
            if (this._gamepadEventSupported) {
                const hostWindow = this._scene ? this._scene.getEngine().getHostWindow() : window;

                if (hostWindow) {
                    hostWindow.addEventListener("gamepadconnected", this._onGamepadConnectedEvent, false);
                    hostWindow.addEventListener("gamepaddisconnected", this._onGamepadDisconnectedEvent, false);
                }
            } else {
                this._startMonitoringGamepads();
            }
        }
    }

    /**
     * The gamepads in the game pad manager
     */
    public get gamepads(): Gamepad[] {
        return this._babylonGamepads;
    }

    /**
     * Get the gamepad controllers based on type
     * @param type The type of gamepad controller
     * @returns Nullable gamepad
     */
    public getGamepadByType(type: number = Gamepad.XBOX): Nullable<Gamepad> {
        for (const gamepad of this._babylonGamepads) {
            if (gamepad && gamepad.type === type) {
                return gamepad;
            }
        }

        return null;
    }

    /**
     * Disposes the gamepad manager
     */
    public dispose() {
        if (this._gamepadEventSupported) {
            if (this._onGamepadConnectedEvent) {
                window.removeEventListener("gamepadconnected", this._onGamepadConnectedEvent);
            }

            if (this._onGamepadDisconnectedEvent) {
                window.removeEventListener("gamepaddisconnected", this._onGamepadDisconnectedEvent);
            }
            this._onGamepadConnectedEvent = null;
            this._onGamepadDisconnectedEvent = null;
        }

        for (const gamepad of this._babylonGamepads) {
            gamepad.dispose();
        }

        this.onGamepadConnectedObservable.clear();
        this.onGamepadDisconnectedObservable.clear();

        this._oneGamepadConnected = false;
        this._stopMonitoringGamepads();
        this._babylonGamepads = [];
    }

    private _addNewGamepad(gamepad: any): Gamepad {
        if (!this._oneGamepadConnected) {
            this._oneGamepadConnected = true;
        }

        let newGamepad;
        const dualShock: boolean = (<string>gamepad.id).search("054c") !== -1 && (<string>gamepad.id).search("0ce6") === -1;
        const xboxOne: boolean = (<string>gamepad.id).search("Xbox One") !== -1;
        if (
            xboxOne ||
            (<string>gamepad.id).search("Xbox 360") !== -1 ||
            (<string>gamepad.id).search("xinput") !== -1 ||
            ((<string>gamepad.id).search("045e") !== -1 && (<string>gamepad.id).search("Surface Dock") === -1)
        ) {
            // make sure the Surface Dock Extender is not detected as an xbox controller
            newGamepad = new Xbox360Pad(gamepad.id, gamepad.index, gamepad, xboxOne);
        } else if (dualShock) {
            newGamepad = new DualShockPad(gamepad.id, gamepad.index, gamepad);
        } else {
            newGamepad = new GenericPad(gamepad.id, gamepad.index, gamepad);
        }
        this._babylonGamepads[newGamepad.index] = newGamepad;
        return newGamepad;
    }

    private _startMonitoringGamepads() {
        if (!this._isMonitoring) {
            this._isMonitoring = true;
            //back-comp
            this._checkGamepadsStatus();
        }
    }

    private _stopMonitoringGamepads() {
        this._isMonitoring = false;
    }

    private _loggedErrors: number[];

    /** @internal */
    public _checkGamepadsStatus() {
        // Hack to be compatible Chrome
        this._updateGamepadObjects();

        for (const i in this._babylonGamepads) {
            const gamepad = this._babylonGamepads[i];
            if (!gamepad || !gamepad.isConnected) {
                continue;
            }
            try {
                gamepad.update();
            } catch {
                if (this._loggedErrors.indexOf(gamepad.index) === -1) {
                    Tools.Warn(`Error updating gamepad ${gamepad.id}`);
                    this._loggedErrors.push(gamepad.index);
                }
            }
        }

        if (this._isMonitoring) {
            AbstractEngine.QueueNewFrame(() => {
                this._checkGamepadsStatus();
            });
        }
    }

    // This function is called only on Chrome, which does not properly support
    // connection/disconnection events and forces you to recopy again the gamepad object
    private _updateGamepadObjects() {
        const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
        for (let i = 0; i < gamepads.length; i++) {
            const gamepad = gamepads[i];
            if (gamepad) {
                if (!this._babylonGamepads[gamepad.index]) {
                    const newGamepad = this._addNewGamepad(gamepad);
                    this.onGamepadConnectedObservable.notifyObservers(newGamepad);
                } else {
                    // Forced to copy again this object for Chrome for unknown reason
                    this._babylonGamepads[i].browserGamepad = gamepad;

                    if (!this._babylonGamepads[i].isConnected) {
                        this._babylonGamepads[i]._isConnected = true;
                        this.onGamepadConnectedObservable.notifyObservers(this._babylonGamepads[i]);
                    }
                }
            }
        }
    }
}
