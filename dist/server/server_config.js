"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServerConfig = void 0;
class ServerConfig {
    constructor() {
        this.currentConfig = {
            ambientLight: {
                color: 0xffffff,
                intensity: 0.7
            },
            directionalLight: {
                color: 0xffffff,
                intensity: 1.0,
                position: {
                    x: 5,
                    y: 10,
                    z: 5
                }
            },
            hemisphereLight: {
                skyColor: 0x87ceeb, // Sky blue
                groundColor: 0x00ff00, // Light green
                intensity: 1.0
            },
            skyColor: 0x87ceeb // Sky blue
        };
    }
    static getInstance() {
        if (!ServerConfig.instance) {
            ServerConfig.instance = new ServerConfig();
        }
        return ServerConfig.instance;
    }
    getCurrentConfig() {
        return this.currentConfig;
    }
    updateConfig(newConfig) {
        var _a;
        // Deep merge the new config with the current config
        this.currentConfig = {
            ...this.currentConfig,
            ambientLight: {
                ...this.currentConfig.ambientLight,
                ...(newConfig.ambientLight || {})
            },
            directionalLight: {
                ...this.currentConfig.directionalLight,
                ...(newConfig.directionalLight || {}),
                position: {
                    ...this.currentConfig.directionalLight.position,
                    ...(((_a = newConfig.directionalLight) === null || _a === void 0 ? void 0 : _a.position) || {})
                }
            },
            hemisphereLight: {
                ...this.currentConfig.hemisphereLight,
                ...(newConfig.hemisphereLight || {})
            },
            skyColor: newConfig.skyColor || this.currentConfig.skyColor
        };
        return this.currentConfig;
    }
    setSkyColor(color) {
        this.currentConfig.skyColor = color;
        this.currentConfig.hemisphereLight.skyColor = color;
    }
    setGroundColor(color) {
        this.currentConfig.hemisphereLight.groundColor = color;
    }
    setLightIntensity(type, intensity) {
        switch (type) {
            case 'ambient':
                this.currentConfig.ambientLight.intensity = intensity;
                break;
            case 'directional':
                this.currentConfig.directionalLight.intensity = intensity;
                break;
            case 'hemisphere':
                this.currentConfig.hemisphereLight.intensity = intensity;
                break;
        }
    }
    setLightColor(type, color) {
        switch (type) {
            case 'ambient':
                this.currentConfig.ambientLight.color = color;
                break;
            case 'directional':
                this.currentConfig.directionalLight.color = color;
                break;
        }
    }
    setDirectionalLightPosition(x, y, z) {
        this.currentConfig.directionalLight.position = { x, y, z };
    }
}
exports.ServerConfig = ServerConfig;
//# sourceMappingURL=server_config.js.map