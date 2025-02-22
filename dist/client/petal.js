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
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.Petal = exports.PETAL_STATS = void 0;
var THREE = __importStar(require("three"));
var types_1 = require("../shared/types");
var GLTFLoader_1 = require("three/examples/jsm/loaders/GLTFLoader");
// Stats for different petal types
exports.PETAL_STATS = (_a = {},
    _a[types_1.PetalType.BASIC] = { maxHealth: 100, cooldownTime: 1000, rarity: types_1.Rarity.COMMON, damage: 10, health: 100, speed: 1 },
    _a[types_1.PetalType.BASIC_UNCOMMON] = { maxHealth: 150, cooldownTime: 800, rarity: types_1.Rarity.UNCOMMON, damage: 15, health: 150, speed: 1.2 },
    _a[types_1.PetalType.BASIC_RARE] = { maxHealth: 225, cooldownTime: 600, rarity: types_1.Rarity.RARE, damage: 22, health: 225, speed: 1.4 },
    _a[types_1.PetalType.TETRAHEDRON] = { maxHealth: 80, cooldownTime: 1200, rarity: types_1.Rarity.COMMON, damage: 15, health: 80, speed: 1.5 },
    _a[types_1.PetalType.TETRAHEDRON_EPIC] = { maxHealth: 270, cooldownTime: 400, rarity: types_1.Rarity.EPIC, damage: 50, health: 270, speed: 2 },
    _a[types_1.PetalType.CUBE] = { maxHealth: 120, cooldownTime: 800, rarity: types_1.Rarity.COMMON, damage: 12, health: 120, speed: 0.8 },
    _a[types_1.PetalType.CUBE_LEGENDARY] = { maxHealth: 600, cooldownTime: 200, rarity: types_1.Rarity.LEGENDARY, damage: 60, health: 600, speed: 1 },
    _a[types_1.PetalType.LEAF] = { maxHealth: 50, cooldownTime: 0, rarity: types_1.Rarity.COMMON, damage: 5, health: 50, speed: 2 },
    _a[types_1.PetalType.STINGER] = { maxHealth: 20, cooldownTime: 1200, rarity: types_1.Rarity.COMMON, damage: 25, health: 20, speed: 2.5 },
    _a[types_1.PetalType.PEA] = { maxHealth: 60, cooldownTime: 1500, rarity: types_1.Rarity.COMMON, damage: 8, health: 60, speed: 1.8 },
    _a);
