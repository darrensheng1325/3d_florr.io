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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Enemy = void 0;
var THREE = __importStar(require("three"));
var health_1 = require("./health");
var ladybug_svg_1 = __importDefault(require("./ladybug.svg"));
var GLTFLoader_1 = require("three/examples/jsm/loaders/GLTFLoader");
var types_1 = require("../shared/types");
var ENEMY_STATS = {
    ladybug: {
        health: 50,
        size: types_1.BASE_SIZES.ladybug
    },
    bee: {
        health: 30,
        size: types_1.BASE_SIZES.bee
    },
    centipede: {
        health: 40,
        size: types_1.BASE_SIZES.centipede
    },
    centipede_segment: {
        health: 25,
        size: types_1.BASE_SIZES.centipede_segment
    },
    spider: {
        health: 60,
        size: types_1.BASE_SIZES.spider
    },
    soldier_ant: {
        health: 80,
        size: types_1.BASE_SIZES.soldier_ant
    },
    worker_ant: {
        health: 100, // 2x ladybug health
        size: types_1.BASE_SIZES.worker_ant
    },
    baby_ant: {
        health: 50, // Same as ladybug
        size: types_1.BASE_SIZES.baby_ant
    }
};
// Add name mapping for enemies
var ENEMY_NAMES = {
    ladybug: 'Ladybug',
    bee: 'Bee',
    centipede: 'Centipede',
    centipede_segment: 'Segment',
    spider: 'Spider',
    soldier_ant: 'Soldier Ant',
    worker_ant: 'Worker Ant',
    baby_ant: 'Baby Ant'
};
var Enemy = /** @class */ (function () {
    function Enemy(scene, position, camera, type, id, health, isAggressive, rarity) {
        var _this = this;
        this.type = type;
        this.id = id;
        this.scene = scene;
        this.camera = camera;
        this.health = health;
        this.maxHealth = health;
        this.isAggressive = isAggressive;
        this.rarity = rarity;
        this.position = position;
        this.mesh = new THREE.Mesh(); // Initialize with empty mesh
        // Create description element only for non-segment enemies
        if (type !== 'centipede_segment') {
            this.descriptionElement = document.createElement('div');
            this.descriptionElement.style.position = 'absolute';
            this.descriptionElement.style.textAlign = 'center';
            this.descriptionElement.style.color = '#ffffff';
            this.descriptionElement.style.fontFamily = 'Arial, sans-serif';
            this.descriptionElement.style.fontSize = '8px';
            this.descriptionElement.style.textShadow = '1px 1px 1px rgba(0,0,0,0.5)';
            this.descriptionElement.style.pointerEvents = 'none';
            this.descriptionElement.style.userSelect = 'none';
            this.descriptionElement.style.whiteSpace = 'nowrap';
            this.descriptionElement.style.opacity = '0.8';
            // Set the text content with name and rarity
            var enemyName = ENEMY_NAMES[type];
            var rarityColor = types_1.RARITY_COLORS[rarity];
            this.descriptionElement.innerHTML = "".concat(enemyName, " <span style=\"color: ").concat(rarityColor, "\">[").concat(rarity, "]</span>");
            document.body.appendChild(this.descriptionElement);
        }
        // Calculate base size and rarity multiplier
        var baseSize = ENEMY_STATS[type].size;
        var rarityMultiplier = 1 + (types_1.RARITY_MULTIPLIERS[rarity] - 1) * 0.5; // Same formula as server
        var finalSize = baseSize * rarityMultiplier;
        if (type === 'ladybug') {
            // Create the base mesh with appropriate material based on type
            var geometry = new THREE.SphereGeometry(finalSize, 64, 32);
            // Load the SVG texture with clean mapping
            var texture = new THREE.TextureLoader().load(ladybug_svg_1.default);
            texture.minFilter = THREE.LinearFilter;
            texture.magFilter = THREE.LinearFilter;
            texture.wrapS = THREE.ClampToEdgeWrapping;
            texture.wrapT = THREE.ClampToEdgeWrapping;
            texture.center.set(0.5, 0.5);
            texture.rotation = -Math.PI / 2; // Rotate texture -90 degrees (left)
            var material = new THREE.MeshPhongMaterial({
                map: texture,
                side: THREE.FrontSide,
                shininess: 30,
                specular: 0x333333,
                emissive: 0x000000,
                color: 0xffffff
            });
            this.mesh = new THREE.Mesh(geometry, material);
            this.mesh.rotateY(-Math.PI / 2); // Rotate mesh -90 degrees (left) around Y axis
        }
        else if (type === 'bee' || type === 'spider' || type === 'soldier_ant' || type === 'worker_ant' || type === 'baby_ant') {
            // For bees, spiders, and ants, create an invisible mesh as the base while we load the model
            var geometry = new THREE.BoxGeometry(0.01, 0.01, 0.01);
            var material = new THREE.MeshBasicMaterial({ visible: false });
            this.mesh = new THREE.Mesh(geometry, material);
            // Load the model
            var modelPath = type === 'bee' ? '/bee.glb' :
                type === 'spider' ? '/spider.glb' :
                    type === 'soldier_ant' ? '/soldier_ant.glb' :
                        type === 'worker_ant' ? '/worker_ant.glb' :
                            '/baby_ant.glb';
            Enemy.gltfLoader.load(modelPath, function (gltf) {
                var model = gltf.scene;
                // Apply materials and setup model
                model.traverse(function (child) {
                    if (child instanceof THREE.Mesh) {
                        // For ants, keep original materials
                        if (type === 'bee' || type === 'spider') {
                            var oldMaterial = child.material;
                            var newMaterial = new THREE.MeshBasicMaterial({
                                color: oldMaterial.color,
                                map: oldMaterial.map,
                                side: THREE.DoubleSide,
                                toneMapped: false,
                                fog: false
                            });
                            child.material = newMaterial;
                        }
                    }
                });
                // Scale the model based on final size
                var modelBaseSize = type === 'bee' ? types_1.MODEL_BASE_SIZES.bee :
                    type === 'spider' ? types_1.MODEL_BASE_SIZES.spider :
                        type === 'soldier_ant' ? types_1.MODEL_BASE_SIZES.soldier_ant :
                            type === 'worker_ant' ? types_1.MODEL_BASE_SIZES.worker_ant :
                                types_1.MODEL_BASE_SIZES.baby_ant;
                var modelScale = finalSize / modelBaseSize;
                model.scale.set(modelScale, modelScale, modelScale);
                model.rotation.y = -Math.PI / 2;
                _this.mesh.add(model);
            }, function (progress) {
                console.log("Loading ".concat(type, " model:"), (progress.loaded / progress.total * 100) + '%');
            }, function (error) {
                console.error("Error loading ".concat(type, " model:"), error);
            });
        }
        else if (type === 'centipede' || type === 'centipede_segment') {
            // Create the main sphere for the body segment
            var geometry = new THREE.SphereGeometry(finalSize);
            var material = new THREE.MeshPhongMaterial({
                color: 0x8fc45b,
                shininess: 30,
                specular: 0x333333
            });
            this.mesh = new THREE.Mesh(geometry, material);
            // Add antennae only for the head segment
            if (type === 'centipede') {
                var antennaGeometry = new THREE.CylinderGeometry(0.02 * rarityMultiplier, // Base thickness
                0.01 * rarityMultiplier, // Tip thickness (tapered)
                finalSize * 2.0, // Make them much longer (increased from 1.2)
                8 // segments
                );
                var antennaMaterial = new THREE.MeshPhongMaterial({
                    color: 0x000000, // Pure black
                    shininess: 10,
                    specular: 0x111111
                });
                // Left antenna
                var leftAntenna = new THREE.Mesh(antennaGeometry, antennaMaterial);
                leftAntenna.position.set(-finalSize * 0.3, finalSize * 0.8, 0); // Higher position
                leftAntenna.rotation.z = Math.PI / 3; // Adjust angle
                this.mesh.add(leftAntenna);
                // Right antenna
                var rightAntenna = new THREE.Mesh(antennaGeometry, antennaMaterial);
                rightAntenna.position.set(finalSize * 0.3, finalSize * 0.8, 0); // Higher position
                rightAntenna.rotation.z = -Math.PI / 3; // Adjust angle
                this.mesh.add(rightAntenna);
            }
        }
        this.mesh.position.copy(position);
        this.scene.add(this.mesh);
        // Add health bar with correct max health
        this.healthBar = new health_1.HealthBar(camera, this.mesh, this.maxHealth);
    }
    Enemy.prototype.getBaseColor = function () {
        switch (this.type) {
            case 'ladybug':
                return 0xff0000; // Red
            case 'bee':
                return 0xffff00; // Gold
            case 'spider':
                return 0x4a4a4a; // Dark gray
            default:
                return 0xff0000;
        }
    };
    Enemy.prototype.addDecorativeElements = function () {
        if (this.type === 'bee') {
            // Nothing needed here anymore as we're using the model
        }
    };
    Enemy.prototype.updatePosition = function (position, rotation) {
        this.position.set(position.x, position.y, position.z);
        this.mesh.position.copy(this.position);
        // Apply rotation based on enemy type
        if (this.type === 'ladybug') {
            this.mesh.rotation.y = rotation - Math.PI / 2; // Always rotate ladybugs 90 degrees left
        }
        else {
            this.mesh.rotation.y = rotation;
        }
        // Update health bar position
        if (this.healthBar) {
            this.healthBar.updatePosition();
        }
        // Update description position only if it exists
        if (this.descriptionElement) {
            var screenPosition = this.position.clone();
            screenPosition.y -= ENEMY_STATS[this.type].size * 1.2;
            screenPosition.project(this.camera);
            var x = (screenPosition.x * 0.5 + 0.5) * window.innerWidth;
            var y = (-screenPosition.y * 0.5 + 0.5) * window.innerHeight;
            this.descriptionElement.style.transform = "translate(-50%, -50%)";
            this.descriptionElement.style.left = x + 'px';
            this.descriptionElement.style.top = y + 'px';
            // Hide if behind camera
            if (screenPosition.z > 1) {
                this.descriptionElement.style.display = 'none';
            }
            else {
                this.descriptionElement.style.display = 'block';
            }
        }
    };
    Enemy.prototype.takeDamage = function (amount) {
        this.health = Math.max(0, this.health - amount);
        // Update health bar with current health percentage
        var healthPercentage = (this.health / this.maxHealth) * 100;
        this.healthBar.setHealth(healthPercentage);
    };
    Enemy.prototype.getHealth = function () {
        return this.health;
    };
    Enemy.prototype.getMaxHealth = function () {
        return this.maxHealth;
    };
    Enemy.prototype.remove = function () {
        this.scene.remove(this.mesh);
        this.healthBar.remove();
        // Remove description element if it exists
        if (this.descriptionElement && this.descriptionElement.parentNode) {
            this.descriptionElement.parentNode.removeChild(this.descriptionElement);
        }
    };
    Enemy.prototype.getPosition = function () {
        return this.position;
    };
    Enemy.prototype.getId = function () {
        return this.id;
    };
    Enemy.gltfLoader = new GLTFLoader_1.GLTFLoader();
    return Enemy;
}());
exports.Enemy = Enemy;
//# sourceMappingURL=enemy.js.map