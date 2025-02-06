"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Petal = void 0;
const THREE = __importStar(require("three"));
const inventory_1 = require("./inventory");
const types_1 = require("../shared/types");
// Stats for different petal types
const PETAL_STATS = {
    'basic': {
        maxHealth: 50,
        cooldownTime: 3000, // 3 seconds
        rarity: types_1.Rarity.COMMON
    },
    'basic_uncommon': {
        maxHealth: 75,
        cooldownTime: 2800,
        rarity: types_1.Rarity.UNCOMMON
    },
    'basic_rare': {
        maxHealth: 112,
        cooldownTime: 2600,
        rarity: types_1.Rarity.RARE
    },
    'tetrahedron': {
        maxHealth: 100,
        cooldownTime: 5000, // 5 seconds
        rarity: types_1.Rarity.COMMON
    },
    'tetrahedron_epic': {
        maxHealth: 337,
        cooldownTime: 4000,
        rarity: types_1.Rarity.EPIC
    },
    'cube': {
        maxHealth: 75,
        cooldownTime: 4000, // 4 seconds
        rarity: types_1.Rarity.COMMON
    },
    'cube_legendary': {
        maxHealth: 375,
        cooldownTime: 3000,
        rarity: types_1.Rarity.LEGENDARY
    }
};
class Petal {
    constructor(scene, parent, slotIndex, totalSlots, type = inventory_1.PetalType.BASIC, id = crypto.randomUUID(), initialHealth = 100) {
        this.health = 100;
        this.maxHealth = 100;
        this.broken = false;
        this.respawnCallback = null;
        this.currentRadius = 1.5;
        this.baseRadius = 1.5;
        this.expandedRadius = 3.0;
        this.orbitSpeed = 0.01;
        this.isExpanded = false;
        this.transitionSpeed = 0.1;
        this.breakTime = 0;
        this.cooldownTime = 5000; // 5 seconds cooldown
        this.scene = scene;
        this.parent = parent;
        this.slotIndex = slotIndex;
        this.totalSlots = totalSlots;
        this.type = type;
        this.id = id;
        this.health = initialHealth;
        this.maxHealth = 100;
        this.angle = (slotIndex / totalSlots) * Math.PI * 2;
        // Create mesh based on petal type
        let geometry;
        let material;
        switch (type) {
            case inventory_1.PetalType.TETRAHEDRON:
            case inventory_1.PetalType.TETRAHEDRON_EPIC:
                geometry = new THREE.TetrahedronGeometry(0.4);
                material = new THREE.MeshPhongMaterial({
                    color: type === inventory_1.PetalType.TETRAHEDRON_EPIC ? 0x9b4dca : 0xff0000,
                    shininess: 30,
                    transparent: true,
                    opacity: 0.9
                });
                break;
            case inventory_1.PetalType.CUBE:
            case inventory_1.PetalType.CUBE_LEGENDARY:
                geometry = new THREE.BoxGeometry(0.4, 0.4, 0.4);
                material = new THREE.MeshPhongMaterial({
                    color: type === inventory_1.PetalType.CUBE_LEGENDARY ? 0xffd700 : 0x0000ff,
                    shininess: 30,
                    transparent: true,
                    opacity: 0.9
                });
                break;
            default:
                geometry = new THREE.SphereGeometry(0.4, 32, 32);
                material = new THREE.MeshPhongMaterial({
                    color: this.getRarityColor(type),
                    shininess: 30,
                    transparent: true,
                    opacity: 0.9
                });
        }
        this.mesh = new THREE.Mesh(geometry, material);
        this.scene.add(this.mesh);
        this.updatePosition();
    }
    getRarityColor(type) {
        switch (type) {
            case inventory_1.PetalType.BASIC_UNCOMMON:
                return 0x00ff00;
            case inventory_1.PetalType.BASIC_RARE:
                return 0x0000ff;
            default:
                return 0xffffff;
        }
    }
    getId() {
        return this.id;
    }
    getHealth() {
        return this.health;
    }
    getHealthPercent() {
        return (this.health / this.maxHealth) * 100;
    }
    getType() {
        return this.type;
    }
    takeDamage(amount) {
        this.health = Math.max(0, this.health - amount);
        if (this.health === 0 && !this.broken) {
            this.broken = true;
            this.breakTime = Date.now();
            if (this.respawnCallback) {
                setTimeout(this.respawnCallback, this.cooldownTime);
            }
        }
    }
    isBrokenState() {
        return this.broken;
    }
    setRespawnCallback(callback) {
        this.respawnCallback = callback;
    }
    update() {
        if (this.broken) {
            if (Date.now() - this.breakTime >= this.cooldownTime) {
                if (this.respawnCallback) {
                    this.respawnCallback();
                }
            }
            return;
        }
        // Update angle for orbit
        this.angle += this.orbitSpeed;
        if (this.angle > Math.PI * 2) {
            this.angle -= Math.PI * 2;
        }
        // Update radius for expansion/contraction
        if (this.isExpanded && this.currentRadius < this.expandedRadius) {
            this.currentRadius += this.transitionSpeed;
        }
        else if (!this.isExpanded && this.currentRadius > this.baseRadius) {
            this.currentRadius -= this.transitionSpeed;
        }
        this.updatePosition();
    }
    expand() {
        if (!this.broken) {
            this.isExpanded = true;
        }
    }
    contract() {
        this.isExpanded = false;
    }
    remove(scene) {
        scene.remove(this.mesh);
    }
    getPosition() {
        return this.mesh.position;
    }
    updatePosition() {
        const parentPosition = new THREE.Vector3();
        this.parent.getWorldPosition(parentPosition);
        this.mesh.position.x = parentPosition.x + Math.cos(this.angle) * this.currentRadius;
        this.mesh.position.y = parentPosition.y;
        this.mesh.position.z = parentPosition.z + Math.sin(this.angle) * this.currentRadius;
    }
}
exports.Petal = Petal;
//# sourceMappingURL=petal.js.map