var Petal = /** @class */ (function () {
    function Petal(scene, parent, index, totalPetals, type) {
        if (type === void 0) { type = types_1.PetalType.BASIC; }
        this.currentRadius = 1.5;
        this.baseRadius = 1.5;
        this.expandedRadius = 3.0;
        this.orbitSpeed = 0.01;
        this.angle = 0;
        this.height = 0.1;
        this.isExpanded = false;
        this.transitionSpeed = 0.1;
        this.onRespawn = null; // Callback for respawn
        this.breakTime = 0;
        this.lastDamageTime = 0;
        this.HEAL_DELAY = 5000; // 5 seconds before healing starts
        this.HEAL_RATE = 0.1; // Heal 10% per second
        this.HEAL_INTERVAL = 100; // Heal every 100ms
        this.lastHealTime = 0;
        this.isBroken = false;
        this.miniPeas = [];
        this.scene = scene;
        this.parent = parent;
        this.index = index;
        this.totalPetals = totalPetals;
        this.type = type;
        // Initialize health and cooldown stats
        var stats = exports.PETAL_STATS[type];
        this.maxHealth = stats.maxHealth;
        this.health = this.maxHealth;
        this.cooldownTime = stats.cooldownTime;
        // Create petal mesh with properties based on type
        this.createMesh();
        // Use same radius and speed for all types
        this.baseRadius = 1.5;
        this.expandedRadius = 3.0;
        this.orbitSpeed = 0.01;
        this.currentRadius = this.baseRadius;
        // Set initial position and angle
        this.angle = (index / totalPetals) * Math.PI * 2;
        this.updatePosition();
        scene.add(this.mesh);
    }
    Petal.prototype.createMesh = function () {
        var _this = this;
        // Create geometry based on rarity
        var geometry;
        var stats = exports.PETAL_STATS[this.type];
        var rarity = stats.rarity;
        // Check if this is a pea type petal
        if (this.type.startsWith('pea')) {
            // Create a temporary sphere while the model loads
            geometry = new THREE.SphereGeometry(0.225, 32, 32);
            var material = new THREE.MeshPhongMaterial({
                color: types_1.RARITY_COLORS[rarity],
                shininess: 30,
                transparent: true,
                opacity: 0.9,
                side: THREE.DoubleSide
            });
            this.mesh = new THREE.Mesh(geometry, material);
            // Load the pea model
            var modelLoader = new GLTFLoader_1.GLTFLoader();
            modelLoader.load('peas.glb', function (gltf) {
                var peaMesh = gltf.scene;
                peaMesh.scale.set(0.15, 0.15, 0.15);
                // Apply rarity color to all meshes in the model
                peaMesh.traverse(function (child) {
                    if (child instanceof THREE.Mesh) {
                        child.material = new THREE.MeshPhongMaterial({
                            color: types_1.RARITY_COLORS[rarity],
                            shininess: 30,
                            transparent: true,
                            opacity: 0.9,
                            side: THREE.DoubleSide
                        });
                    }
                });
                // Replace the temporary sphere with the loaded model
                _this.scene.remove(_this.mesh);
                _this.mesh = peaMesh;
                _this.scene.add(_this.mesh);
                // Add glow effect for higher rarities
                // if (rarity !== Rarity.COMMON) {
                //     const glowMaterial = new THREE.MeshBasicMaterial({
                //         color: RARITY_COLORS[rarity],
                //         transparent: true,
                //         opacity: 0.3,
                //         side: THREE.BackSide
                //     });
                //     peaMesh.traverse((child) => {
                //         if (child instanceof THREE.Mesh) {
                //             const glowMesh = new THREE.Mesh(child.geometry.clone(), glowMaterial);
                //             glowMesh.scale.multiplyScalar(1.2);
                //             child.add(glowMesh);
                //         }
                //     });
                // }
            });
        }
        else {
            // Create geometry based on type
            var geometry_1;
            if (this.type === types_1.PetalType.TETRAHEDRON || this.type === types_1.PetalType.TETRAHEDRON_EPIC) {
                geometry_1 = new THREE.TetrahedronGeometry(0.3);
            }
            else if (this.type === types_1.PetalType.STINGER) {
                geometry_1 = new THREE.ConeGeometry(0.15, 0.4, 16); // Cone shape for stinger
            }
            else if (this.type === types_1.PetalType.LEAF) {
                // Create a custom leaf shape using a custom geometry
                geometry_1 = new THREE.BufferGeometry();
                // Define vertices for a simple leaf shape
                var vertices = new Float32Array([
                    0, 0, 0, // base
                    -0.2, 0.2, 0, // left point
                    0, 0.4, 0, // top point
                    0.2, 0.2, 0, // right point
                ]);
                // Define indices for triangles
                var indices = new Uint16Array([
                    0, 1, 2,
                    0, 2, 3
                ]);
                geometry_1.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
                geometry_1.setIndex(new THREE.BufferAttribute(indices, 1));
                geometry_1.computeVertexNormals();
            }
            else if (this.type === 'basic' || this.type === 'basic_uncommon' || this.type === 'basic_rare') {
                geometry_1 = new THREE.SphereGeometry(0.225, 32, 32);
            }
            else {
                geometry_1 = new THREE.BoxGeometry(0.3, 0.3, 0.3);
            }
            // Create material based on type and rarity
            var material = new THREE.MeshPhongMaterial({
                color: this.getPetalColor(),
                shininess: this.type === types_1.PetalType.LEAF ? 10 : 30,
                side: THREE.DoubleSide,
                transparent: this.type === 'basic' ? false : true, // Basic petals are opaque
                opacity: this.type === 'basic' ? 1.0 : 0.9
            });
            this.mesh = new THREE.Mesh(geometry_1, material);
            // Rotate leaf to be more visible
            if (this.type === types_1.PetalType.LEAF) {
                this.mesh.rotation.x = -Math.PI / 4;
            }
        }
        this.scene.add(this.mesh);
        this.updatePosition();
    };
    Petal.prototype.updateColor = function (color) {
        if (this.mesh) {
            if (this.mesh instanceof THREE.Group) {
                // For models (like pea), update all mesh materials
                this.mesh.traverse(function (child) {
                    if (child instanceof THREE.Mesh && child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(function (mat) {
                                if (mat instanceof THREE.MeshPhongMaterial) {
                                    mat.color.setHex(color);
                                }
                            });
                        }
                        else if (child.material instanceof THREE.MeshPhongMaterial) {
                            child.material.color.setHex(color);
                        }
                    }
                });
            }
            else if (this.mesh instanceof THREE.Mesh) {
                // For basic meshes, update the material directly
                if (Array.isArray(this.mesh.material)) {
                    this.mesh.material.forEach(function (mat) {
                        if (mat instanceof THREE.MeshPhongMaterial) {
                            mat.color.setHex(color);
                        }
                    });
                }
                else if (this.mesh.material instanceof THREE.MeshPhongMaterial) {
                    this.mesh.material.color.setHex(color);
                }
            }
        }
    };
    Petal.prototype.getPetalColor = function () {
        // Only return rarity color if not a basic petal
        if (this.type === types_1.PetalType.BASIC) {
            return 0xffffff; // White for basic petals
        }
        else if (this.type === types_1.PetalType.PEA) {
            return 0x00ff00;
        }
        else if (this.type === types_1.PetalType.LEAF) {
            return 0x00ff00;
        }
        else if (this.type === types_1.PetalType.STINGER) {
            return 0x000000;
        }
        else if (this.type === types_1.PetalType.CUBE) {
            return 0xffff00;
        }
        else if (this.type === types_1.PetalType.TETRAHEDRON) {
            return 0xff0000;
        }
        else if (this.type === types_1.PetalType.TETRAHEDRON_EPIC) {
            return 0xff0000;
        }
        // Use rarity color for other petals
        var stats = exports.PETAL_STATS[this.type];
        return types_1.RARITY_COLORS[stats.rarity];
    };
    Petal.prototype.getType = function () {
        return this.type;
    };
    Petal.prototype.update = function () {
        var _this = this;
        // Check if broken petal should respawn
        if (this.isBroken) {
            if (Date.now() - this.breakTime >= this.cooldownTime) {
                this.respawn();
            }
            else {
                // Keep broken petal hidden
                if (this.mesh)
                    this.mesh.visible = false;
                return;
            }
        }
        this.angle += this.orbitSpeed;
        // Smoothly transition between base and expanded radius
        var targetRadius = this.isExpanded ? this.expandedRadius : this.baseRadius;
        this.currentRadius += (targetRadius - this.currentRadius) * this.transitionSpeed;
        this.updatePosition();
        if (this.mesh)
            this.mesh.visible = true;
        if (this.type === types_1.PetalType.PEA && this.isExpanded && this.miniPeas.length > 0) {
            // Update mini peas positions and make them move outward
            this.miniPeas.forEach(function (pea, index) {
                var angle = (index / 8) * Math.PI * 2 + _this.angle;
                var radius = 0.5 + (Date.now() - _this.breakTime) * 0.001; // Increase radius over time
                pea.position.x = _this.mesh.position.x + Math.cos(angle) * radius;
                pea.position.z = _this.mesh.position.z + Math.sin(angle) * radius;
                pea.position.y = _this.mesh.position.y;
                // Remove peas that have traveled too far
                if (radius > 5) {
                    _this.scene.remove(pea);
                    var index_1 = _this.miniPeas.indexOf(pea);
                    if (index_1 > -1) {
                        _this.miniPeas.splice(index_1, 1);
                    }
                }
            });
        }
    };
    Petal.prototype.expand = function () {
        if (!this.isBroken) {
            this.isExpanded = true;
            if (this.type === types_1.PetalType.PEA) {
                // Break the pea and shoot out mini peas
                this.break();
                // Create and shoot out 8 mini peas in a circle
                var radius = 0.5;
                for (var i = 0; i < 8; i++) {
                    var angle = (i / 8) * Math.PI * 2;
                    var x = this.mesh.position.x + Math.cos(angle) * radius;
                    var z = this.mesh.position.z + Math.sin(angle) * radius;
                    var geometry = new THREE.SphereGeometry(0.1, 16, 16);
                    var material = new THREE.MeshPhongMaterial({
                        color: 0x90EE90,
                        shininess: 30,
                        transparent: false,
                        side: THREE.DoubleSide
                    });
                    var miniPea = new THREE.Mesh(geometry, material);
                    miniPea.position.set(x, this.mesh.position.y, z);
                    this.scene.add(miniPea);
                    this.miniPeas.push(miniPea);
                }
            }
        }
    };
    Petal.prototype.contract = function () {
        var _this = this;
        this.isExpanded = false;
        if (this.type === types_1.PetalType.PEA) {
            // Remove all mini peas
            this.miniPeas.forEach(function (pea) {
                _this.scene.remove(pea);
            });
            this.miniPeas = [];
        }
    };
    Petal.prototype.updatePosition = function () {
        var x = this.parent.position.x + Math.cos(this.angle) * this.currentRadius;
        var z = this.parent.position.z + Math.sin(this.angle) * this.currentRadius;
        var y = this.parent.position.y + this.height;
        this.mesh.position.set(x, y, z);
    };
    Petal.prototype.remove = function (scene) {
        scene.remove(this.mesh);
        if (this.type === types_1.PetalType.PEA) {
            this.miniPeas.forEach(function (pea) {
                scene.remove(pea);
            });
        }
    };
    Petal.prototype.getPosition = function () {
        return this.mesh.position;
    };
    Petal.prototype.takeDamage = function (amount) {
        if (this.isBroken)
            return;
        this.health -= amount;
        if (this.health <= 0) {
            this.break();
        }
    };
    Petal.prototype.break = function () {
        this.isBroken = true;
        this.breakTime = Date.now();
        this.mesh.visible = false;
        this.isExpanded = false;
    };
    Petal.prototype.respawn = function () {
        // Call respawn callback if set
        if (this.onRespawn) {
            this.onRespawn();
        }
        this.isBroken = false;
        this.health = this.maxHealth;
        this.mesh.visible = true;
    };
    // Add method to set respawn callback
    Petal.prototype.setRespawnCallback = function (callback) {
        this.onRespawn = callback;
    };
    Petal.prototype.isBrokenState = function () {
        return this.isBroken;
    };
    Petal.prototype.getHealthPercent = function () {
        return (this.health / this.maxHealth) * 100;
    };
    return Petal;
}());
exports.Petal = Petal;
//# sourceMappingURL=petal.js.map