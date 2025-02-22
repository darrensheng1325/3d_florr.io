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
exports.Item = exports.ItemType = void 0;
var THREE = __importStar(require("three"));
var GLTFLoader_1 = require("three/examples/jsm/loaders/GLTFLoader");
var ItemType;
(function (ItemType) {
    ItemType["TETRAHEDRON"] = "tetrahedron";
    ItemType["CUBE"] = "cube";
    ItemType["LEAF"] = "leaf";
    ItemType["STINGER"] = "stinger";
    ItemType["PEA"] = "pea";
})(ItemType || (exports.ItemType = ItemType = {}));
var Item = /** @class */ (function () {
    function Item(scene, position, type, id) {
        var _this = this;
        this.mesh = null;
        this.scene = scene;
        this.id = id;
        this.type = type;
        this.startTime = Date.now();
        this.floatOffset = Math.random() * Math.PI * 2; // Random starting phase
        if (type === ItemType.LEAF) {
            // Load the leaf model if not already loaded
            if (!Item.leafModel) {
                Item.modelLoader.load('leaf.glb', function (gltf) {
                    Item.leafModel = gltf.scene;
                    _this.initLeafModel(position);
                });
            }
            else {
                this.initLeafModel(position);
            }
        }
        else if (type === ItemType.PEA) {
            // Load the pea model if not already loaded
            if (!Item.peaModel) {
                Item.modelLoader.load('peas.glb', function (gltf) {
                    Item.peaModel = gltf.scene;
                    _this.initPeaModel(position);
                });
            }
            else {
                this.initPeaModel(position);
            }
        }
        else {
            // Create geometry based on type
            var geometry = void 0;
            if (type === ItemType.TETRAHEDRON) {
                geometry = new THREE.TetrahedronGeometry(0.3);
            }
            else if (type === ItemType.STINGER) {
                geometry = new THREE.ConeGeometry(0.15, 0.4, 16); // Cone shape for stinger
            }
            else {
                geometry = new THREE.BoxGeometry(0.3, 0.3, 0.3);
            }
            // Create material based on type
            var material = new THREE.MeshPhongMaterial({
                color: this.getItemColor(),
                shininess: 30,
                transparent: type !== ItemType.STINGER // Make stinger opaque
            });
            this.mesh = new THREE.Mesh(geometry, material);
            this.mesh.position.copy(position);
            this.scene.add(this.mesh);
        }
    }
    Item.prototype.getItemColor = function () {
        switch (this.type) {
            case ItemType.TETRAHEDRON:
                return 0xff0000; // Red
            case ItemType.CUBE:
                return 0x0000ff; // Blue
            case ItemType.STINGER:
                return 0x000000; // Black for stinger
            case ItemType.PEA:
                return 0x90EE90; // Light green for pea
            default:
                return 0xffffff; // White for unknown types
        }
    };
    Item.prototype.initLeafModel = function (position) {
        if (Item.leafModel) {
            this.mesh = Item.leafModel.clone();
            this.mesh.position.copy(position);
            this.mesh.scale.set(0.3, 0.3, 0.3); // Adjust scale as needed
            this.scene.add(this.mesh);
        }
    };
    Item.prototype.initPeaModel = function (position) {
        var _this = this;
        if (Item.peaModel) {
            this.mesh = Item.peaModel.clone();
            this.mesh.position.copy(position);
            this.mesh.scale.set(0.15, 0.15, 0.15);
            // Add green tint to all meshes in the model
            this.mesh.traverse(function (child) {
                if (child instanceof THREE.Mesh && child.material) {
                    // Create new material for each mesh to avoid sharing
                    child.material = new THREE.MeshPhongMaterial({
                        color: 0x90EE90, // Light green
                        shininess: 30,
                        transparent: false,
                        side: THREE.DoubleSide
                    });
                }
            });
            this.scene.add(this.mesh);
        }
        else {
            // Load the pea model if not already loaded
            Item.modelLoader.load('peas.glb', function (gltf) {
                Item.peaModel = gltf.scene;
                // Apply green tint to the cached model
                Item.peaModel.traverse(function (child) {
                    if (child instanceof THREE.Mesh && child.material) {
                        child.material = new THREE.MeshPhongMaterial({
                            color: 0x90EE90,
                            shininess: 30,
                            transparent: false,
                            side: THREE.DoubleSide
                        });
                    }
                });
                _this.initPeaModel(position);
            });
        }
    };
    Item.prototype.update = function () {
        // Make item float and rotate
        var time = (Date.now() - this.startTime) * 0.001;
        if (this.mesh) {
            this.mesh.position.y = 0.3 + Math.sin(time * 2 + this.floatOffset) * 0.1;
            this.mesh.rotation.y = time * 2;
        }
    };
    Item.prototype.remove = function () {
        if (this.mesh) {
            this.scene.remove(this.mesh);
        }
    };
    Item.prototype.getPosition = function () {
        return this.mesh ? this.mesh.position : new THREE.Vector3();
    };
    Item.prototype.getId = function () {
        return this.id;
    };
    Item.prototype.getType = function () {
        return this.type;
    };
    Item.leafModel = null;
    Item.peaModel = null;
    Item.modelLoader = new GLTFLoader_1.GLTFLoader();
    return Item;
}());
exports.Item = Item;
//# sourceMappingURL=item.js.map