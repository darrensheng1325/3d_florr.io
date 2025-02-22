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
exports.Game = void 0;
var THREE = __importStar(require("three"));
var socket_io_client_1 = require("socket.io-client");
var player_svg_1 = __importDefault(require("./player.svg"));
var petal_1 = require("./petal");
var health_1 = require("./health");
var enemy_1 = require("./enemy");
var inventory_1 = require("./inventory");
var waves_1 = require("./waves");
var item_1 = require("./item");
var types_1 = require("../shared/types");
var crafting_1 = require("./crafting");
var server_config_1 = require("../server/server_config");
var GLTFLoader_1 = require("three/examples/jsm/loaders/GLTFLoader");
var account_1 = require("./account");
var MAP_SIZE = 15; // Match server's map size
var Game = /** @class */ (function () {
    function Game() {
        this.socket = null;
        this.inventorySlotRenderers = [];
        this.inventorySlotScenes = [];
        this.inventorySlotCameras = [];
        this.inventorySlotContainers = [];
        this.currentWave = 1;
        this.enemiesKilled = 0;
        this.totalXP = 0;
        this.ENEMIES_PER_WAVE = 20;
        this.XP_PER_WAVE = 1000;
        this.cameraRotation = 0;
        this.playerInventories = new Map();
        this.enemies = new Map();
        this.playerHealthBars = new Map();
        this.playerVelocities = new Map();
        this.isGameStarted = false;
        this.isInventoryOpen = false;
        this.collectedPetals = [];
        this.craftingSystem = null;
        this.items = new Map();
        this.pressedKeys = new Set();
        this.inventoryMenu = null;
        this.inventoryPreviews = new Map();
        this.isSettingsOpen = false;
        this.settings = {
            rarityTinting: true
        };
        this.craftingMenu = null;
        this.isCraftingOpen = false;
        this.settingsMenu = null;
        this.moveSpeed = 0.05;
        this.mapSize = 15;
        this.lastFrameTime = 0;
        this.targetFPS = 60;
        this.frameInterval = 1000 / 60;
        this.deathScreen = null;
        this.lastHealTime = 0;
        this.HEAL_INTERVAL = 1000; // Heal every second
        this.HEAL_AMOUNT = 5; // Heal 5 health per tick
        this.reconnectAttempts = 0;
        this.MAX_RECONNECT_ATTEMPTS = 3;
        this.RECONNECT_DELAY = 2000; // 2 seconds
        this.accountManager = new account_1.AccountManager();
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer();
        this.players = new Map();
        this.textureLoader = new THREE.TextureLoader();
        this.waveUI = new waves_1.WaveUI();
        // Initialize lights with default values (will be updated from server)
        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        this.directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
        this.hemisphereLight = new THREE.HemisphereLight(0x9BE2FF, 0x00ff2d, 0.8);
        // Initialize grid helper with default values (will be updated from server)
        this.gridHelper = new THREE.GridHelper(30, 30, 0x038f21, 0x038f21);
        // Create title canvas overlay
        this.titleCanvas = document.createElement('canvas');
        this.titleCanvas.style.position = 'absolute';
        this.titleCanvas.style.top = '0';
        this.titleCanvas.style.left = '0';
        this.titleCanvas.style.pointerEvents = 'none';
        document.body.appendChild(this.titleCanvas);
        var ctx = this.titleCanvas.getContext('2d');
        if (!ctx)
            throw new Error('Could not get 2D context');
        this.titleCtx = ctx;
        // Create inventory container
        var inventoryContainer = document.createElement('div');
        inventoryContainer.style.position = 'absolute';
        inventoryContainer.style.bottom = '20px';
        inventoryContainer.style.left = '50%';
        inventoryContainer.style.transform = 'translateX(-50%)';
        inventoryContainer.style.display = 'flex';
        inventoryContainer.style.gap = '10px';
        inventoryContainer.style.justifyContent = 'center';
        document.body.appendChild(inventoryContainer);
        // Create inventory slots
        for (var i = 0; i < 5; i++) {
            // Create container for this slot
            var slotContainer = document.createElement('div');
            slotContainer.style.width = '80px';
            slotContainer.style.height = '80px';
            slotContainer.style.position = 'relative';
            slotContainer.style.border = '2px solid black';
            slotContainer.style.borderRadius = '10px';
            inventoryContainer.appendChild(slotContainer);
            this.inventorySlotContainers.push(slotContainer);
            // Create renderer
            var renderer = new THREE.WebGLRenderer({ alpha: true });
            renderer.setSize(80, 80);
            renderer.setClearColor(0x000000, 0);
            slotContainer.appendChild(renderer.domElement);
            this.inventorySlotRenderers.push(renderer);
            // Create scene
            var scene = new THREE.Scene();
            scene.background = null;
            this.inventorySlotScenes.push(scene);
            // Create camera
            var camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
            camera.position.set(0, 0, 3);
            camera.lookAt(0, 0, 0);
            this.inventorySlotCameras.push(camera);
            // Add lighting
            var ambientLight = new THREE.AmbientLight(0xffffff, 1);
            scene.add(ambientLight);
            var pointLight = new THREE.PointLight(0xffffff, 1.0);
            pointLight.position.set(2, 2, 2);
            scene.add(pointLight);
            // Add slot number
            var numberDiv = document.createElement('div');
            numberDiv.style.position = 'absolute';
            numberDiv.style.bottom = '5px';
            numberDiv.style.right = '5px';
            numberDiv.style.color = 'black';
            numberDiv.style.fontWeight = 'bold';
            numberDiv.style.fontSize = '16px';
            numberDiv.textContent = (i + 1).toString();
            slotContainer.appendChild(numberDiv);
        }
        // Create ground plane with MeshPhongMaterial
        var groundGeometry = new THREE.PlaneGeometry(MAP_SIZE * 2, MAP_SIZE * 2);
        var groundMaterial = new THREE.MeshPhongMaterial({
            color: server_config_1.ServerConfig.getInstance().getCurrentConfig().hemisphereLight.groundColor,
            side: THREE.DoubleSide,
            shininess: 0 // Make it matte
        });
        this.ground = new THREE.Mesh(groundGeometry, groundMaterial);
        this.ground.rotation.x = -Math.PI / 2;
        this.ground.position.y = 0;
        this.scene.add(this.ground);
        this.init();
        // Connect to server immediately for spectating
        this.socket = (0, socket_io_client_1.io)('/', {
            query: {
                accountId: this.accountManager.getAccountId()
            }
        });
        this.setupSpectatorEvents();
        // Setup wave events
        this.setupWaveEvents();
        // Setup server connection monitoring
        this.setupConnectionMonitoring();
        // Create settings button
        this.createSettingsButton();
    }
    Game.prototype.determinePetalDrop = function (enemyRarity) {
        // 50% chance to drop a petal
        if (Math.random() > 0.5) {
            return { shouldDrop: false, dropRarity: types_1.Rarity.COMMON, petalType: types_1.PetalType.BASIC };
        }
        var dropRarity;
        if (enemyRarity === types_1.Rarity.COMMON) {
            // Common mobs have 30% chance to drop uncommon
            dropRarity = Math.random() < 0.3 ? types_1.Rarity.UNCOMMON : types_1.Rarity.COMMON;
        }
        else {
            // For other rarities: 30% chance to drop same rarity, 70% chance to drop one rarity below
            var dropSameRarity = Math.random() < 0.3;
            dropRarity = dropSameRarity ? enemyRarity : Object.values(types_1.Rarity)[Object.values(types_1.Rarity).indexOf(enemyRarity) - 1];
        }
        // Determine petal type based on rarity
        var possibleTypes = [];
        switch (dropRarity) {
            case types_1.Rarity.LEGENDARY:
                possibleTypes = [types_1.PetalType.CUBE_LEGENDARY];
                break;
            case types_1.Rarity.EPIC:
                possibleTypes = [types_1.PetalType.TETRAHEDRON_EPIC];
                break;
            case types_1.Rarity.RARE:
                possibleTypes = [types_1.PetalType.BASIC_RARE];
                break;
            case types_1.Rarity.UNCOMMON:
                possibleTypes = [types_1.PetalType.BASIC_UNCOMMON];
                break;
            default:
                possibleTypes = [types_1.PetalType.BASIC, types_1.PetalType.TETRAHEDRON, types_1.PetalType.CUBE];
        }
        var randomType = possibleTypes[Math.floor(Math.random() * possibleTypes.length)];
        return { shouldDrop: true, dropRarity: dropRarity, petalType: randomType };
    };
    Game.prototype.setupEnemyEvents = function () {
        var _this = this;
        if (!this.socket)
            return;
        // Handle enemies
        this.socket.on('enemySpawned', function (data) {
            var enemy = new enemy_1.Enemy(_this.scene, new THREE.Vector3(data.position.x, data.position.y, data.position.z), _this.camera, data.type, data.id, data.health, data.isAggressive, data.rarity);
            _this.enemies.set(data.id, enemy);
        });
        this.socket.on('enemyMoved', function (data) {
            var enemy = _this.enemies.get(data.id);
            if (enemy) {
                enemy.updatePosition(data.position, data.rotation);
            }
        });
        this.socket.on('enemyDied', function (data) {
            var _a;
            var enemy = _this.enemies.get(data.enemyId);
            if (enemy) {
                enemy.remove();
                _this.enemies.delete(data.enemyId);
                _this.enemiesKilled++;
                _this.waveUI.update(_this.currentWave, _this.enemiesKilled, _this.totalXP);
                // Handle petal drops - skip for worker ants
                if (data.enemyType !== 'worker_ant') {
                    var dropResult = _this.determinePetalDrop(data.enemyRarity);
                    if (dropResult.shouldDrop) {
                        // Find first empty inventory slot
                        var inventory = _this.playerInventories.get(((_a = _this.socket) === null || _a === void 0 ? void 0 : _a.id) || '');
                        if (inventory) {
                            var slots = inventory.getSlots();
                            var emptySlotIndex = slots.findIndex(function (slot) { return slot.petal === null; });
                            if (emptySlotIndex !== -1) {
                                inventory.addPetal(dropResult.petalType, emptySlotIndex);
                            }
                        }
                    }
                }
                // Handle item drops
                if (data.enemyType === 'worker_ant') {
                    // Worker ants always drop leaves
                    var itemId = "item_".concat(data.enemyId);
                    var item = new item_1.Item(_this.scene, new THREE.Vector3(data.position.x, data.position.y, data.position.z), item_1.ItemType.LEAF, itemId);
                    _this.items.set(itemId, item);
                }
                else if (data.itemType) {
                    // Handle other enemy drops
                    var itemId = "item_".concat(data.enemyId);
                    var item = new item_1.Item(_this.scene, new THREE.Vector3(data.position.x, data.position.y, data.position.z), data.itemType, itemId);
                    _this.items.set(itemId, item);
                }
            }
        });
    };
    Game.prototype.setupSpectatorEvents = function () {
        var _this = this;
        if (!this.socket)
            return;
        // Handle other players
        this.socket.on('playerJoined', function (data) {
            if (!_this.isGameStarted) { // Only handle other players while spectating
                _this.createPlayer(data.id);
            }
        });
        this.socket.on('playerLeft', function (playerId) {
            var player = _this.players.get(playerId);
            if (player) {
                _this.scene.remove(player);
                _this.players.delete(playerId);
            }
        });
        this.socket.on('playerMoved', function (data) {
            var player = _this.players.get(data.id);
            if (player) {
                player.position.set(data.position.x, data.position.y, data.position.z);
            }
        });
        // Setup enemy events
        this.setupEnemyEvents();
    };
    Game.prototype.createTitleScreen = function () {
        var _this = this;
        // Set camera for spectating
        this.camera.position.set(0, 15, 0);
        this.camera.lookAt(0, 0, 0);
        // Start rotating camera for spectating
        var angle = 0;
        // Add space key listener
        document.addEventListener('keydown', function (event) {
            if (event.code === 'Space' && !_this.isGameStarted) {
                _this.startGame();
            }
        });
        // Update canvas size
        this.onWindowResize();
        // Animate title screen
        var animate = function () {
            if (!_this.isGameStarted) {
                requestAnimationFrame(animate);
                // Rotate camera around the scene
                angle += 0.001;
                var radius = 15;
                _this.camera.position.x = Math.cos(angle) * radius;
                _this.camera.position.z = Math.sin(angle) * radius;
                _this.camera.lookAt(0, 0, 0);
                // Render game scene
                _this.renderer.render(_this.scene, _this.camera);
                // Clear and draw title text
                _this.titleCtx.clearRect(0, 0, _this.titleCanvas.width, _this.titleCanvas.height);
                // Draw title
                _this.titleCtx.font = 'bold 72px Arial';
                _this.titleCtx.textAlign = 'center';
                _this.titleCtx.fillStyle = '#ffffff';
                _this.titleCtx.strokeStyle = '#000000';
                _this.titleCtx.lineWidth = 5;
                _this.titleCtx.strokeText('florr.io', _this.titleCanvas.width / 2, _this.titleCanvas.height / 3);
                _this.titleCtx.fillText('florr.io', _this.titleCanvas.width / 2, _this.titleCanvas.height / 3);
                // Draw subtitle with floating animation
                _this.titleCtx.font = '24px Arial';
                _this.titleCtx.fillStyle = '#000000';
                var yOffset = Math.sin(Date.now() * 0.002) * 5;
                _this.titleCtx.fillText('Press SPACE to start', _this.titleCanvas.width / 2, _this.titleCanvas.height / 2 + yOffset);
            }
        };
        animate();
    };
    Game.prototype.startGame = function () {
        var _this = this;
        this.isGameStarted = true;
        // Remove title canvas if it exists and is attached
        if (this.titleCanvas && this.titleCanvas.parentNode === document.body) {
            document.body.removeChild(this.titleCanvas);
        }
        // Show wave UI
        this.waveUI.show();
        // Clear the scene of all spectator elements
        this.players.forEach(function (player, id) {
            _this.scene.remove(player);
        });
        this.players.clear();
        this.enemies.forEach(function (enemy) {
            enemy.remove();
        });
        this.enemies.clear();
        this.playerInventories.forEach(function (inventory) {
            inventory.loadPetals();
        });
        this.playerHealthBars.forEach(function (healthBar) {
            healthBar.remove();
        });
        this.playerHealthBars.clear();
        // Clear the renderer
        this.renderer.clear();
        // Clear items
        this.items.forEach(function (item) {
            item.remove();
        });
        this.items.clear();
        // Reconnect to server to get a fresh connection
        if (this.socket) {
            this.socket.disconnect();
        }
        this.socket = (0, socket_io_client_1.io)('/', {
            query: {
                accountId: this.accountManager.getAccountId()
            }
        });
        // Setup game scene
        this.setupGame();
    };
    Game.prototype.setupGame = function () {
        // Set initial camera position for game
        this.camera.position.set(0, 5, 10);
        this.camera.lookAt(0, 0, 0);
        // Setup socket events first
        this.setupSocketEvents();
        // Setup controls
        this.setupControls();
        this.setupMouseControls();
        // Start game animation loop
        this.animate();
    };
    Game.prototype.init = function () {
        var _this = this;
        // Setup renderer
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        document.body.appendChild(this.renderer.domElement);
        // Set default background color (will be updated from server)
        this.scene.background = new THREE.Color(0x87CEEB);
        // Add lights (positions will be updated from server)
        this.scene.add(this.ambientLight);
        this.directionalLight.position.set(0, 10, 0);
        this.directionalLight.target.position.set(0, 0, 0);
        this.scene.add(this.directionalLight);
        this.scene.add(this.directionalLight.target);
        this.scene.add(this.hemisphereLight);
        // Add ground to scene
        this.scene.add(this.ground);
        // Add grid helper with default color
        this.gridHelper = new THREE.GridHelper(30, 30, 0x038f21, 0x038f21);
        this.gridHelper.position.y = 0.01;
        this.scene.add(this.gridHelper);
        // Handle window resize
        window.addEventListener('resize', function () { return _this.onWindowResize(); });
        // Create and show title screen
        this.createTitleScreen();
    };
    Game.prototype.animate = function () {
        var _this = this;
        if (!this.isGameStarted)
            return;
        var currentTime = Date.now();
        var elapsed = currentTime - this.lastFrameTime;
        if (elapsed > this.frameInterval) {
            this.lastFrameTime = currentTime - (elapsed % this.frameInterval);
            // Update player movement
            this.updatePlayerMovement();
            // Update all petals
            this.playerInventories.forEach(function (inventory) {
                inventory.getPetals().forEach(function (petal) { return petal.update(); });
            });
            // Update all items
            this.items.forEach(function (item) { return item.update(); });
            // Check petal collisions
            this.checkPetalCollisions();
            // Check enemy collisions with player
            this.checkEnemyCollisions();
            // Check item collisions with player
            this.checkItemCollisions();
            // Update health regeneration
            this.updateHealthRegeneration();
            // Update health bars
            this.playerHealthBars.forEach(function (healthBar) { return healthBar.updatePosition(); });
            // Update camera
            this.updateCameraPosition();
            // Render inventory UI
            this.renderInventoryUI();
            // Render game scene
            this.renderer.render(this.scene, this.camera);
        }
        requestAnimationFrame(function () { return _this.animate(); });
    };
    Game.prototype.updateHealthRegeneration = function () {
        var _this = this;
        var _a;
        var socketId = (_a = this.socket) === null || _a === void 0 ? void 0 : _a.id;
        if (!socketId)
            return;
        var currentTime = Date.now();
        // Natural health regeneration
        if (currentTime - this.lastHealTime >= this.HEAL_INTERVAL) {
            var healthBar = this.playerHealthBars.get(socketId);
            if (healthBar) {
                healthBar.heal(this.HEAL_AMOUNT);
            }
            this.lastHealTime = currentTime;
        }
        // Leaf petal passive healing
        var inventory = this.playerInventories.get(socketId);
        if (inventory) {
            var slots = inventory.getSlots();
            slots.forEach(function (slot) {
                var _a;
                if (((_a = slot.petal) === null || _a === void 0 ? void 0 : _a.getType()) === types_1.PetalType.LEAF && !slot.petal.isBrokenState()) {
                    var healthBar = _this.playerHealthBars.get(socketId);
                    if (healthBar) {
                        healthBar.heal(0.1); // Passive healing from leaf petal
                    }
                }
            });
        }
    };
    Game.prototype.createPlayer = function (playerId) {
        var _this = this;
        // Create a sphere for the player
        var geometry = new THREE.SphereGeometry(0.5, 32, 32);
        // Load the SVG texture
        this.textureLoader.load(player_svg_1.default, function (texture) {
            var _a;
            // Configure texture to prevent stretching
            texture.wrapS = THREE.ClampToEdgeWrapping;
            texture.wrapT = THREE.ClampToEdgeWrapping;
            // Adjust UV mapping to maintain aspect ratio
            var uvAttribute = geometry.attributes.uv;
            var positions = geometry.attributes.position;
            for (var i = 0; i < uvAttribute.count; i++) {
                var u = uvAttribute.getX(i);
                var v = uvAttribute.getY(i);
                // Map UV coordinates to center the texture
                var newU = (u - 0.5) + 0.5;
                var newV = (v - 0.5) + 0.5;
                uvAttribute.setXY(i, newU, newV);
            }
            uvAttribute.needsUpdate = true;
            // Create a shader material with increased saturation
            var material = new THREE.ShaderMaterial({
                uniforms: {
                    map: { value: texture },
                    saturation: { value: 1.2 } // Saturation multiplier (1.0 is normal)
                },
                vertexShader: "\n                    varying vec2 vUv;\n                    void main() {\n                        vUv = uv;\n                        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);\n                    }\n                ",
                fragmentShader: "\n                    uniform sampler2D map;\n                    uniform float saturation;\n                    varying vec2 vUv;\n\n                    void main() {\n                        vec4 texColor = texture2D(map, vUv);\n                        \n                        // Convert to grayscale\n                        float gray = dot(texColor.rgb, vec3(0.299, 0.587, 0.114));\n                        \n                        // Mix between gray and color based on saturation\n                        vec3 saturated = mix(vec3(gray), texColor.rgb, saturation);\n                        \n                        gl_FragColor = vec4(saturated, texColor.a);\n                    }\n                ",
                transparent: true,
                side: THREE.DoubleSide
            });
            var player = new THREE.Mesh(geometry, material);
            player.position.y = 0.5;
            // Rotate the sphere 90 degrees to the right around the Y axis
            player.rotateY(Math.PI / 2);
            _this.scene.add(player);
            _this.players.set(playerId, player);
            // Add health bar with camera reference
            var healthBar = new health_1.HealthBar(_this.camera, player);
            _this.playerHealthBars.set(playerId, healthBar);
            // Create inventory with default petals
            var inventory = new inventory_1.Inventory(_this.scene, player);
            for (var i = 0; i < 5; i++) {
                inventory.addPetal(types_1.PetalType.BASIC, i);
            }
            _this.playerInventories.set(playerId, inventory);
            // Initialize crafting system if this is the local player
            if (playerId === ((_a = _this.socket) === null || _a === void 0 ? void 0 : _a.id)) {
                _this.craftingSystem = new crafting_1.CraftingSystem(_this.scene, player, _this);
            }
        });
    };
    Game.prototype.setupMouseControls = function () {
        var _this = this;
        var isDragging = false;
        var previousMousePosition = { x: 0, y: 0 };
        document.addEventListener('mousedown', function (event) {
            isDragging = true;
            previousMousePosition = {
                x: event.clientX,
                y: event.clientY
            };
        });
        document.addEventListener('mousemove', function (event) {
            if (!isDragging)
                return;
            var deltaMove = {
                x: event.clientX - previousMousePosition.x,
            };
            if (deltaMove.x != 0) {
                _this.cameraRotation += deltaMove.x * 0.01;
            }
            previousMousePosition = {
                x: event.clientX,
                y: event.clientY
            };
        });
        document.addEventListener('mouseup', function () {
            isDragging = false;
        });
    };
    Game.prototype.updateCameraPosition = function () {
        var _a;
        if (!((_a = this.socket) === null || _a === void 0 ? void 0 : _a.id))
            return;
        var player = this.players.get(this.socket.id);
        if (!player)
            return;
        // Calculate camera position based on player position and rotation
        var distance = 10;
        var height = 5;
        var x = player.position.x + Math.sin(this.cameraRotation) * distance;
        var z = player.position.z + Math.cos(this.cameraRotation) * distance;
        this.camera.position.set(x, height, z);
        this.camera.lookAt(player.position);
    };
    Game.prototype.setupSocketEvents = function () {
        var _this = this;
        var _a;
        if (!this.socket)
            return;
        this.socket.on('connect', function () {
            var _a;
            if ((_a = _this.socket) === null || _a === void 0 ? void 0 : _a.id) {
                _this.createPlayer(_this.socket.id);
                _this.playerVelocities.set(_this.socket.id, new THREE.Vector3());
                // Request lighting configuration from server
                _this.socket.emit('requestLightingConfig');
            }
        });
        // Add lighting configuration handler
        this.socket.on('lightingConfig', function (config) {
            _this.updateLighting(config);
        });
        // Add player damage event handler
        this.socket.on('playerDamaged', function (data) {
            var _a;
            if (((_a = _this.socket) === null || _a === void 0 ? void 0 : _a.id) === data.id) {
                var healthBar = _this.playerHealthBars.get(_this.socket.id);
                if (healthBar) {
                    var isDead = healthBar.takeDamage(10);
                    if (isDead) {
                        _this.showDeathScreen();
                    }
                }
            }
        });
        // Add item spawn event handler
        this.socket.on('itemSpawned', function (data) {
            var item = new item_1.Item(_this.scene, new THREE.Vector3(data.position.x, data.position.y, data.position.z), data.type, data.id);
            _this.items.set(data.id, item);
        });
        // Add enemy damage event handler
        this.socket.on('enemyDamaged', function (data) {
            var enemy = _this.enemies.get(data.enemyId);
            if (enemy) {
                enemy.takeDamage(data.damage);
            }
        });
        this.socket.on('playerJoined', function (data) {
            _this.createPlayer(data.id);
        });
        this.socket.on('playerLeft', function (playerId) {
            var player = _this.players.get(playerId);
            if (player) {
                _this.scene.remove(player);
                _this.players.delete(playerId);
                // Remove petals
                var inventory = _this.playerInventories.get(playerId);
                if (inventory) {
                    inventory.clear();
                    _this.playerInventories.delete(playerId);
                }
            }
        });
        this.socket.on('playerMoved', function (data) {
            var player = _this.players.get(data.id);
            if (player) {
                player.position.set(data.position.x, data.position.y, data.position.z);
            }
        });
        // Setup enemy events
        this.setupEnemyEvents();
        // Wave and XP events
        this.socket.on('waveStart', function (data) {
            // Clear all existing enemies
            _this.enemies.forEach(function (enemy) {
                enemy.remove();
            });
            _this.enemies.clear();
            // Reset wave stats
            _this.currentWave = data.wave;
            _this.enemiesKilled = 0;
            _this.totalXP = 0;
            _this.waveUI.update(_this.currentWave, _this.enemiesKilled, _this.totalXP, data.minRarity);
        });
        this.socket.on('playerXP', function (data) {
            var _a;
            if (((_a = _this.socket) === null || _a === void 0 ? void 0 : _a.id) === data.id) {
                _this.totalXP = data.xp % _this.XP_PER_WAVE;
                _this.waveUI.update(_this.currentWave, _this.enemiesKilled, _this.totalXP);
            }
        });
        (_a = this.socket) === null || _a === void 0 ? void 0 : _a.on('configUpdate', function (config) {
            _this.updateLighting(config);
            // Update sky color
            _this.scene.background = new THREE.Color(config.skyColor);
            // Update ground color
            if (_this.ground && _this.ground.material instanceof THREE.MeshPhongMaterial) {
                _this.ground.material.color.setHex(config.hemisphereLight.groundColor);
                _this.ground.material.needsUpdate = true; // Ensure material updates
            }
            // Update grid color if gridConfig is present
            if (config.gridConfig && _this.gridHelper) {
                // Remove old grid helper
                _this.scene.remove(_this.gridHelper);
                // Create new grid helper with updated color
                _this.gridHelper = new THREE.GridHelper(30, 30, config.gridConfig.gridColor, config.gridConfig.gridColor);
                _this.gridHelper.position.y = 0.01;
                _this.scene.add(_this.gridHelper);
            }
        });
        // Handle account sync
        this.socket.on('accountSync', function (data) {
            var _a;
            console.log('Received account sync:', data);
            // Update account data
            _this.totalXP = data.totalXP;
            // Load inventory data
            if ((_a = _this.socket) === null || _a === void 0 ? void 0 : _a.id) {
                var inventory_2 = _this.playerInventories.get(_this.socket.id);
                if (!inventory_2) {
                    inventory_2 = new inventory_1.Inventory(_this.scene, _this.players.get(_this.socket.id));
                    _this.playerInventories.set(_this.socket.id, inventory_2);
                }
                // Load petals
                data.inventory.petals.forEach(function (petal) {
                    inventory_2 === null || inventory_2 === void 0 ? void 0 : inventory_2.addPetal(petal.type, petal.slotIndex);
                });
                // Store collected items - repeat each type by its amount
                _this.collectedPetals = data.inventory.collectedItems.flatMap(function (item) {
                    return Array(item.amount).fill(item.type);
                });
                // Update UI if inventory is open
                if (_this.isInventoryOpen) {
                    _this.updateInventoryDisplay();
                }
            }
        });
        // Handle inventory sync
        this.socket.on('inventorySync', function (data) {
            var _a;
            console.log('Received inventory sync:', data);
            if ((_a = _this.socket) === null || _a === void 0 ? void 0 : _a.id) {
                var inventory_3 = _this.playerInventories.get(_this.socket.id);
                if (!inventory_3) {
                    inventory_3 = new inventory_1.Inventory(_this.scene, _this.players.get(_this.socket.id));
                    _this.playerInventories.set(_this.socket.id, inventory_3);
                }
                // Load petals
                data.petals.forEach(function (petal) {
                    inventory_3 === null || inventory_3 === void 0 ? void 0 : inventory_3.addPetal(petal.type, petal.slotIndex);
                });
                // Store collected items - repeat each type by its amount
                _this.collectedPetals = data.collectedItems.flatMap(function (item) {
                    return Array(item.amount).fill(item.type);
                });
                // Update UI if inventory is open
                if (_this.isInventoryOpen) {
                    _this.updateInventoryDisplay();
                }
            }
        });
        // Handle item collection confirmation
        this.socket.on('itemCollectionConfirmed', function (data) {
            var _a;
            console.log('Item collection confirmed:', data);
            if ((_a = _this.socket) === null || _a === void 0 ? void 0 : _a.id) {
                // Update collected items - repeat each type by its amount
                _this.collectedPetals = data.inventory.collectedItems.flatMap(function (item) {
                    return Array(item.amount).fill(item.type);
                });
                // Update UI if inventory is open
                if (_this.isInventoryOpen) {
                    _this.updateInventoryDisplay();
                }
            }
        });
        // Handle inventory update confirmation
        this.socket.on('inventoryUpdateConfirmed', function (data) {
            var _a;
            console.log('Inventory update confirmed:', data);
            if ((_a = _this.socket) === null || _a === void 0 ? void 0 : _a.id) {
                var inventory_4 = _this.playerInventories.get(_this.socket.id);
                if (inventory_4) {
                    // Update petals
                    inventory_4.clear();
                    data.petals.forEach(function (petal) {
                        inventory_4 === null || inventory_4 === void 0 ? void 0 : inventory_4.addPetal(petal.type, petal.slotIndex);
                    });
                    // Update collected items - repeat each type by its amount
                    _this.collectedPetals = data.collectedItems.flatMap(function (item) {
                        return Array(item.amount).fill(item.type);
                    });
                    // Update UI if inventory is open
                    if (_this.isInventoryOpen) {
                        _this.updateInventoryDisplay();
                    }
                }
            }
        });
    };
    Game.prototype.setupControls = function () {
        var _this = this;
        document.addEventListener('keydown', function (event) {
            var _a;
            if (!((_a = _this.socket) === null || _a === void 0 ? void 0 : _a.id))
                return;
            _this.pressedKeys.add(event.key);
            var player = _this.players.get(_this.socket.id);
            var inventory = _this.playerInventories.get(_this.socket.id);
            if (!player || !inventory)
                return;
            // Handle petal expansion with space key
            if (event.code === 'Space') {
                inventory.expandPetals();
            }
            // Toggle inventory menu with Z key
            if (event.code === 'KeyZ') {
                _this.toggleInventoryMenu();
            }
            // Toggle crafting menu with C key
            if (event.code === 'KeyC' && _this.craftingSystem) {
                _this.craftingSystem.toggleVisibility();
            }
        });
        document.addEventListener('keyup', function (event) {
            var _a;
            if (!((_a = _this.socket) === null || _a === void 0 ? void 0 : _a.id))
                return;
            _this.pressedKeys.delete(event.key);
            if (event.code === 'Space') {
                var inventory = _this.playerInventories.get(_this.socket.id);
                if (inventory) {
                    inventory.contractPetals();
                }
            }
        });
    };
    Game.prototype.updatePlayerMovement = function () {
        var _a;
        if (!((_a = this.socket) === null || _a === void 0 ? void 0 : _a.id))
            return;
        var player = this.players.get(this.socket.id);
        if (!player)
            return;
        var movement = { x: 0, z: 0 };
        var direction = 0;
        var isMoving = false;
        // Calculate movement based on pressed keys
        if (this.pressedKeys.has('w') || this.pressedKeys.has('ArrowUp')) {
            movement.x -= Math.sin(this.cameraRotation);
            movement.z -= Math.cos(this.cameraRotation);
            direction = Math.PI / 2;
            isMoving = true;
        }
        if (this.pressedKeys.has('s') || this.pressedKeys.has('ArrowDown')) {
            movement.x += Math.sin(this.cameraRotation);
            movement.z += Math.cos(this.cameraRotation);
            direction = Math.PI * 3 / 2;
            isMoving = true;
        }
        if (this.pressedKeys.has('a') || this.pressedKeys.has('ArrowLeft')) {
            movement.x -= Math.cos(this.cameraRotation);
            movement.z += Math.sin(this.cameraRotation);
            direction = Math.PI;
            isMoving = true;
        }
        if (this.pressedKeys.has('d') || this.pressedKeys.has('ArrowRight')) {
            movement.x += Math.cos(this.cameraRotation);
            movement.z -= Math.sin(this.cameraRotation);
            direction = 0;
            isMoving = true;
        }
        // Normalize diagonal movement
        if (movement.x !== 0 || movement.z !== 0) {
            var length_1 = Math.sqrt(movement.x * movement.x + movement.z * movement.z);
            movement.x /= length_1;
            movement.z /= length_1;
        }
        // Calculate new position
        var newX = player.position.x + movement.x * this.moveSpeed;
        var newZ = player.position.z + movement.z * this.moveSpeed;
        // Check boundaries before applying movement
        if (newX >= -this.mapSize && newX <= this.mapSize &&
            newZ >= -this.mapSize && newZ <= this.mapSize) {
            player.position.x = newX;
            player.position.z = newZ;
            player.position.y = 0.5;
            // Update player rotation based on movement direction
            if (isMoving) {
                var angle = Math.atan2(movement.x, movement.z);
                player.rotation.y = angle - Math.PI / 2;
            }
            // Emit position to server
            this.socket.emit('move', {
                x: player.position.x,
                y: player.position.y,
                z: player.position.z
            });
        }
    };
    Game.prototype.onWindowResize = function () {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        // Update title canvas size if it exists
        if (this.titleCanvas) {
            this.titleCanvas.width = window.innerWidth;
            this.titleCanvas.height = window.innerHeight;
        }
    };
    Game.prototype.checkPetalCollisions = function () {
        var _this = this;
        var _a;
        if (!((_a = this.socket) === null || _a === void 0 ? void 0 : _a.id))
            return;
        var inventory = this.playerInventories.get(this.socket.id);
        if (!inventory)
            return;
        // Use all petals instead of just active ones
        var petals = inventory.getPetals();
        this.enemies.forEach(function (enemy) {
            petals.forEach(function (petal) {
                var _a;
                if (petal.isBrokenState())
                    return; // Skip broken petals
                var petalPosition = petal.getPosition();
                var enemyPosition = enemy.getPosition();
                var distance = petalPosition.distanceTo(enemyPosition);
                if (distance < 1.2) {
                    // Calculate knockback direction
                    var knockbackDir = new THREE.Vector3()
                        .subVectors(enemyPosition, petalPosition)
                        .normalize();
                    // Calculate damage based on petal type
                    var damage = 5; // Base damage
                    if (petal.getType() === types_1.PetalType.STINGER) {
                        damage *= 5; // Stinger does 5x damage
                    }
                    // Send damage event to server
                    (_a = _this.socket) === null || _a === void 0 ? void 0 : _a.emit('enemyDamaged', {
                        enemyId: enemy.getId(),
                        damage: damage,
                        knockback: { x: knockbackDir.x, z: knockbackDir.z }
                    });
                    // Make petal take damage on collision
                    petal.takeDamage(10); // Petals take 10 damage per hit
                }
            });
        });
    };
    Game.prototype.checkEnemyCollisions = function () {
        var _this = this;
        var _a;
        if (!((_a = this.socket) === null || _a === void 0 ? void 0 : _a.id))
            return;
        var player = this.players.get(this.socket.id);
        if (!player)
            return;
        this.enemies.forEach(function (enemy) {
            var _a;
            var enemyPosition = enemy.getPosition();
            var playerPosition = player.position;
            var distance = enemyPosition.distanceTo(playerPosition);
            // If enemy is touching player's center
            if (distance < 1.0) {
                // Send damage event to server
                (_a = _this.socket) === null || _a === void 0 ? void 0 : _a.emit('playerDamaged', {
                    damage: 10
                });
            }
        });
    };
    Game.prototype.checkItemCollisions = function () {
        var _this = this;
        var _a;
        if (!((_a = this.socket) === null || _a === void 0 ? void 0 : _a.id))
            return;
        var player = this.players.get(this.socket.id);
        if (!player)
            return;
        this.items.forEach(function (item, itemId) {
            var itemPosition = item.getPosition();
            var playerPosition = player.position;
            var distance = itemPosition.distanceTo(playerPosition);
            // If player touches item
            if (distance < 1.0) {
                // Convert item type to petal type
                var petalType = item.getType() === item_1.ItemType.TETRAHEDRON ? types_1.PetalType.TETRAHEDRON :
                    item.getType() === item_1.ItemType.LEAF ? types_1.PetalType.LEAF :
                        item.getType() === item_1.ItemType.STINGER ? types_1.PetalType.STINGER :
                            item.getType() === item_1.ItemType.PEA ? types_1.PetalType.PEA :
                                types_1.PetalType.CUBE;
                _this.collectedPetals.push(petalType);
                // Update inventory display if open
                if (_this.isInventoryOpen) {
                    _this.updateInventoryDisplay();
                }
                // Remove item
                item.remove();
                _this.items.delete(itemId);
            }
        });
    };
    Game.prototype.renderInventoryUI = function () {
        var _this = this;
        var _a;
        if (!((_a = this.socket) === null || _a === void 0 ? void 0 : _a.id))
            return;
        var inventory = this.playerInventories.get(this.socket.id);
        if (!inventory)
            return;
        var slots = inventory.getSlots();
        slots.forEach(function (slot, index) {
            if (index >= _this.inventorySlotRenderers.length)
                return;
            var scene = _this.inventorySlotScenes[index];
            var camera = _this.inventorySlotCameras[index];
            var renderer = _this.inventorySlotRenderers[index];
            var container = _this.inventorySlotContainers[index];
            // Update container style based on active state
            container.style.backgroundColor = slot.isActive ? 'rgba(255, 107, 107, 0.2)' : 'rgba(255, 255, 255, 0.2)';
            container.style.cursor = 'pointer'; // Add cursor pointer
            // Add click handler to the container
            container.onclick = function () {
                var _a;
                if (!((_a = _this.socket) === null || _a === void 0 ? void 0 : _a.id))
                    return;
                var inventory = _this.playerInventories.get(_this.socket.id);
                if (!inventory || !slot.petal)
                    return;
                // Get the petal type before removing it
                var petalType = slot.petal.getType();
                // Remove the petal from the slot
                inventory.removePetal(index);
                // Add it back to collected petals
                _this.collectedPetals.push(petalType);
                // Update inventory display if open
                if (_this.isInventoryOpen) {
                    _this.updateInventoryDisplay();
                }
            };
            // Clear previous petal preview if any
            while (scene.children.length > 2) { // Keep lights (ambient and point)
                scene.remove(scene.children[2]);
            }
            // Update or create petal name text
            var nameText = container.querySelector('.petal-name');
            if (!nameText) {
                nameText = document.createElement('div');
                nameText.className = 'petal-name';
                nameText.style.position = 'absolute';
                nameText.style.bottom = '5px';
                nameText.style.left = '0';
                nameText.style.width = '100%';
                nameText.style.textAlign = 'center';
                nameText.style.color = 'black';
                nameText.style.fontFamily = 'Arial, sans-serif';
                nameText.style.fontSize = '12px';
                nameText.style.fontWeight = 'bold';
                nameText.style.pointerEvents = 'none';
                nameText.style.backgroundColor = 'rgba(255, 255, 255, 0.7)';
                nameText.style.padding = '2px 0';
                container.appendChild(nameText);
            }
            // Get the petal type and display the raw enum value
            nameText.textContent = slot.petal ? slot.petal.getType() : '';
            if (slot.petal) {
                // Create health bar
                var healthBar = container.querySelector('.petal-health');
                if (!healthBar) {
                    healthBar = document.createElement('div');
                    healthBar.className = 'petal-health';
                    healthBar.style.position = 'absolute';
                    healthBar.style.top = '5px';
                    healthBar.style.left = '5px';
                    healthBar.style.right = '5px';
                    healthBar.style.height = '4px';
                    healthBar.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
                    healthBar.style.borderRadius = '2px';
                    container.appendChild(healthBar);
                    var healthFill_1 = document.createElement('div');
                    healthFill_1.style.height = '100%';
                    healthFill_1.style.width = '100%';
                    healthFill_1.style.backgroundColor = '#2ecc71';
                    healthFill_1.style.borderRadius = '2px';
                    healthFill_1.style.transition = 'width 0.2s ease-out';
                    healthBar.appendChild(healthFill_1);
                }
                // Update health bar
                var healthFill = healthBar.firstChild;
                if (slot.petal.isBrokenState()) {
                    healthFill.style.width = '0%';
                    healthFill.style.backgroundColor = '#e74c3c';
                    container.style.opacity = '0.5';
                }
                else {
                    var healthPercent = slot.petal.getHealthPercent();
                    healthFill.style.width = "".concat(healthPercent, "%");
                    healthFill.style.backgroundColor = healthPercent > 50 ? '#2ecc71' : '#e74c3c';
                    container.style.opacity = '1';
                }
                // Create a preview petal mesh using a sphere
                var geometry = new THREE.SphereGeometry(0.4, 32, 32);
                var material = new THREE.MeshBasicMaterial({
                    color: 0xffffff,
                    opacity: slot.petal.isBrokenState() ? 0.3 : 1.0,
                    transparent: true
                });
                var petalMesh = new THREE.Mesh(geometry, material);
                scene.add(petalMesh);
                // Rotate the preview petal
                var time = Date.now() * 0.0005;
                petalMesh.rotation.x = time * 0.5;
                petalMesh.rotation.y = time;
            }
            // Render the slot
            renderer.render(scene, camera);
        });
    };
    Game.prototype.setupWaveEvents = function () {
        var _this = this;
        if (!this.socket)
            return;
        this.socket.on('waveStart', function (data) {
            _this.currentWave = data.wave;
            _this.enemiesKilled = 0;
            _this.totalXP = 0;
            _this.waveUI.update(_this.currentWave, _this.enemiesKilled, _this.totalXP, data.minRarity);
        });
        this.socket.on('playerXP', function (data) {
            var _a;
            if (((_a = _this.socket) === null || _a === void 0 ? void 0 : _a.id) === data.id) {
                _this.totalXP = data.xp % _this.XP_PER_WAVE;
                _this.waveUI.update(_this.currentWave, _this.enemiesKilled, _this.totalXP);
            }
        });
    };
    Game.prototype.createDeathScreen = function () {
        var _this = this;
        // Create death screen container
        this.deathScreen = document.createElement('div');
        this.deathScreen.style.position = 'fixed';
        this.deathScreen.style.top = '0';
        this.deathScreen.style.left = '0';
        this.deathScreen.style.width = '100%';
        this.deathScreen.style.height = '100%';
        this.deathScreen.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        this.deathScreen.style.display = 'flex';
        this.deathScreen.style.flexDirection = 'column';
        this.deathScreen.style.alignItems = 'center';
        this.deathScreen.style.justifyContent = 'center';
        this.deathScreen.style.zIndex = '1000';
        // Add "You Died" text
        var deathText = document.createElement('div');
        deathText.textContent = 'You Died';
        deathText.style.color = '#ff0000';
        deathText.style.fontSize = '64px';
        deathText.style.fontFamily = 'Arial, sans-serif';
        deathText.style.fontWeight = 'bold';
        deathText.style.marginBottom = '30px';
        this.deathScreen.appendChild(deathText);
        // Add continue button
        var continueButton = document.createElement('button');
        continueButton.textContent = 'Return to Title';
        continueButton.style.padding = '15px 30px';
        continueButton.style.fontSize = '24px';
        continueButton.style.backgroundColor = '#4CAF50';
        continueButton.style.color = 'white';
        continueButton.style.border = 'none';
        continueButton.style.borderRadius = '5px';
        continueButton.style.cursor = 'pointer';
        continueButton.style.transition = 'background-color 0.3s';
        continueButton.addEventListener('mouseover', function () {
            continueButton.style.backgroundColor = '#45a049';
        });
        continueButton.addEventListener('mouseout', function () {
            continueButton.style.backgroundColor = '#4CAF50';
        });
        continueButton.addEventListener('click', function () {
            _this.respawnPlayer();
        });
        this.deathScreen.appendChild(continueButton);
    };
    Game.prototype.showDeathScreen = function () {
        if (!this.deathScreen) {
            this.createDeathScreen();
        }
        document.body.appendChild(this.deathScreen);
        // Stop game loop
        this.isGameStarted = false;
    };
    Game.prototype.hideDeathScreen = function () {
        if (this.deathScreen && this.deathScreen.parentNode) {
            this.deathScreen.parentNode.removeChild(this.deathScreen);
        }
    };
    Game.prototype.respawnPlayer = function () {
        var _this = this;
        var _a;
        if (!((_a = this.socket) === null || _a === void 0 ? void 0 : _a.id))
            return;
        // Hide death screen
        this.hideDeathScreen();
        // Clear game state
        this.players.forEach(function (player) {
            _this.scene.remove(player);
        });
        this.players.clear();
        this.enemies.forEach(function (enemy) {
            enemy.remove();
        });
        this.enemies.clear();
        this.playerInventories.forEach(function (inventory) {
            inventory.clear();
        });
        this.playerInventories.clear();
        this.playerHealthBars.forEach(function (healthBar) {
            healthBar.remove();
        });
        this.playerHealthBars.clear();
        // Reset game state
        this.isGameStarted = false;
        // Reconnect for spectating
        if (this.socket) {
            this.socket.disconnect();
        }
        this.socket = (0, socket_io_client_1.io)('/', {
            query: {
                accountId: this.accountManager.getAccountId()
            }
        });
        this.setupSpectatorEvents();
        // Reset camera for spectating
        this.camera.position.set(0, 15, 0);
        this.camera.lookAt(0, 0, 0);
        // Recreate and show title screen
        this.titleCanvas = document.createElement('canvas');
        this.titleCanvas.style.position = 'absolute';
        this.titleCanvas.style.top = '0';
        this.titleCanvas.style.left = '0';
        this.titleCanvas.style.pointerEvents = 'none';
        document.body.appendChild(this.titleCanvas);
        var ctx = this.titleCanvas.getContext('2d');
        if (!ctx)
            throw new Error('Could not get 2D context');
        this.titleCtx = ctx;
        // Update canvas size
        this.onWindowResize();
        // Hide wave UI
        this.waveUI.hide();
        // Start title screen animation
        var angle = 0;
        var animate = function () {
            if (_this.isGameStarted)
                return;
            // Clear the canvas
            _this.titleCtx.clearRect(0, 0, _this.titleCanvas.width, _this.titleCanvas.height);
            // Draw title text
            _this.titleCtx.font = 'bold 64px Arial';
            _this.titleCtx.fillStyle = '#ffffff';
            _this.titleCtx.textAlign = 'center';
            _this.titleCtx.textBaseline = 'middle';
            _this.titleCtx.fillText('florr.io', _this.titleCanvas.width / 2, _this.titleCanvas.height / 2 - 40);
            // Draw subtitle with floating animation
            _this.titleCtx.font = '24px Arial';
            _this.titleCtx.fillStyle = '#000000';
            var floatOffset = Math.sin(Date.now() * 0.003) * 5;
            _this.titleCtx.fillText('Press SPACE to start', _this.titleCanvas.width / 2, _this.titleCanvas.height / 2 + 40 + floatOffset);
            // Rotate camera
            angle += 0.002;
            _this.camera.position.x = Math.sin(angle) * 15;
            _this.camera.position.z = Math.cos(angle) * 15;
            _this.camera.position.y = 15;
            _this.camera.lookAt(0, 0, 0);
            // Render scene
            _this.renderer.render(_this.scene, _this.camera);
            requestAnimationFrame(animate);
        };
        animate();
    };
    Game.prototype.createInventoryMenu = function () {
        var _this = this;
        this.inventoryMenu = document.createElement('div');
        var menu = this.inventoryMenu;
        // Style the menu for bottom left corner
        menu.style.position = 'fixed';
        menu.style.bottom = '20px';
        menu.style.left = '20px'; // Ensure it's using left positioning
        menu.style.width = '300px';
        menu.style.backgroundColor = '#589ad4';
        menu.style.padding = '15px';
        menu.style.borderRadius = '10px';
        menu.style.display = 'none';
        menu.style.zIndex = '1000';
        menu.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.5)';
        // Add title
        var title = document.createElement('h2');
        title.textContent = 'Inventory';
        title.style.textAlign = 'left';
        title.style.marginBottom = '15px';
        title.style.fontSize = '18px';
        title.style.color = 'white';
        menu.appendChild(title);
        // Create grid container for petals
        var grid = document.createElement('div');
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = 'repeat(4, 1fr)';
        grid.style.gap = '8px';
        menu.appendChild(grid);
        // Create preview renderers for each petal type
        Object.values(types_1.PetalType).forEach(function (type) {
            var renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
            renderer.setSize(50, 50);
            renderer.setClearColor(0x000000, 0);
            var scene = new THREE.Scene();
            var camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
            camera.position.set(0, 0, 3);
            camera.lookAt(0, 0, 0);
            // Add lighting
            var ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
            scene.add(ambientLight);
            var pointLight = new THREE.PointLight(0xffffff, 1.0);
            pointLight.position.set(2, 2, 2);
            scene.add(pointLight);
            // Create preview mesh based on type
            if (type === types_1.PetalType.LEAF) {
                // Use the same GLTFLoader and model as the Item class
                var modelLoader = new GLTFLoader_1.GLTFLoader();
                modelLoader.load('leaf.glb', function (gltf) {
                    var leafMesh = gltf.scene;
                    leafMesh.scale.set(0.3, 0.3, 0.3);
                    scene.add(leafMesh);
                    // Store renderer, scene, camera, and mesh for updates
                    _this.inventoryPreviews.set(type, {
                        renderer: renderer,
                        scene: scene,
                        camera: camera,
                        mesh: leafMesh
                    });
                });
            }
            else {
                var geometry = void 0;
                var material = void 0;
                switch (type) {
                    case types_1.PetalType.TETRAHEDRON:
                    case types_1.PetalType.TETRAHEDRON_EPIC:
                        geometry = new THREE.TetrahedronGeometry(0.8);
                        material = new THREE.MeshBasicMaterial({
                            color: 0xff0000,
                        });
                        break;
                    case types_1.PetalType.CUBE:
                    case types_1.PetalType.CUBE_LEGENDARY:
                        geometry = new THREE.BoxGeometry(0.8, 0.8, 0.8);
                        material = new THREE.MeshBasicMaterial({
                            color: 0x0000ff,
                        });
                        break;
                    case types_1.PetalType.PEA:
                        // Load the pea model for inventory preview
                        var modelLoader = new GLTFLoader_1.GLTFLoader();
                        modelLoader.load('peas.glb', function (gltf) {
                            var peaMesh = gltf.scene;
                            peaMesh.scale.set(0.15, 0.15, 0.15);
                            // Add green tint to all meshes in the model
                            peaMesh.traverse(function (child) {
                                if (child instanceof THREE.Mesh) {
                                    child.material = new THREE.MeshPhongMaterial({
                                        color: 0x90EE90,
                                        shininess: 30
                                    });
                                }
                            });
                            scene.add(peaMesh);
                            // Store renderer, scene, camera, and mesh for updates
                            _this.inventoryPreviews.set(type, {
                                renderer: renderer,
                                scene: scene,
                                camera: camera,
                                mesh: peaMesh
                            });
                        });
                        return; // Return early as model loading is async
                    case types_1.PetalType.STINGER:
                        geometry = new THREE.ConeGeometry(0.4, 1.0, 16);
                        material = new THREE.MeshBasicMaterial({
                            color: 0x000000,
                        });
                        break;
                    default:
                        geometry = new THREE.SphereGeometry(0.4, 32, 32);
                        material = new THREE.MeshPhongMaterial({
                            color: 0xffffff,
                        });
                }
                var mesh = new THREE.Mesh(geometry, material);
                scene.add(mesh);
                // Store renderer, scene, camera, and mesh for updates
                _this.inventoryPreviews.set(type, {
                    renderer: renderer,
                    scene: scene,
                    camera: camera,
                    mesh: mesh
                });
            }
        });
        document.body.appendChild(menu);
    };
    Game.prototype.toggleInventoryMenu = function () {
        // Close crafting if open
        if (this.isCraftingOpen) {
            this.isCraftingOpen = false;
            if (this.craftingMenu) {
                this.craftingMenu.style.display = 'none';
            }
        }
        if (!this.inventoryMenu) {
            this.createInventoryMenu();
        }
        this.isInventoryOpen = !this.isInventoryOpen;
        if (this.inventoryMenu) {
            this.inventoryMenu.style.display = this.isInventoryOpen ? 'block' : 'none';
            if (this.isInventoryOpen) {
                this.updateInventoryDisplay();
            }
        }
    };
    Game.prototype.updateInventoryDisplay = function () {
        var _this = this;
        var _a;
        if (!this.inventoryMenu || !((_a = this.socket) === null || _a === void 0 ? void 0 : _a.id))
            return;
        // Clear existing grid
        var grid = this.inventoryMenu.querySelector('div:nth-child(2)');
        if (!grid)
            return;
        grid.innerHTML = '';
        // Group petals by type
        var groupedPetals = this.collectedPetals.reduce(function (acc, type) {
            acc.set(type, (acc.get(type) || 0) + 1);
            return acc;
        }, new Map());
        // Add each group to the grid
        groupedPetals.forEach(function (count, petalType) {
            var slot = document.createElement('div');
            slot.style.backgroundColor = 'rgba(119, 234, 101, 1)';
            slot.style.padding = '5px';
            slot.style.borderRadius = '5px';
            slot.style.cursor = 'pointer';
            slot.style.position = 'relative';
            slot.style.height = '50px';
            slot.style.border = '2px solid #5fbb50';
            slot.draggable = true;
            slot.setAttribute('data-type', petalType);
            // Set background color based on petal rarity
            var rarity = petal_1.PETAL_STATS[petalType].rarity;
            var rarityColor = _this.settings.rarityTinting ?
                '#' + types_1.RARITY_COLORS[rarity].toString(16).padStart(6, '0') :
                'rgba(255, 255, 255, 0.2)';
            slot.style.backgroundColor = rarityColor;
            slot.style.border = _this.settings.rarityTinting ?
                "2px solid ".concat(rarityColor) :
                '2px solid rgba(255, 255, 255, 0.3)';
            // Create canvas container
            var canvasContainer = document.createElement('div');
            canvasContainer.style.width = '100%';
            canvasContainer.style.height = '100%';
            slot.appendChild(canvasContainer);
            // Add count badge
            var countBadge = document.createElement('div');
            countBadge.textContent = count.toString();
            countBadge.style.position = 'absolute';
            countBadge.style.bottom = '2px';
            countBadge.style.right = '2px';
            countBadge.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
            countBadge.style.color = 'white';
            countBadge.style.padding = '2px 6px';
            countBadge.style.borderRadius = '10px';
            countBadge.style.fontSize = '12px';
            slot.appendChild(countBadge);
            // Add rarity label
            var rarityLabel = document.createElement('div');
            rarityLabel.textContent = rarity;
            rarityLabel.style.position = 'absolute';
            rarityLabel.style.top = '2px';
            rarityLabel.style.left = '2px';
            rarityLabel.style.color = 'white';
            rarityLabel.style.fontSize = '10px';
            rarityLabel.style.textShadow = '1px 1px 2px rgba(0, 0, 0, 0.5)';
            rarityLabel.style.fontWeight = 'bold';
            slot.appendChild(rarityLabel);
            // Get the preview renderer for this type
            var preview = _this.inventoryPreviews.get(petalType);
            if (preview) {
                var renderer_1 = preview.renderer, scene_1 = preview.scene, camera_1 = preview.camera, mesh_1 = preview.mesh;
                canvasContainer.appendChild(renderer_1.domElement);
                // Start rendering the preview
                var animate_1 = function () {
                    if (!_this.isInventoryOpen)
                        return;
                    mesh_1.rotation.x += 0.02;
                    mesh_1.rotation.y += 0.02;
                    renderer_1.render(scene_1, camera_1);
                    requestAnimationFrame(animate_1);
                };
                animate_1();
            }
            // Add click event listener
            slot.addEventListener('click', function () {
                var _a;
                if (!((_a = _this.socket) === null || _a === void 0 ? void 0 : _a.id))
                    return;
                var inventory = _this.playerInventories.get(_this.socket.id);
                if (!inventory)
                    return;
                // Find the first empty slot
                var slots = inventory.getSlots();
                var emptySlotIndex = slots.findIndex(function (slot) { return !slot.petal; });
                if (emptySlotIndex !== -1) {
                    // Add petal to the empty slot
                    inventory.addPetal(petalType, emptySlotIndex);
                    // Remove one from collected petals
                    var petalIndex = _this.collectedPetals.findIndex(function (p) { return p === petalType; });
                    if (petalIndex !== -1) {
                        _this.collectedPetals.splice(petalIndex, 1);
                    }
                    // Update inventory display
                    _this.updateInventoryDisplay();
                }
            });
            grid.appendChild(slot);
        });
        // Create inventory slots
        var inventoryGrid = document.createElement('div');
        inventoryGrid.style.display = 'grid';
        inventoryGrid.style.gridTemplateColumns = 'repeat(5, 1fr)';
        inventoryGrid.style.gap = '8px';
        inventoryGrid.style.marginTop = '15px';
        grid.appendChild(inventoryGrid);
        // Add inventory slots
        var inventory = this.playerInventories.get(this.socket.id);
        if (inventory) {
            inventory.getSlots().forEach(function (slot, index) {
                // Show current petal if exists
                if (slot.petal) {
                    var preview = _this.inventoryPreviews.get(slot.petal.getType());
                    if (preview) {
                        var renderer = preview.renderer;
                    }
                }
            });
        }
    };
    Game.prototype.setupConnectionMonitoring = function () {
        var _this = this;
        if (!this.socket)
            return;
        // Handle disconnection
        this.socket.on('disconnect', function (reason) {
            console.log('Disconnected from server:', reason);
            if (reason === 'io server disconnect' || reason === 'transport close') {
                // Server is down, attempt to reconnect
                _this.attemptReconnect();
            }
        });
        // Handle connection error
        this.socket.on('connect_error', function (error) {
            console.log('Connection error:', error);
            _this.attemptReconnect();
        });
        // Reset reconnection attempts on successful connection
        this.socket.on('connect', function () {
            console.log('Connected to server');
            _this.reconnectAttempts = 0;
        });
    };
    Game.prototype.attemptReconnect = function () {
        var _this = this;
        this.reconnectAttempts++;
        console.log("Reconnection attempt ".concat(this.reconnectAttempts, "/").concat(this.MAX_RECONNECT_ATTEMPTS));
        if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
            console.log('Max reconnection attempts reached. Reloading page...');
            // Add a small delay before reloading to allow for console message
            setTimeout(function () {
                window.location.reload();
            }, 1000);
            return;
        }
        // Try to reconnect after delay
        setTimeout(function () {
            if (_this.socket) {
                _this.socket.connect();
            }
        }, this.RECONNECT_DELAY);
    };
    Game.prototype.updateLighting = function (config) {
        // Update ambient light
        this.ambientLight.color.setHex(config.ambientLight.color);
        this.ambientLight.intensity = config.ambientLight.intensity;
        // Update directional light
        this.directionalLight.color.setHex(config.directionalLight.color);
        this.directionalLight.intensity = config.directionalLight.intensity;
        this.directionalLight.position.set(config.directionalLight.position.x, config.directionalLight.position.y, config.directionalLight.position.z);
        // Update hemisphere light
        this.hemisphereLight.color.setHex(config.hemisphereLight.skyColor);
        this.hemisphereLight.groundColor.setHex(config.hemisphereLight.groundColor);
        this.hemisphereLight.intensity = config.hemisphereLight.intensity;
    };
    Game.prototype.getCollectedPetals = function () {
        return this.collectedPetals;
    };
    Game.prototype.isRarityTintingEnabled = function () {
        return this.settings.rarityTinting;
    };
    Game.prototype.createSettingsButton = function () {
        var _this = this;
        var settingsButton = document.createElement('button');
        settingsButton.textContent = '⚙️';
        settingsButton.style.position = 'fixed';
        settingsButton.style.top = '20px';
        settingsButton.style.left = '20px';
        settingsButton.style.padding = '10px';
        settingsButton.style.fontSize = '24px';
        settingsButton.style.backgroundColor = '#2196F3';
        settingsButton.style.border = 'none';
        settingsButton.style.borderRadius = '5px';
        settingsButton.style.color = 'white';
        settingsButton.style.cursor = 'pointer';
        settingsButton.style.zIndex = '1000';
        settingsButton.addEventListener('click', function () { return _this.toggleSettingsMenu(); });
        document.body.appendChild(settingsButton);
    };
    Game.prototype.createSettingsMenu = function () {
        var _this = this;
        this.settingsMenu = document.createElement('div');
        var menu = this.settingsMenu;
        // Style the menu
        menu.style.position = 'fixed';
        menu.style.top = '20px';
        menu.style.right = '20px';
        menu.style.width = '200px';
        menu.style.backgroundColor = '#77ea65';
        menu.style.padding = '15px';
        menu.style.borderRadius = '10px';
        menu.style.display = 'none';
        menu.style.zIndex = '1000';
        menu.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.5)';
        // Add title
        var title = document.createElement('h2');
        title.textContent = 'Settings';
        title.style.textAlign = 'left';
        title.style.marginBottom = '15px';
        title.style.fontSize = '18px';
        title.style.color = 'white';
        menu.appendChild(title);
        // Create settings container
        var settingsContainer = document.createElement('div');
        settingsContainer.style.display = 'flex';
        settingsContainer.style.flexDirection = 'column';
        settingsContainer.style.gap = '10px';
        // Add rarity tinting toggle
        var rarityTintingContainer = document.createElement('div');
        rarityTintingContainer.style.display = 'flex';
        rarityTintingContainer.style.alignItems = 'center';
        rarityTintingContainer.style.gap = '10px';
        var rarityTintingLabel = document.createElement('label');
        rarityTintingLabel.textContent = 'Rarity Tinting';
        rarityTintingLabel.style.color = 'white';
        rarityTintingLabel.htmlFor = 'rarity-tinting';
        var rarityTintingToggle = document.createElement('input');
        rarityTintingToggle.type = 'checkbox';
        rarityTintingToggle.id = 'rarity-tinting';
        rarityTintingToggle.checked = this.settings.rarityTinting;
        // Add change event listener
        rarityTintingToggle.onchange = function () {
            _this.settings.rarityTinting = rarityTintingToggle.checked;
            // Immediately update all petal colors
            _this.updateAllPetalColors();
            // Update inventory previews
            if (_this.isInventoryOpen) {
                _this.updateInventoryDisplay();
            }
            // Update crafting previews if open
            if (_this.isCraftingOpen) {
                _this.updateCraftingDisplay();
            }
        };
        rarityTintingContainer.appendChild(rarityTintingLabel);
        rarityTintingContainer.appendChild(rarityTintingToggle);
        settingsContainer.appendChild(rarityTintingContainer);
        menu.appendChild(settingsContainer);
        document.body.appendChild(menu);
    };
    Game.prototype.toggleSettingsMenu = function () {
        var _this = this;
        if (!this.settingsMenu) {
            this.createSettingsMenu();
        }
        this.isSettingsOpen = !this.isSettingsOpen;
        if (this.settingsMenu) {
            this.settingsMenu.style.display = this.isSettingsOpen ? 'block' : 'none';
            // Get the checkbox
            var rarityTintingCheckbox_1 = this.settingsMenu.querySelector('#rarity-tinting');
            if (rarityTintingCheckbox_1) {
                // Update the setting when checkbox changes
                rarityTintingCheckbox_1.onchange = function () {
                    _this.settings.rarityTinting = rarityTintingCheckbox_1.checked;
                    // Immediately update all petal colors
                    _this.updateAllPetalColors();
                    // Update inventory previews
                    if (_this.isInventoryOpen) {
                        _this.updateInventoryDisplay();
                    }
                    // Update crafting previews if open
                    if (_this.isCraftingOpen) {
                        _this.updateCraftingDisplay();
                    }
                };
            }
        }
    };
    Game.prototype.updateAllPetalColors = function () {
        var _this = this;
        var _a;
        // Update inventory slots
        var inventorySlots = document.querySelectorAll('[id^="inventory-slot-"]');
        inventorySlots.forEach(function (slot) {
            var petalType = slot.getAttribute('data-type');
            if (petalType && petal_1.PETAL_STATS[petalType]) {
                var stats = petal_1.PETAL_STATS[petalType];
                // Basic petals should never be tinted
                if (petalType === types_1.PetalType.BASIC) {
                    slot.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
                }
                else {
                    var color = _this.settings.rarityTinting ?
                        "rgba(".concat((types_1.RARITY_COLORS[stats.rarity] >> 16) & 255, ", ").concat((types_1.RARITY_COLORS[stats.rarity] >> 8) & 255, ", ").concat(types_1.RARITY_COLORS[stats.rarity] & 255, ", 0.2)") :
                        'rgba(255, 255, 255, 0.2)';
                    slot.style.backgroundColor = color;
                }
            }
        });
        // Update crafting slots if crafting menu exists
        if (this.craftingMenu) {
            var craftingSlots = document.querySelectorAll('[id^="crafting-slot-"]');
            craftingSlots.forEach(function (slot) {
                var petalType = slot.getAttribute('data-petal-type');
                if (petalType && petal_1.PETAL_STATS[petalType]) {
                    var stats = petal_1.PETAL_STATS[petalType];
                    // Basic petals should never be tinted
                    if (petalType === types_1.PetalType.BASIC) {
                        slot.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
                    }
                    else {
                        var color = _this.settings.rarityTinting ?
                            "rgba(".concat((types_1.RARITY_COLORS[stats.rarity] >> 16) & 255, ", ").concat((types_1.RARITY_COLORS[stats.rarity] >> 8) & 255, ", ").concat(types_1.RARITY_COLORS[stats.rarity] & 255, ", 0.2)") :
                            'rgba(255, 255, 255, 0.2)';
                        slot.style.backgroundColor = color;
                    }
                }
            });
        }
        // Update equipped petals if player inventory exists
        if ((_a = this.socket) === null || _a === void 0 ? void 0 : _a.id) {
            var inventory = this.playerInventories.get(this.socket.id);
            if (inventory) {
                inventory.getPetals().forEach(function (petal) {
                    if (petal.getType() !== types_1.PetalType.BASIC) {
                        var stats = petal_1.PETAL_STATS[petal.getType()];
                        var color = _this.settings.rarityTinting ? types_1.RARITY_COLORS[stats.rarity] : 0xffffff;
                        petal.updateColor(color);
                    }
                });
            }
        }
    };
    Game.prototype.createCraftingMenu = function () {
        var _this = this;
        if (this.craftingMenu) {
            document.body.removeChild(this.craftingMenu);
        }
        this.craftingMenu = document.createElement('div');
        var menu = this.craftingMenu;
        // Style the menu for bottom left corner
        menu.style.position = 'fixed';
        menu.style.bottom = '20px';
        menu.style.left = '20px'; // Position in bottom left
        menu.style.width = '300px';
        menu.style.backgroundColor = '#77ea65'; // Match inventory color
        menu.style.padding = '15px';
        menu.style.borderRadius = '10px';
        menu.style.display = 'none';
        menu.style.zIndex = '1000';
        menu.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.5)';
        // Add title
        var title = document.createElement('h2');
        title.textContent = 'Crafting';
        title.style.textAlign = 'left';
        title.style.marginBottom = '15px';
        title.style.fontSize = '18px';
        title.style.color = 'white';
        menu.appendChild(title);
        // Create grid container for crafting slots
        var grid = document.createElement('div');
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = 'repeat(5, 1fr)';
        grid.style.gap = '8px';
        grid.style.marginBottom = '15px';
        menu.appendChild(grid);
        // Create 5 crafting slots
        for (var i = 0; i < 5; i++) {
            var slot = document.createElement('div');
            slot.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
            slot.style.padding = '5px';
            slot.style.borderRadius = '5px';
            slot.style.cursor = 'pointer';
            slot.style.position = 'relative';
            slot.style.height = '50px';
            slot.style.border = '2px solid rgba(255, 255, 255, 0.3)';
            grid.appendChild(slot);
        }
        // Add craft button
        var craftButton = document.createElement('button');
        craftButton.textContent = 'Craft';
        craftButton.style.width = '100%';
        craftButton.style.padding = '10px';
        craftButton.style.backgroundColor = '#4CAF50';
        craftButton.style.color = 'white';
        craftButton.style.border = 'none';
        craftButton.style.borderRadius = '5px';
        craftButton.style.cursor = 'pointer';
        craftButton.style.marginTop = '10px';
        craftButton.style.fontSize = '16px';
        craftButton.onclick = function () { return _this.attemptCraft(); };
        menu.appendChild(craftButton);
        document.body.appendChild(menu);
    };
    Game.prototype.attemptCraft = function () {
        var _this = this;
        var _a, _b, _c;
        if (!this.craftingSystem || !this.socket)
            return;
        // Get crafting slots from the UI
        var grid = (_a = this.craftingMenu) === null || _a === void 0 ? void 0 : _a.querySelector('div:nth-child(2)');
        if (!grid)
            return;
        // Get all petal types in crafting slots
        var petalTypes = Array.from(grid.children)
            .map(function (slot) { return slot.getAttribute('data-petal-type'); })
            .filter(function (type) { return type !== null && Object.values(types_1.PetalType).includes(type); });
        // Check if we have 5 of the same type
        if (petalTypes.length !== 5 || !petalTypes.every(function (type) { return type === petalTypes[0]; })) {
            console.log('You need 5 of the same petal type to craft!');
            return;
        }
        // Determine the upgrade path
        var basePetalType = petalTypes[0];
        var upgradedType = null;
        switch (basePetalType) {
            case types_1.PetalType.BASIC:
                upgradedType = types_1.PetalType.BASIC_UNCOMMON;
                break;
            case types_1.PetalType.BASIC_UNCOMMON:
                upgradedType = types_1.PetalType.BASIC_RARE;
                break;
            case types_1.PetalType.TETRAHEDRON:
                upgradedType = types_1.PetalType.TETRAHEDRON_EPIC;
                break;
            case types_1.PetalType.CUBE:
                upgradedType = types_1.PetalType.CUBE_LEGENDARY;
                break;
            default:
                console.log('This petal type cannot be upgraded!');
                return;
        }
        if (upgradedType) {
            // Remove the used petals
            petalTypes.forEach(function (petal) {
                var _a;
                (_a = _this.socket) === null || _a === void 0 ? void 0 : _a.emit('inventoryUpdate', {
                    type: petal,
                    action: 'remove'
                });
            });
            // Add the crafted item
            (_b = this.socket) === null || _b === void 0 ? void 0 : _b.emit('inventoryUpdate', {
                type: upgradedType,
                action: 'add'
            });
            // Save the inventory state
            var playerInventory = this.playerInventories.get(((_c = this.socket) === null || _c === void 0 ? void 0 : _c.id) || '');
            if (playerInventory) {
                playerInventory.savePetals();
            }
            // Clear crafting slots
            Array.from(grid.children).forEach(function (slot) {
                slot.innerHTML = '';
                slot.removeAttribute('data-petal-type');
            });
            // Update displays
            this.updateCraftingDisplay();
            this.updateInventoryDisplay();
        }
    };
    Game.prototype.updateCraftingDisplay = function () {
        var _this = this;
        var _a;
        if (!this.craftingMenu || !((_a = this.socket) === null || _a === void 0 ? void 0 : _a.id))
            return;
        // Get the grid container
        var grid = this.craftingMenu.querySelector('div:nth-child(2)');
        if (!grid)
            return;
        // Clear all slots first
        Array.from(grid.children).forEach(function (slot) {
            slot.innerHTML = '';
            // Create preview container
            var previewContainer = document.createElement('div');
            previewContainer.style.width = '100%';
            previewContainer.style.height = '100%';
            previewContainer.style.display = 'flex';
            previewContainer.style.justifyContent = 'center';
            previewContainer.style.alignItems = 'center';
            slot.appendChild(previewContainer);
            // Add drop functionality
            slot.ondragover = function (e) {
                e.preventDefault();
                slot.style.backgroundColor = 'rgba(255, 255, 255, 0.4)';
            };
            slot.ondragleave = function () {
                slot.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
            };
            slot.ondrop = function (e) {
                var _a;
                e.preventDefault();
                slot.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
                var petalType = (_a = e.dataTransfer) === null || _a === void 0 ? void 0 : _a.getData('petalType');
                if (petalType) {
                    _this.addPetalToCraftingSlot(petalType, Array.from(grid.children).indexOf(slot));
                }
            };
        });
    };
    Game.prototype.addPetalToCraftingSlot = function (petalType, slotIndex) {
        if (!this.craftingMenu)
            return;
        // Find and remove one petal of this type from collected petals
        var petalIndex = this.collectedPetals.findIndex(function (p) { return p === petalType; });
        if (petalIndex !== -1) {
            this.collectedPetals.splice(petalIndex, 1);
            // Add preview to crafting slot
            var grid = this.craftingMenu.querySelector('div:nth-child(2)');
            if (!grid)
                return;
            var slot = grid.children[slotIndex];
            if (!slot)
                return;
            var preview = this.inventoryPreviews.get(petalType);
            if (preview) {
                var renderer = preview.renderer;
                var container = slot.querySelector('div');
                if (container) {
                    container.innerHTML = '';
                    container.appendChild(renderer.domElement.cloneNode(true));
                }
            }
            // Store the petal type in the slot's data
            slot.setAttribute('data-petal-type', petalType);
        }
        // Update both displays
        this.updateCraftingDisplay();
        if (this.isInventoryOpen) {
            this.updateInventoryDisplay();
        }
    };
    return Game;
}());
exports.Game = Game;
// Start the game
new Game();
//# sourceMappingURL=game.js.map