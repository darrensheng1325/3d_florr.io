import * as THREE from 'three';
import { io, Socket } from 'socket.io-client';
import playerSvg from './player.svg';
import { Petal, PETAL_STATS } from './petal';
import { HealthBar } from './health';
import { Enemy } from './enemy';
import { Inventory, PetalSlot } from './inventory';
import { WaveUI } from './waves';
import { Item, ItemType } from './item';
import { PetalType, Rarity, RARITY_COLORS, EnemyType, LightingConfig, CollisionPlaneConfig, WaveStartData } from '../shared/types';
import { CraftingSystem } from './crafting';
import { ServerConfig } from '../server/server_config';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { AccountManager } from './account';
import { CollisionManager } from './managers/CollisionManager';
import { SceneManager } from './managers/SceneManager';
import { UIManager } from './managers/UIManager';
import { NetworkManager } from './managers/NetworkManager';

const MAP_SIZE = 15;  // Match server's map size

export class Game {
    private sceneManager: SceneManager;
    private uiManager: UIManager;
    private networkManager: NetworkManager;
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private socket: Socket | null = null;
    private inventorySlotRenderers: THREE.WebGLRenderer[] = [];
    private inventorySlotScenes: THREE.Scene[] = [];
    private inventorySlotCameras: THREE.PerspectiveCamera[] = [];
    private inventorySlotContainers: HTMLDivElement[] = [];
    private waveUI: WaveUI;
    private currentWave: number = 1;
    private enemiesKilled: number = 0;
    private totalXP: number = 0;
    private readonly ENEMIES_PER_WAVE = 20;
    private readonly XP_PER_WAVE = 1000;
    public players: Map<string, THREE.Mesh>;
    private playersBeingCreated: Set<string> = new Set(); // Track players being created
    private cameraRotation: number = 0;
    private ground: THREE.Mesh;
    private gridHelper: THREE.GridHelper;
    private textureLoader: THREE.TextureLoader;
    private playerInventories: Map<string, Inventory> = new Map();
    private enemies: Map<string, Enemy> = new Map();
    private playerHealthBars: Map<string, HealthBar> = new Map();
    private playerVelocities: Map<string, THREE.Vector3> = new Map();
    private isGameStarted: boolean = false;
    private titleCanvas: HTMLCanvasElement;
    private titleCtx: CanvasRenderingContext2D;
    private accountManager: AccountManager;
    private isInventoryOpen: boolean = false;
    private collectedPetals: PetalType[] = [];
    private craftingSystem: CraftingSystem | null = null;
    private items: Map<string, Item> = new Map();
    private pressedKeys: Set<string> = new Set();
    private inventoryMenu: HTMLDivElement | null = null;
    private inventoryPreviews: Map<PetalType, { 
        scene: THREE.Scene, 
        camera: THREE.PerspectiveCamera, 
        renderer: THREE.WebGLRenderer,
        mesh: THREE.Mesh | THREE.Group 
    }> = new Map();
    private isSettingsOpen: boolean = false;
    private settings = {
        rarityTinting: true
    };
    private craftingMenu: HTMLDivElement | null = null;
    private isCraftingOpen: boolean = false;
    private settingsMenu: HTMLDivElement | null = null;
    private moveSpeed: number = 0.05;
    private mapSize: number = 15;
    private lastFrameTime: number = 0;
    private readonly targetFPS: number = 60;
    private readonly frameInterval: number = 1000 / 60;
    private deathScreen: HTMLDivElement | null = null;
    private lastHealTime: number = 0;
    private readonly HEAL_INTERVAL: number = 1000; // Heal every second
    private readonly HEAL_AMOUNT: number = 5;      // Heal 5 health per tick
    private reconnectAttempts: number = 0;
    private readonly MAX_RECONNECT_ATTEMPTS = 3;
    private readonly RECONNECT_DELAY = 2000; // 2 seconds
    private ambientLight: THREE.AmbientLight;
    private directionalLight: THREE.DirectionalLight;
    private hemisphereLight: THREE.HemisphereLight;
    private collisionManager: CollisionManager;

    constructor() {
        this.accountManager = new AccountManager();
        this.sceneManager = new SceneManager(MAP_SIZE);
        this.networkManager = new NetworkManager(this.accountManager);
        this.scene = this.sceneManager.scene;
        this.camera = this.sceneManager.camera;
        this.renderer = this.sceneManager.renderer;
        this.uiManager = new UIManager(
            this.accountManager, 
            this.renderer, 
            this.camera, 
            this.scene,
            () => this.isGameStarted,
            () => this.respawnPlayer()
        );
        this.players = new Map();
        this.textureLoader = new THREE.TextureLoader();
        this.waveUI = new WaveUI();
        this.collisionManager = new CollisionManager(this.scene);
        const title = document.createElement('title');
        title.textContent = '3dflower.io | title screen';
        document.head.appendChild(title);

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
        
        const ctx = this.titleCanvas.getContext('2d');
        if (!ctx) throw new Error('Could not get 2D context');
        this.titleCtx = ctx;

        // Create inventory container
        const inventoryContainer = document.createElement('div');
        inventoryContainer.style.position = 'absolute';
        inventoryContainer.style.bottom = '20px';
        inventoryContainer.style.left = '50%';
        inventoryContainer.style.transform = 'translateX(-50%)';
        inventoryContainer.style.display = 'flex';
        inventoryContainer.style.gap = '10px';
        inventoryContainer.style.justifyContent = 'center';
        document.body.appendChild(inventoryContainer);

        // Create inventory slots
        for (let i = 0; i < 5; i++) {
            // Create container for this slot
            const slotContainer = document.createElement('div');
            slotContainer.style.width = '80px';
            slotContainer.style.height = '80px';
            slotContainer.style.position = 'relative';
            slotContainer.style.border = '2px solid black';
            slotContainer.style.borderRadius = '10px';
            inventoryContainer.appendChild(slotContainer);
            this.inventorySlotContainers.push(slotContainer);

            // Create renderer
            const renderer = new THREE.WebGLRenderer({ alpha: true });
            renderer.setSize(80, 80);
            renderer.setClearColor(0x000000, 0);
            slotContainer.appendChild(renderer.domElement);
            this.inventorySlotRenderers.push(renderer);

            // Create scene
            const scene = new THREE.Scene();
            scene.background = null;
            this.inventorySlotScenes.push(scene);

            // Create camera
            const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
            camera.position.set(0, 0, 3);
            camera.lookAt(0, 0, 0);
            this.inventorySlotCameras.push(camera);

            // Add lighting
            const ambientLight = new THREE.AmbientLight(0xffffff, 1);
            scene.add(ambientLight);
            const pointLight = new THREE.PointLight(0xffffff, 1.0);
            pointLight.position.set(2, 2, 2);
            scene.add(pointLight);

            // Add slot number
            const numberDiv = document.createElement('div');
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
        const groundGeometry = new THREE.PlaneGeometry(MAP_SIZE * 2, MAP_SIZE * 2);
        const groundMaterial = new THREE.MeshPhongMaterial({
            color: ServerConfig.getInstance().getCurrentConfig().hemisphereLight.groundColor,
            side: THREE.DoubleSide,
            shininess: 0  // Make it matte
        });
        this.ground = new THREE.Mesh(groundGeometry, groundMaterial);
        this.ground.rotation.x = -Math.PI / 2;
        this.ground.position.y = 0;
        this.scene.add(this.ground);

        this.init();
        
        // Initialize spectator connection for title screen
        this.networkManager.initializeSpectatorConnection();
        this.socket = this.networkManager.socket;

        // Setup wave events
        this.setupWaveEvents();

        // Setup server connection monitoring
        this.setupConnectionMonitoring();

        // Create settings button
        this.createSettingsButton();
        this.setupNetworkListeners();
    }

    private setupNetworkListeners(): void {
        this.networkManager.on('playerJoined', (data) => {
            console.log('[DEBUG] playerJoined event received:', data);
            console.log('[DEBUG] Current socket ID:', this.socket?.id);
            console.log('[DEBUG] Is game started:', this.isGameStarted);
            console.log('[DEBUG] Current players count:', this.players.size);
            
            if (!this.isGameStarted && data.id !== this.socket?.id) {
                console.log('[DEBUG] Creating player for spectator mode:', data.id);
                this.createPlayer(data.id);
            } else {
                console.log('[DEBUG] Skipping player creation - game started or same socket ID');
            }
        });
        
        this.networkManager.on('playerLeft', (playerId) => {
            console.log('[DEBUG] playerLeft event received:', playerId);
            const player = this.players.get(playerId);
            if (player) {
                console.log('[DEBUG] Removing player from scene:', playerId);
                this.scene.remove(player);
                this.players.delete(playerId);
            } else {
                console.log('[DEBUG] Player not found for removal:', playerId);
            }
        });

        this.networkManager.on('playerMoved', (data) => {
            const player = this.players.get(data.id);
            if (player) {
                player.position.set(data.position.x, data.position.y, data.position.z);
            }
        });
        
        this.networkManager.on('gameConnect', (data) => {
            console.log('[DEBUG] gameConnect event received:', data);
            console.log('[DEBUG] Current players before gameConnect:', Array.from(this.players.keys()));
            
            if (data.id) {
                console.log('[DEBUG] Creating player for game mode:', data.id);
                this.createPlayer(data.id);
                this.playerVelocities.set(data.id, new THREE.Vector3());
            }
        });
        
        this.networkManager.on('lightingConfig', (config: LightingConfig) => {
            this.sceneManager.updateLighting(config);
            this.collisionManager.clearCollisionPlanes();
            config.collisionPlanes.forEach((planeData: CollisionPlaneConfig) => {
                this.addCollisionPlane(
                    planeData.x,
                    planeData.y,
                    planeData.z,
                    planeData.width,
                    planeData.height,
                    planeData.rotationX,
                    planeData.rotationY,
                    planeData.rotationZ,
                    planeData.type || 'wall'
                );
            });
        });
        
        this.networkManager.on('configUpdate', (config) => {
            this.sceneManager.updateLighting(config);
            this.updateTerrainPlaneColors(config.hemisphereLight.groundColor);
            // Update grid color if gridConfig is present
            if (config.gridConfig && this.gridHelper) {
                // Remove old grid helper
                this.scene.remove(this.gridHelper);
                // Create new grid helper with updated color
                this.gridHelper = new THREE.GridHelper(30, 30, config.gridConfig.gridColor, config.gridConfig.gridColor);
                this.gridHelper.position.y = 0.01;
                this.scene.add(this.gridHelper);
            }
        });

        this.networkManager.on('playerDamaged', (data) => {
            const socketId = this.socket?.id;
            if (socketId && socketId === data.id) {
                const healthBar = this.playerHealthBars.get(socketId);
                if (healthBar) {
                    const isDead = healthBar.takeDamage(10);
                    // if (isDead) {
                    //     if (this.socket) {
                    //         this.socket.emit('playerDied'); // tell server that player died
                    //         this.socket.disconnect(); // disconnect from server
                    //     }
                    //     this.uiManager.showDeathScreen();
                    // }
                }
            }
        });

        this.networkManager.on('playerDeathSequence', (data) => {
            console.log('Player death sequence:', data);
            if (this.socket?.id === data.id) {
                // Properly remove all game objects from the scene
                this.enemies.forEach(enemy => {
                    enemy.remove();
                });
                this.enemies.clear();
                
                this.items.forEach(item => {
                    item.remove();
                });
                this.items.clear();
                
                // Clear the scene of all spectator elements
                console.log('[DEBUG] Clearing spectator players...');
                this.players.forEach((player, id) => {
                    console.log('[DEBUG] Removing spectator player:', id);
                    this.scene.remove(player);
                });
                this.players.clear();
                this.playersBeingCreated.clear(); // Also clear players being created
                console.log('[DEBUG] Players after cleanup:', this.players.size);
                
                this.playerInventories.forEach(inventory => {
                    inventory.clear();
                });
                this.playerInventories.clear();
                
                this.playerHealthBars.forEach(healthBar => {
                    healthBar.remove();
                });
                this.playerHealthBars.clear();
                
                this.playerVelocities.clear();
                this.waveUI.hide();
                
                // Show death screen and disconnect
                this.uiManager.showDeathScreen();
                this.socket?.disconnect();
            }
        });

        this.networkManager.on('enemySpawned', (data) => {
            const enemy = new Enemy(
                this.scene,
                new THREE.Vector3(data.position.x, data.position.y, data.position.z),
                this.camera,
                data.type as EnemyType,
                data.id,
                data.health,
                data.isAggressive,
                data.rarity
            );
            this.enemies.set(data.id, enemy);
        });

        this.networkManager.on('enemyMoved', (data) => {
            const enemy = this.enemies.get(data.id);
            if (enemy) {
                enemy.updatePosition(data.position, data.rotation);
            }
        });

        this.networkManager.on('enemyDied', (data) => {
            const enemy = this.enemies.get(data.enemyId);
            if (enemy) {
                enemy.remove();
                this.enemies.delete(data.enemyId);
                this.enemiesKilled++;
                this.waveUI.update(this.currentWave, this.enemiesKilled, this.totalXP, undefined, undefined);

                if (data.enemyType !== 'worker_ant') {
                    const dropResult = this.determinePetalDrop(data.enemyRarity);
                    if (dropResult.shouldDrop) {
                        const inventory = this.playerInventories.get(this.socket?.id || '');
                        if (inventory) {
                            const slots = inventory.getSlots();
                            const emptySlotIndex = slots.findIndex(slot => slot.petal === null);
                            if (emptySlotIndex !== -1) {
                                inventory.addPetal(dropResult.petalType, emptySlotIndex);
                            }
                        }
                    }
                }

                if (data.enemyType === 'worker_ant') {
                    const itemId = `item_${data.enemyId}`;
                    const item = new Item(
                        this.scene,
                        new THREE.Vector3(data.position.x, data.position.y, data.position.z),
                        ItemType.LEAF,
                        itemId
                    );
                    this.items.set(itemId, item);
                } else if (data.itemType) {
                    const itemId = `item_${data.enemyId}`;
                    const item = new Item(
                        this.scene,
                        new THREE.Vector3(data.position.x, data.position.y, data.position.z),
                        data.itemType as ItemType,
                        itemId
                    );
                    this.items.set(itemId, item);
                }
            }
        });

        this.networkManager.on('disconnect', (reason) => {
            console.log('Disconnected from server:', reason);
            if (reason === 'io server disconnect' || reason === 'transport close') {
                this.attemptReconnect();
            }
        });

        this.networkManager.on('connect_error', (error) => {
            console.log('Connection error:', error);
            this.attemptReconnect();
        });

        this.networkManager.on('connect', () => {
            console.log('Connected to server');
            this.reconnectAttempts = 0;
        });
    }
    
    private determinePetalDrop(enemyRarity: Rarity): { shouldDrop: boolean; dropRarity: Rarity; petalType: PetalType } {
        // 50% chance to drop a petal
        if (Math.random() > 0.5) {
            return { shouldDrop: false, dropRarity: Rarity.COMMON, petalType: PetalType.BASIC };
        }

        let dropRarity: Rarity;
        if (enemyRarity === Rarity.COMMON) {
            // Common mobs have 30% chance to drop uncommon
            dropRarity = Math.random() < 0.3 ? Rarity.UNCOMMON : Rarity.COMMON;
        } else {
            // For other rarities: 30% chance to drop same rarity, 70% chance to drop one rarity below
            const dropSameRarity = Math.random() < 0.3;
            dropRarity = dropSameRarity ? enemyRarity : Object.values(Rarity)[Object.values(Rarity).indexOf(enemyRarity) - 1];
        }

        // Determine petal type based on rarity
        let possibleTypes: PetalType[] = [];
        switch (dropRarity) {
            case Rarity.LEGENDARY:
                possibleTypes = [PetalType.CUBE_LEGENDARY];
                break;
            case Rarity.EPIC:
                possibleTypes = [PetalType.TETRAHEDRON_EPIC];
                break;
            case Rarity.RARE:
                possibleTypes = [PetalType.BASIC_RARE];
                break;
            case Rarity.UNCOMMON:
                possibleTypes = [PetalType.BASIC_UNCOMMON];
                break;
            default:
                possibleTypes = [PetalType.BASIC, PetalType.TETRAHEDRON, PetalType.CUBE];
        }

        const randomType = possibleTypes[Math.floor(Math.random() * possibleTypes.length)];
        return { shouldDrop: true, dropRarity, petalType: randomType };
    }

    private setupEnemyEvents(): void {
        // This is now handled by the network manager listeners
    }

    private setupSpectatorEvents(): void {
        // This is now handled by the network manager listeners
    }

    private async handleStartGame(): Promise<void> {
        if (this.isGameStarted) return;

        // Check if user has stored credentials
        if (!this.accountManager.hasAccount()) {
            // No stored credentials, show login screen
            try {
                const { accountId, username } = await this.accountManager.showLoginIfNeeded();
                console.log(`Logged in as: ${username} (${accountId})`);
                // After successful login, proceed with game start
                this.startGameAfterLogin();
            } catch (error) {
                console.error('Login failed:', error);
                return;
            }
        } else {
            // User has stored credentials, start game directly
            this.startGameAfterLogin();
        }
    }

    private startGameAfterLogin(): void {
        if (this.isGameStarted) return;

        console.log('[DEBUG] Starting game after login');
        console.log('[DEBUG] Players before cleanup:', Array.from(this.players.keys()));
        console.log('[DEBUG] Players count before cleanup:', this.players.size);

        this.isGameStarted = true;
        
        this.uiManager.clearTitleScreen();

        // Remove title from document head
        const title = document.querySelector('title');
        if (title) {
            document.head.removeChild(title);
        }

        // Update title
        const newTitle = document.createElement('title');
        newTitle.textContent = `3dflower.io | ${this.accountManager.getUsername()}`;
        document.head.appendChild(newTitle);

        // Show wave UI
        this.waveUI.show();

        // Clear the scene of all spectator elements
        console.log('[DEBUG] Clearing spectator players...');
        this.players.forEach((player, id) => {
            console.log('[DEBUG] Removing spectator player:', id);
            this.scene.remove(player);
        });
        this.players.clear();
        this.playersBeingCreated.clear(); // Also clear players being created
        console.log('[DEBUG] Players after cleanup:', this.players.size);
        
        this.enemies.forEach((enemy) => {
            enemy.remove();
        });
        this.enemies.clear();
        
        // Properly clear all inventories and their petals
        this.playerInventories.forEach((inventory) => {
            inventory.clear();
        });
        this.playerInventories.clear();
        
        this.playerHealthBars.forEach((healthBar) => {
            healthBar.remove();
        });
        this.playerHealthBars.clear();
        
        // Clear items
        this.items.forEach(item => {
            item.remove();
        });
        this.items.clear();
        
        console.log('[DEBUG] Disconnecting spectator socket...');
        this.socket?.disconnect();
        
        // Clear the renderer
        this.renderer.clear();
        
        // Reconnect to server to get a fresh connection with actual account
        console.log('[DEBUG] Connecting with account:', this.accountManager.getAccountId());
        this.networkManager.connectWithAccount(this.accountManager.getAccountId());
        this.socket = this.networkManager.socket;

        // Setup game scene
        this.setupGame();
    }

    private setupGame(): void {
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
    }

    private init(): void {
        // Create and show title screen
        this.uiManager.createTitleScreen(() => this.handleStartGame());
    }

    private addCollisionPlane(x: number, y: number, z: number, width: number, height: number, rotationX: number = 0, rotationY: number = 0, rotationZ: number = 0, type: 'wall' | 'terrain' = 'wall'): void {
        const geometry = new THREE.PlaneGeometry(width, height);
        let material: THREE.MeshPhongMaterial;
        
        if (type === 'terrain') {
            // Enhanced terrain material with better lighting and visibility
            const baseColor = ServerConfig.getInstance().getCurrentConfig().hemisphereLight.groundColor;
            
            // Make terrain slightly darker and more saturated than ground
            const color = new THREE.Color(baseColor);
            color.multiplyScalar(0.8); // Make it 20% darker
            color.offsetHSL(0, 0.2, 0); // Increase saturation by 20%
            
            material = new THREE.MeshPhongMaterial({
                color: color,
                side: THREE.DoubleSide,
                shininess: 30,        // Add some shininess for directional lighting
                specular: 0x222222,   // Subtle specular highlights
                transparent: false,   // Make it fully opaque
                flatShading: false,   // Use smooth shading for better lighting
                // Add normal map effect by adjusting how light interacts
                bumpScale: 0.1
            });
            
            // Add subtle wireframe overlay for better edge definition
            const wireframeGeometry = new THREE.EdgesGeometry(geometry);
            const wireframeMaterial = new THREE.LineBasicMaterial({ 
                color: 0x444444, 
                transparent: true, 
                opacity: 0.3 
            });
            const wireframe = new THREE.LineSegments(wireframeGeometry, wireframeMaterial);
            
            const plane = new THREE.Mesh(geometry, material);
            
            // Apply rotations in order: X, Y, Z
            plane.rotation.x = rotationX * Math.PI / 180;
            plane.rotation.y = rotationY * Math.PI / 180;
            plane.rotation.z = rotationZ * Math.PI / 180;
            
            plane.position.set(x, y, z);
            plane.userData = { type }; // Store the type in userData
            
            // Apply same rotation to wireframe
            wireframe.rotation.copy(plane.rotation);
            wireframe.position.copy(plane.position);
            
            // Add both plane and wireframe to scene
            this.scene.add(wireframe);
            this.collisionManager.addCollisionPlane(plane, type);
            
            return;
        } else {
            material = new THREE.MeshPhongMaterial({
            color: 0x808080,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.5
        });
        }
        
        const plane = new THREE.Mesh(geometry, material);
        
        // Apply rotations in order: X, Y, Z
        plane.rotation.x = rotationX * Math.PI / 180;
        plane.rotation.y = rotationY * Math.PI / 180;
        plane.rotation.z = rotationZ * Math.PI / 180;
        
        plane.position.set(x, y, z);
        plane.userData = { type }; // Store the type in userData
        
        this.collisionManager.addCollisionPlane(plane, type);
    }

    private checkCollisionPlanes(position: THREE.Vector3, radius: number = 0.5): { collided: boolean; normal?: THREE.Vector3; type?: 'wall' | 'terrain'; terrainHeight?: number } {
        // Check wall collisions first
        for (const plane of this.collisionManager.getCollisionPlanes()) {
            const collision = this.checkSinglePlaneCollision(plane, position, radius);
            if (collision.collided) {
                return { ...collision, type: 'wall' };
            }
        }
        
        // Check terrain collisions
        for (const plane of this.collisionManager.getTerrainPlanes()) {
            // Check for walking on top of terrain
            const terrainCollision = this.checkTerrainCollision(plane, position, radius);
            if (terrainCollision.collided) {
                return { ...terrainCollision, type: 'terrain' };
            }
            
            // Check for bumping into terrain from below or sides (as a wall)
            const wallCollision = this.checkSinglePlaneCollision(plane, position, radius);
            if (wallCollision.collided) {
                const planeNormal = new THREE.Vector3(0, 0, 1).applyQuaternion(plane.quaternion);
                
                // If the collision normal is opposite to the plane's "up" direction,
                // it means we are hitting it from underneath.
                if (wallCollision.normal!.dot(planeNormal) > 0.1) {
                    return { ...wallCollision, type: 'wall' };
                }
            }
        }
        
        return { collided: false };
    }
    
    private checkSinglePlaneCollision(plane: THREE.Mesh, position: THREE.Vector3, radius: number): { collided: boolean; normal?: THREE.Vector3 } {
        // Get plane's world transform
            const planePosition = new THREE.Vector3();
            plane.getWorldPosition(planePosition);
        const worldQuaternion = new THREE.Quaternion();
        plane.getWorldQuaternion(worldQuaternion);

        // The default normal for PlaneGeometry is (0, 0, 1). Transform it to world space.
        const planeNormal = new THREE.Vector3(0, 0, 1).applyQuaternion(worldQuaternion);

        // Calculate distance from sphere center to the infinite plane
            const distance = planeNormal.dot(position.clone().sub(planePosition));

        // If the sphere is too far from the plane, no collision
            if (Math.abs(distance) > radius) {
            return { collided: false };
            }

        // Project sphere center onto the plane to find the closest point on the infinite plane
        const projectedPoint = position.clone().sub(planeNormal.clone().multiplyScalar(distance));

        // Transform the projected point to the plane's local space to check against its finite bounds
        const localPoint = plane.worldToLocal(projectedPoint.clone());

        // Get plane dimensions. PlaneGeometry is in the XY plane in local space.
            const planeWidth = (plane.geometry as THREE.PlaneGeometry).parameters.width;
            const planeHeight = (plane.geometry as THREE.PlaneGeometry).parameters.height;
            const halfWidth = planeWidth / 2;
            const halfHeight = planeHeight / 2;

        // Find the closest point on the plane's rectangle to the local projected point
            const closestX = Math.max(-halfWidth, Math.min(halfWidth, localPoint.x));
        const closestY = Math.max(-halfHeight, Math.min(halfHeight, localPoint.y));
        const closestPointLocal = new THREE.Vector3(closestX, closestY, 0);

        // Transform this closest point from local back to world space
        const closestPointWorld = plane.localToWorld(closestPointLocal.clone());

        // Calculate the distance from the sphere's center to this closest point on the rectangle
        const distanceToClosest = position.distanceTo(closestPointWorld);

        // If the distance is less than the sphere's radius, there is a collision.
            if (distanceToClosest <= radius) {
            // The collision normal is the vector from the closest point on the rectangle to the sphere's center.
            const normal = position.clone().sub(closestPointWorld).normalize();
            return { collided: true, normal };
        }
        
        return { collided: false };
    }
    
    private checkTerrainCollision(plane: THREE.Mesh, position: THREE.Vector3, radius: number): { collided: boolean; normal?: THREE.Vector3; terrainHeight?: number } {
        // Get plane's world transform
        const planePosition = new THREE.Vector3();
        plane.getWorldPosition(planePosition);
        const worldQuaternion = new THREE.Quaternion();
        plane.getWorldQuaternion(worldQuaternion);
        const planeNormal = new THREE.Vector3(0, 0, 1).applyQuaternion(worldQuaternion);

        // Transform player position to plane's local space
        const localPlayerPos = plane.worldToLocal(position.clone());

        // Get plane dimensions. PlaneGeometry is in the XY plane in local space.
        const planeWidth = (plane.geometry as THREE.PlaneGeometry).parameters.width;
        const planeHeight = (plane.geometry as THREE.PlaneGeometry).parameters.height;
        const halfWidth = planeWidth / 2;
        const halfHeight = planeHeight / 2;

        // Check if player is within the plane's horizontal bounds
        if (localPlayerPos.x >= -halfWidth && localPlayerPos.x <= halfWidth &&
            localPlayerPos.y >= -halfHeight && localPlayerPos.y <= halfHeight) {
            
            // Calculate the world height at this position on the terrain
            const terrainPointLocal = new THREE.Vector3(localPlayerPos.x, localPlayerPos.y, 0);
            const terrainPointWorld = plane.localToWorld(terrainPointLocal);
            const targetHeight = terrainPointWorld.y + radius;
            
            // Player is inside the vertical bounds of the plane.
            // Check if player is at or above the terrain surface.
            if (position.y >= targetHeight - radius) { // Check from below
                // If the player is on top of the terrain, we should adjust their height
                if (position.y < targetHeight + 0.2) {
                    return { 
                        collided: true, 
                        terrainHeight: targetHeight,
                        normal: new THREE.Vector3(0, 1, 0)
                    };
                }
            }
        }
        
        return { collided: false };
    }

    private animate(): void {
        if (!this.isGameStarted) return;

        const currentTime = Date.now();
        const elapsed = currentTime - this.lastFrameTime;

        if (elapsed > this.frameInterval) {
            this.lastFrameTime = currentTime - (elapsed % this.frameInterval);

            // Update player movement
            this.updatePlayerMovement();

            // Update all petals
            this.playerInventories.forEach(inventory => {
                inventory.getPetals().forEach(petal => petal.update());
            });

            // Update all items
            this.items.forEach(item => item.update());

            // Check petal collisions
            this.checkPetalCollisions();

            // Check enemy collisions with player
            this.checkEnemyCollisions();

            // Check item collisions with player
            this.checkItemCollisions();

            // Update health regeneration
            this.updateHealthRegeneration();

            // Update health bars
            this.playerHealthBars.forEach(healthBar => healthBar.updatePosition());

            // Update camera
            this.updateCameraPosition();

            // Render inventory UI
            this.renderInventoryUI();

            // Render game scene
            this.renderer.render(this.scene, this.camera);
        }

        requestAnimationFrame(() => this.animate());
    }

    private updateHealthRegeneration(): void {
        const socketId = this.socket?.id;
        if (!socketId) return;

        const currentTime = Date.now();
        
        // Natural health regeneration
        if (currentTime - this.lastHealTime >= this.HEAL_INTERVAL) {
            const healthBar = this.playerHealthBars.get(socketId);
            if (healthBar) {
                healthBar.heal(this.HEAL_AMOUNT);
            }
            this.lastHealTime = currentTime;
        }

        // Leaf petal passive healing
        const inventory = this.playerInventories.get(socketId);
        if (inventory) {
            const slots = inventory.getSlots();
            slots.forEach(slot => {
                if (slot.petal?.getType() === PetalType.LEAF && !slot.petal.isBrokenState()) {
                    const healthBar = this.playerHealthBars.get(socketId);
                    if (healthBar) {
                        healthBar.heal(0.1); // Passive healing from leaf petal
                    }
                }
            });
        }
    }

    private createPlayer(playerId: string): void {
        console.log('[DEBUG] createPlayer called for:', playerId);
        console.log('[DEBUG] Current socket ID:', this.socket?.id);
        console.log('[DEBUG] Player already exists:', this.players.has(playerId));
        console.log('[DEBUG] Player being created:', this.playersBeingCreated.has(playerId));
        
        if (this.players.has(playerId) || this.playersBeingCreated.has(playerId)) {
            console.log('[DEBUG] Player already exists or is being created, skipping creation');
            return;
        }

        // Mark this player as being created
        this.playersBeingCreated.add(playerId);

        // Create a sphere for the player
        const geometry = new THREE.SphereGeometry(0.5, 32, 32);
        
        // Load the SVG texture
        this.textureLoader.load(playerSvg, (texture) => {
            console.log('[DEBUG] Texture loaded for player:', playerId);
            
            // Check if player was removed while texture was loading
            if (!this.playersBeingCreated.has(playerId)) {
                console.log('[DEBUG] Player was removed while texture was loading, aborting creation');
                return;
            }
            
            // Configure texture to prevent stretching
            texture.wrapS = THREE.ClampToEdgeWrapping;
            texture.wrapT = THREE.ClampToEdgeWrapping;
            
            // Adjust UV mapping to maintain aspect ratio
            const uvAttribute = geometry.attributes.uv;
            const positions = geometry.attributes.position;
            
            for (let i = 0; i < uvAttribute.count; i++) {
                const u = uvAttribute.getX(i);
                const v = uvAttribute.getY(i);
                
                // Map UV coordinates to center the texture
                const newU = (u - 0.5) + 0.5;
                const newV = (v - 0.5) + 0.5;
                uvAttribute.setXY(i, newU, newV);
            }
            uvAttribute.needsUpdate = true;
            
            // Create a shader material with increased saturation
            const material = new THREE.ShaderMaterial({
                uniforms: {
                    map: { value: texture },
                    saturation: { value: 1.2 } // Saturation multiplier (1.0 is normal)
                },
                vertexShader: `
                    varying vec2 vUv;
                    void main() {
                        vUv = uv;
                        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                    }
                `,
                fragmentShader: `
                    uniform sampler2D map;
                    uniform float saturation;
                    varying vec2 vUv;

                    void main() {
                        vec4 texColor = texture2D(map, vUv);
                        
                        // Convert to grayscale
                        float gray = dot(texColor.rgb, vec3(0.299, 0.587, 0.114));
                        
                        // Mix between gray and color based on saturation
                        vec3 saturated = mix(vec3(gray), texColor.rgb, saturation);
                        
                        gl_FragColor = vec4(saturated, texColor.a);
                    }
                `,
                transparent: true,
                side: THREE.DoubleSide
            });

            const player = new THREE.Mesh(geometry, material);
            player.position.y = 0.5;
            
            // Rotate the sphere 90 degrees to the right around the Y axis
            player.rotateY(Math.PI / 2);
            
            console.log('[DEBUG] Adding player to scene:', playerId);
            this.scene.add(player);
            this.players.set(playerId, player);
            
            // Remove from being created set
            this.playersBeingCreated.delete(playerId);
            
            console.log('[DEBUG] Total players after creation:', this.players.size);

            // Add health bar with camera reference
            const healthBar = new HealthBar(this.camera, player);
            this.playerHealthBars.set(playerId, healthBar);

            // Create inventory with default petals
            const inventory = new Inventory(this.scene, player);
            for (let i = 0; i < 5; i++) {
                inventory.addPetal(PetalType.BASIC, i);
            }
            this.playerInventories.set(playerId, inventory);

            // Initialize crafting system if this is the local player
            if (playerId === this.socket?.id) {
                console.log('[DEBUG] Creating crafting system for local player');
                this.craftingSystem = new CraftingSystem(this.scene, player, this);
            }
        });
    }

    private setupMouseControls(): void {
        let isDragging = false;
        let previousMousePosition = { x: 0, y: 0 };

        document.addEventListener('mousedown', (event) => {
            isDragging = true;
            previousMousePosition = {
                x: event.clientX,
                y: event.clientY
            };
        });

        document.addEventListener('mousemove', (event) => {
            if (!isDragging) return;

            const deltaMove = {
                x: event.clientX - previousMousePosition.x,
            };

            if (deltaMove.x != 0) {
                this.cameraRotation += deltaMove.x * 0.01;
            }

            previousMousePosition = {
                x: event.clientX,
                y: event.clientY
            };
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
        });
    }

    private updateCameraPosition(): void {
        if (!this.socket?.id) return;
        const player = this.players.get(this.socket.id);
        if (!player) return;

        // Calculate camera position based on player position and rotation
        const distance = 10;
        const height = 5;
        const x = player.position.x + Math.sin(this.cameraRotation) * distance;
        const z = player.position.z + Math.cos(this.cameraRotation) * distance;

        this.camera.position.set(x, height, z);
        this.camera.lookAt(player.position);
    }

    private setupSocketEvents(): void {
        if (!this.socket) return;

        this.socket.on('connect', () => {
            console.log('[DEBUG] Socket connected in game mode');
            console.log('[DEBUG] Socket ID:', this.socket?.id);
            
            if (this.socket?.id) {
                console.log('[DEBUG] Creating player on game connect:', this.socket.id);
                this.createPlayer(this.socket.id);
                this.playerVelocities.set(this.socket.id, new THREE.Vector3());

                // Request lighting configuration from server
                this.socket.emit('requestLightingConfig');
            }
        });

        // Add lighting configuration handler
        this.socket.on('lightingConfig', (config: LightingConfig) => {
            console.log('Received lighting config from server:', config);
            this.sceneManager.updateLighting(config);
            
            this.collisionManager.clearCollisionPlanes();

            // Add collision planes from config
            console.log('Adding collision planes:', config.collisionPlanes);
            config.collisionPlanes.forEach(planeData => {
                console.log('Creating collision plane:', planeData);
                this.addCollisionPlane(
                    planeData.x,
                    planeData.y,
                    planeData.z,
                    planeData.width,
                    planeData.height,
                    planeData.rotationX,
                    planeData.rotationY,
                    planeData.rotationZ,
                    planeData.type || 'wall'
                );
            });
        });

        // Add item spawn event handler
        this.socket.on('itemSpawned', (data: { id: string, type: string, position: { x: number, y: number, z: number } }) => {
            const item = new Item(
                this.scene,
                new THREE.Vector3(data.position.x, data.position.y, data.position.z),
                data.type as ItemType,
                data.id
            );
            this.items.set(data.id, item);
        });

        // Add enemy damage event handler
        this.socket.on('enemyDamaged', (data: { enemyId: string, damage: number, health: number }) => {
            const enemy = this.enemies.get(data.enemyId);
            if (enemy) {
                enemy.takeDamage(data.damage);
            }
        });

        this.socket.on('playerJoined', (data: { id: string, position: { x: number, y: number, z: number }, xp: number }) => {
            console.log('[DEBUG] playerJoined in setupSocketEvents:', data);
            console.log('[DEBUG] Is game started:', this.isGameStarted);
            console.log('[DEBUG] Current socket ID:', this.socket?.id);
            
            if (this.isGameStarted) {
                console.log('[DEBUG] Creating player in game mode:', data.id);
                this.createPlayer(data.id);
            } else {
                console.log('[DEBUG] Skipping player creation - game not started');
            }
        });

        this.socket.on('playerLeft', (playerId: string) => {
            console.log('[DEBUG] playerLeft in setupSocketEvents:', playerId);
            const player = this.players.get(playerId);
            if (player) {
                console.log('[DEBUG] Removing player from game mode:', playerId);
                this.scene.remove(player);
                this.players.delete(playerId);
                
                // Remove petals
                const inventory = this.playerInventories.get(playerId);
                if (inventory) {
                    inventory.clear();
                    this.playerInventories.delete(playerId);
                }
            }
        });

        this.socket.on('playerMoved', (data: { id: string, position: { x: number, y: number, z: number } }) => {
            const player = this.players.get(data.id);
            if (player) {
                player.position.set(data.position.x, data.position.y, data.position.z);
            }
        });

        // Setup enemy events
        this.setupEnemyEvents();

        // Wave and XP events
        this.socket.on('waveStart', (data: WaveStartData) => {
            // Clear all existing enemies
            this.enemies.forEach(enemy => {
                enemy.remove();
            });
            this.enemies.clear();

            // Reset wave stats
            this.currentWave = data.wave;
            this.enemiesKilled = 0;
            this.totalXP = 0;
            this.waveUI.update(this.currentWave, this.enemiesKilled, this.totalXP, data.minRarity, data.isNight);
        });

        this.socket.on('playerXP', (data: { id: string, xp: number }) => {
            if (this.socket?.id === data.id) {
                this.totalXP = data.xp % this.XP_PER_WAVE;
                this.waveUI.update(this.currentWave, this.enemiesKilled, this.totalXP, undefined, undefined);
            }
        });

        this.socket?.on('configUpdate', (config: any) => {
            this.sceneManager.updateLighting(config);
            // Update terrain plane colors to match ground
            this.updateTerrainPlaneColors(config.hemisphereLight.groundColor);
            // Update grid color if gridConfig is present
            if (config.gridConfig && this.gridHelper) {
                // Remove old grid helper
                this.scene.remove(this.gridHelper);
                // Create new grid helper with updated color
                this.gridHelper = new THREE.GridHelper(30, 30, config.gridConfig.gridColor, config.gridConfig.gridColor);
                this.gridHelper.position.y = 0.01;
                this.scene.add(this.gridHelper);
            }
        });

        // Handle account sync
        this.socket.on('accountSync', (data: {
            totalXP: number;
            highestWave: number;
            stats: any;
            inventory: {
                petals: Array<{
                    type: string;
                    slotIndex: number;
                    rarity: string;
                    health: number;
                }>;
                collectedItems: Array<{
                    type: string;
                    amount: number;
                }>;
            };
        }) => {
            console.log('Received account sync:', data);
            
            // Update account data
            this.totalXP = data.totalXP;
            
            // Load inventory data
            if (this.socket?.id) {
                let inventory = this.playerInventories.get(this.socket.id);
                if (!inventory) {
                    inventory = new Inventory(this.scene, this.players.get(this.socket.id)!);
                    this.playerInventories.set(this.socket.id, inventory);
                }

                // Load petals
                data.inventory.petals.forEach(petal => {
                    inventory?.addPetal(petal.type as PetalType, petal.slotIndex);
                });

                // Store collected items - repeat each type by its amount
                this.collectedPetals = data.inventory.collectedItems.flatMap(item => 
                    Array(item.amount).fill(item.type as PetalType)
                );
                
                // Update UI if inventory is open
                if (this.isInventoryOpen) {
                    this.updateInventoryDisplay();
                }
            }
        });

        // Handle inventory sync
        this.socket.on('inventorySync', (data: {
            petals: Array<{
                type: string;
                slotIndex: number;
                rarity: string;
                health: number;
            }>;
            collectedItems: Array<{
                type: string;
                amount: number;
            }>;
        }) => {
            console.log('Received inventory sync:', data);
            
            if (this.socket?.id) {
                let inventory = this.playerInventories.get(this.socket.id);
                if (!inventory) {
                    inventory = new Inventory(this.scene, this.players.get(this.socket.id)!);
                    this.playerInventories.set(this.socket.id, inventory);
                }

                // Load petals
                data.petals.forEach(petal => {
                    inventory?.addPetal(petal.type as PetalType, petal.slotIndex);
                });

                // Store collected items - repeat each type by its amount
                this.collectedPetals = data.collectedItems.flatMap(item => 
                    Array(item.amount).fill(item.type as PetalType)
                );
                
                // Update UI if inventory is open
                if (this.isInventoryOpen) {
                    this.updateInventoryDisplay();
                }
            }
        });

        // Handle item collection confirmation
        this.socket.on('itemCollectionConfirmed', (data: {
            type: string;
            rarity: string;
            inventory: {
                petals: Array<{
                    type: string;
                    slotIndex: number;
                    rarity: string;
                    health: number;
                }>;
                collectedItems: Array<{
                    type: string;
                    amount: number;
                }>;
            };
        }) => {
            console.log('Item collection confirmed:', data);
            
            if (this.socket?.id) {
                // Update collected items - repeat each type by its amount
                this.collectedPetals = data.inventory.collectedItems.flatMap(item => 
                    Array(item.amount).fill(item.type as PetalType)
                );
                
                // Update UI if inventory is open
                if (this.isInventoryOpen) {
                    this.updateInventoryDisplay();
                }
            }
        });

        // Handle inventory update confirmation
        this.socket.on('inventoryUpdateConfirmed', (data: {
            petals: Array<{
                type: string;
                slotIndex: number;
                rarity: string;
                health: number;
            }>;
            collectedItems: Array<{
                type: string;
                amount: number;
            }>;
        }) => {
            console.log('Inventory update confirmed:', data);
            
            if (this.socket?.id) {
                let inventory = this.playerInventories.get(this.socket.id);
                if (inventory) {
                    // Update petals
                    inventory.clear();
                    data.petals.forEach(petal => {
                        inventory?.addPetal(petal.type as PetalType, petal.slotIndex);
                    });

                    // Update collected items - repeat each type by its amount
                    this.collectedPetals = data.collectedItems.flatMap(item => 
                        Array(item.amount).fill(item.type as PetalType)
                    );
                    
                    // Update UI if inventory is open
                    if (this.isInventoryOpen) {
                        this.updateInventoryDisplay();
                    }
                }
            }
        });
    }

    private setupControls(): void {
        document.addEventListener('keydown', (event) => {
            if (!this.socket?.id) return;
            this.pressedKeys.add(event.key);
            
            const player = this.players.get(this.socket.id);
            const inventory = this.playerInventories.get(this.socket.id);
            if (!player || !inventory) return;

            // Handle petal expansion with space key
            if (event.code === 'Space') {
                inventory.expandPetals();
            }

            // Toggle inventory menu with Z key
            if (event.code === 'KeyZ') {
                this.toggleInventoryMenu();
            }

            // Toggle crafting menu with C key
            if (event.code === 'KeyC' && this.craftingSystem) {
                this.craftingSystem.toggleVisibility();
            }
        });

        document.addEventListener('keyup', (event) => {
            if (!this.socket?.id) return;
            this.pressedKeys.delete(event.key);
            
            if (event.code === 'Space') {
                const inventory = this.playerInventories.get(this.socket.id);
                if (inventory) {
                    inventory.contractPetals();
                }
            }
        });
    }

    private updatePlayerMovement(): void {
        if (!this.socket?.id) return;
        
        const player = this.players.get(this.socket.id);
        if (!player) return;

        const movement = { x: 0, z: 0 };
        let direction = 0;
        let isMoving = false;

        // Calculate movement based on pressed keys
        if (this.pressedKeys.has('w') || this.pressedKeys.has('ArrowUp')) {
            movement.x -= Math.sin(this.cameraRotation);
            movement.z -= Math.cos(this.cameraRotation);
            direction = Math.PI/2;
            isMoving = true;
        }
        if (this.pressedKeys.has('s') || this.pressedKeys.has('ArrowDown')) {
            movement.x += Math.sin(this.cameraRotation);
            movement.z += Math.cos(this.cameraRotation);
            direction = Math.PI * 3/2;
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
            const length = Math.sqrt(movement.x * movement.x + movement.z * movement.z);
            movement.x /= length;
            movement.z /= length;
        }

        // Calculate new position
        const newX = player.position.x + movement.x * this.moveSpeed;
        const newZ = player.position.z + movement.z * this.moveSpeed;

        // Create a test position vector
        const testPosition = new THREE.Vector3(newX, player.position.y, newZ);

        // Check collision planes and handle different types
        const collision = this.collisionManager.checkCollisionPlanes(testPosition);
        
        if (collision.collided && collision.type === 'terrain' && collision.terrainHeight !== undefined) {
            // For terrain: move the player and adjust height
            player.position.x = newX;
            player.position.z = newZ;
            player.position.y = collision.terrainHeight;
        } else if (collision.collided && (collision.type === 'wall' || collision.type === 'terrain') && collision.normal) {
            // For walls or terrain hit from below: handle sliding
            const movementVector = new THREE.Vector3(movement.x, 0, movement.z);
            const normal = collision.normal;
            
            // Calculate sliding direction by removing normal component
            const normalComponent = movementVector.dot(normal);
            const slidingVector = movementVector.clone().sub(normal.clone().multiplyScalar(normalComponent));
            
            // Normalize sliding vector and apply movement
            if (slidingVector.length() > 0.001) {
                slidingVector.normalize();
                const slideX = player.position.x + slidingVector.x * this.moveSpeed;
                const slideZ = player.position.z + slidingVector.z * this.moveSpeed;
                
                // Test sliding movement for additional collisions
                const slideTestPosition = new THREE.Vector3(slideX, player.position.y, slideZ);
                const slideCollision = this.collisionManager.checkCollisionPlanes(slideTestPosition);
                
                if (!slideCollision.collided || slideCollision.type === 'terrain') {
                    player.position.x = slideX;
                    player.position.z = slideZ;
                    
                    // If we hit terrain while sliding, adjust height
                    if (slideCollision.collided && slideCollision.type === 'terrain' && slideCollision.terrainHeight !== undefined) {
                        player.position.y = slideCollision.terrainHeight;
                    } else {
                        // Check if we're still on terrain at the new position
                        const terrainCheck = this.collisionManager.checkCollisionPlanes(new THREE.Vector3(slideX, player.position.y, slideZ));
                        if (terrainCheck.collided && terrainCheck.type === 'terrain' && terrainCheck.terrainHeight !== undefined) {
                            player.position.y = terrainCheck.terrainHeight;
                        } else {
            player.position.y = 0.5;
                        }
                    }
                } else {
                    // Can't slide, check if we're still on terrain
                    const terrainCheck = this.collisionManager.checkCollisionPlanes(new THREE.Vector3(player.position.x, player.position.y, player.position.z));
                    if (terrainCheck.collided && terrainCheck.type === 'terrain' && terrainCheck.terrainHeight !== undefined) {
                        player.position.y = terrainCheck.terrainHeight;
                    } else {
                        player.position.y = 0.5;
                    }
                }
            } else {
                // Can't move, check if we're still on terrain
                const terrainCheck = this.collisionManager.checkCollisionPlanes(new THREE.Vector3(player.position.x, player.position.y, player.position.z));
                if (terrainCheck.collided && terrainCheck.type === 'terrain' && terrainCheck.terrainHeight !== undefined) {
                    player.position.y = terrainCheck.terrainHeight;
                } else {
                    player.position.y = 0.5;
                }
            }
        } else {
            // No collision: move normally
            player.position.x = newX;
            player.position.z = newZ;
            
            // Check if we're standing on terrain at the new position
            const terrainCheck = this.collisionManager.checkCollisionPlanes(new THREE.Vector3(newX, player.position.y, newZ));
            if (terrainCheck.collided && terrainCheck.type === 'terrain' && terrainCheck.terrainHeight !== undefined) {
                player.position.y = terrainCheck.terrainHeight;
            } else {
                // If not on terrain, fall to ground level
                player.position.y = 0.5;
            }
        }

            // Update player rotation based on movement direction
            if (isMoving) {
                const angle = Math.atan2(movement.x, movement.z);
                player.rotation.y = angle - Math.PI/2;
            }

            // Emit position to server
            this.socket.emit('move', {
                x: player.position.x,
                y: player.position.y,
                z: player.position.z
            });
    }

    private onWindowResize(): void {
        if (this.titleCanvas) {
            this.titleCanvas.width = window.innerWidth;
            this.titleCanvas.height = window.innerHeight;
        }
    }

    private checkPetalCollisions(): void {
        if (!this.socket?.id) return;
        
        const inventory = this.playerInventories.get(this.socket.id);
        if (!inventory) return;

        // Use all petals instead of just active ones
        const petals = inventory.getPetals();
        this.enemies.forEach((enemy) => {
            petals.forEach(petal => {
                if (petal.isBrokenState()) return;  // Skip broken petals
                
                const petalPosition = petal.getPosition();
                const enemyPosition = enemy.getPosition();
                const distance = petalPosition.distanceTo(enemyPosition);
                
                if (distance < 1.2) {
                    // Calculate knockback direction
                    const knockbackDir = new THREE.Vector3()
                        .subVectors(enemyPosition, petalPosition)
                        .normalize();

                    // Calculate damage based on petal type
                    let damage = 5; // Base damage
                    if (petal.getType() === PetalType.STINGER) {
                        damage *= 5; // Stinger does 5x damage
                    }

                    // Send damage event to server
                    this.socket?.emit('enemyDamaged', {
                        enemyId: enemy.getId(),
                        damage: damage,
                        knockback: { x: knockbackDir.x, z: knockbackDir.z }
                    });

                    // Make petal take damage on collision
                    petal.takeDamage(10);  // Petals take 10 damage per hit
                }
            });
        });
    }

    private checkEnemyCollisions(): void {
        if (!this.socket?.id) return;
        
        const player = this.players.get(this.socket.id);
        if (!player) return;

        this.enemies.forEach((enemy) => {
            const enemyPosition = enemy.getPosition();
            const playerPosition = player.position;
            const distance = enemyPosition.distanceTo(playerPosition);
            
            // If enemy is touching player's center
            if (distance < 1.0) {
                // Send damage event to server
                this.socket?.emit('playerDamaged', {
                    damage: 10
                });
            }
        });
    }

    private checkItemCollisions(): void {
        if (!this.socket?.id) return;
        
        const player = this.players.get(this.socket.id);
        if (!player) return;

        this.items.forEach((item, itemId) => {
            const itemPosition = item.getPosition();
            const playerPosition = player.position;
            const distance = itemPosition.distanceTo(playerPosition);
            
            // If player touches item
            if (distance < 1.0) {
                // Convert item type to petal type
                const petalType = item.getType() === ItemType.TETRAHEDRON ? PetalType.TETRAHEDRON :
                                item.getType() === ItemType.LEAF ? PetalType.LEAF :
                                item.getType() === ItemType.STINGER ? PetalType.STINGER :
                                item.getType() === ItemType.PEA ? PetalType.PEA :
                                PetalType.CUBE;
                this.collectedPetals.push(petalType);

                // Update inventory display if open
                if (this.isInventoryOpen) {
                    this.updateInventoryDisplay();
                }

                // Remove item
                item.remove();
                this.items.delete(itemId);
            }
        });
    }

    private renderInventoryUI(): void {
        if (!this.socket?.id) return;
        const inventory = this.playerInventories.get(this.socket.id);
        if (!inventory) return;

        const slots = inventory.getSlots();
        
        slots.forEach((slot, index) => {
            if (index >= this.inventorySlotRenderers.length) return;

            const scene = this.inventorySlotScenes[index];
            const camera = this.inventorySlotCameras[index];
            const renderer = this.inventorySlotRenderers[index];
            const container = this.inventorySlotContainers[index];

            // Update container style based on active state
            container.style.backgroundColor = slot.isActive ? 'rgba(255, 107, 107, 0.2)' : 'rgba(255, 255, 255, 0.2)';
            container.style.cursor = 'pointer';  // Add cursor pointer

            // Add click handler to the container
            container.onclick = () => {
                if (!this.socket?.id) return;
                const inventory = this.playerInventories.get(this.socket.id);
                if (!inventory || !slot.petal) return;

                // Get the petal type before removing it
                const petalType = slot.petal.getType();
                
                // Remove the petal from the slot
                inventory.removePetal(index);
                
                // Add it back to collected petals
                this.collectedPetals.push(petalType);
                
                // Update inventory display if open
                if (this.isInventoryOpen) {
                    this.updateInventoryDisplay();
                }
            };

            // Clear previous petal preview if any
            while (scene.children.length > 2) { // Keep lights (ambient and point)
                scene.remove(scene.children[2]);
            }

            // Update or create petal name text
            let nameText = container.querySelector('.petal-name') as HTMLDivElement | null;
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
                let healthBar = container.querySelector('.petal-health') as HTMLDivElement | null;
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

                    const healthFill = document.createElement('div');
                    healthFill.style.height = '100%';
                    healthFill.style.width = '100%';
                    healthFill.style.backgroundColor = '#2ecc71';
                    healthFill.style.borderRadius = '2px';
                    healthFill.style.transition = 'width 0.2s ease-out';
                    healthBar.appendChild(healthFill);
                }

                // Update health bar
                const healthFill = healthBar.firstChild as HTMLDivElement;
                if (slot.petal.isBrokenState()) {
                    healthFill.style.width = '0%';
                    healthFill.style.backgroundColor = '#e74c3c';
                    container.style.opacity = '0.5';
                } else {
                    const healthPercent = slot.petal.getHealthPercent();
                    healthFill.style.width = `${healthPercent}%`;
                    healthFill.style.backgroundColor = healthPercent > 50 ? '#2ecc71' : '#e74c3c';
                    container.style.opacity = '1';
                }

                // Create a preview petal mesh using a sphere
                const geometry = new THREE.SphereGeometry(0.4, 32, 32);
                const material = new THREE.MeshBasicMaterial({ 
                    color: 0xffffff,
                    opacity: slot.petal.isBrokenState() ? 0.3 : 1.0,
                    transparent: true
                });
                const petalMesh = new THREE.Mesh(geometry, material);
                scene.add(petalMesh);

                // Rotate the preview petal
                const time = Date.now() * 0.0005;
                petalMesh.rotation.x = time * 0.5;
                petalMesh.rotation.y = time;
            }

            // Render the slot
            renderer.render(scene, camera);
        });
    }

    private setupWaveEvents(): void {
        if (!this.socket) return;

        this.socket.on('waveStart', (data: WaveStartData) => {
            this.currentWave = data.wave;
            this.enemiesKilled = 0;
            this.totalXP = 0;
            this.waveUI.update(this.currentWave, this.enemiesKilled, this.totalXP, data.minRarity, data.isNight);
        });

        this.socket.on('playerXP', (data: { id: string, xp: number }) => {
            if (this.socket?.id === data.id) {
                this.totalXP = data.xp % this.XP_PER_WAVE;
                this.waveUI.update(this.currentWave, this.enemiesKilled, this.totalXP);
            }
        });
    }

    private createDeathScreen(): void {
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
        const deathText = document.createElement('div');
        deathText.textContent = 'You Died';
        deathText.style.color = '#ff0000';
        deathText.style.fontSize = '64px';
        deathText.style.fontFamily = 'Arial, sans-serif';
        deathText.style.fontWeight = 'bold';
        deathText.style.marginBottom = '30px';
        this.deathScreen.appendChild(deathText);

        // Add continue button
        const continueButton = document.createElement('button');
        continueButton.textContent = 'Return to Title';
        continueButton.style.padding = '15px 30px';
        continueButton.style.fontSize = '24px';
        continueButton.style.backgroundColor = '#4CAF50';
        continueButton.style.color = 'white';
        continueButton.style.border = 'none';
        continueButton.style.borderRadius = '5px';
        continueButton.style.cursor = 'pointer';
        continueButton.style.transition = 'background-color 0.3s';
        
        continueButton.addEventListener('mouseover', () => {
            continueButton.style.backgroundColor = '#45a049';
        });
        
        continueButton.addEventListener('mouseout', () => {
            continueButton.style.backgroundColor = '#4CAF50';
        });
        
        continueButton.addEventListener('click', () => {
            this.respawnPlayer();
        });
        
        this.deathScreen.appendChild(continueButton);
    }

    public respawnPlayer(): void {
        this.socket?.disconnect();
        // Set title to back to spectating
        const title = document.querySelector('title');
        if (title) {
            title.textContent = '3dflower.io | title screen';
        }

        // Properly clean up all game objects
        this.enemies.forEach(enemy => {
            enemy.remove();
        });
        this.enemies.clear();
        
        this.items.forEach(item => {
            item.remove();
        });
        this.items.clear();
        
        // Clear the scene of all spectator elements
        console.log('[DEBUG] Clearing spectator players...');
        this.players.forEach((player, id) => {
            console.log('[DEBUG] Removing spectator player:', id);
            this.scene.remove(player);
        });
        this.players.clear();
        this.playersBeingCreated.clear(); // Also clear players being created
        console.log('[DEBUG] Players after cleanup:', this.players.size);
        
        this.playerInventories.forEach(inventory => {
            inventory.clear();
        });
        this.playerInventories.clear();

        this.playerHealthBars.forEach(healthBar => {
            healthBar.remove();
        });
        this.playerHealthBars.clear();

        this.uiManager.hideDeathScreen();

        // Stop the game
        this.isGameStarted = false;
        
        // Reconnect for spectating with temporary spectator ID
        this.networkManager.initializeSpectatorConnection();
        this.socket = this.networkManager.socket;

        // Reset camera for spectating
        this.camera.position.set(0, 15, 0);
        this.camera.lookAt(0, 0, 0);

        // Recreate and show title screen
        this.uiManager.createTitleScreen(() => this.handleStartGame());

        // Hide wave UI
        this.waveUI.hide();
    }

    private createInventoryMenu(): void {
        this.inventoryMenu = document.createElement('div');
        const menu = this.inventoryMenu;
        
        // Style the menu for bottom left corner
        menu.style.position = 'fixed';
        menu.style.bottom = '20px';
        menu.style.left = '20px';  // Ensure it's using left positioning
        menu.style.width = '300px';
        menu.style.backgroundColor = '#589ad4';
        menu.style.padding = '15px';
        menu.style.borderRadius = '10px';
        menu.style.display = 'none';
        menu.style.zIndex = '1000';
        menu.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.5)';

        // Add title
        const title = document.createElement('h2');
        title.textContent = 'Inventory';
        title.style.textAlign = 'left';
        title.style.marginBottom = '15px';
        title.style.fontSize = '18px';
        title.style.color = 'white';
        menu.appendChild(title);

        // Create grid container for petals
        const grid = document.createElement('div');
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = 'repeat(4, 1fr)';
        grid.style.gap = '8px';
        menu.appendChild(grid);

        // Create preview renderers for each petal type
        Object.values(PetalType).forEach(type => {
            const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
            renderer.setSize(50, 50);
            renderer.setClearColor(0x000000, 0);

            const scene = new THREE.Scene();
            const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
            camera.position.set(0, 0, 3);
            camera.lookAt(0, 0, 0);

            // Add lighting
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
            scene.add(ambientLight);
            const pointLight = new THREE.PointLight(0xffffff, 1.0);
            pointLight.position.set(2, 2, 2);
            scene.add(pointLight);

            // Create preview mesh based on type
            if (type === PetalType.LEAF) {
                // Use the same GLTFLoader and model as the Item class
                const modelLoader = new GLTFLoader();
                modelLoader.load('leaf.glb', (gltf) => {
                    const leafMesh = gltf.scene;
                    leafMesh.scale.set(0.3, 0.3, 0.3);
                    scene.add(leafMesh);
                    
                    // Store renderer, scene, camera, and mesh for updates
                    this.inventoryPreviews.set(type, {
                        renderer,
                        scene,
                        camera,
                        mesh: leafMesh
                    });
                });
            } else {
            let geometry: THREE.BufferGeometry;
            let material: THREE.Material;

            switch (type) {
                case PetalType.TETRAHEDRON:
                    case PetalType.TETRAHEDRON_EPIC:
                    geometry = new THREE.TetrahedronGeometry(0.8);
                    material = new THREE.MeshBasicMaterial({ 
                        color: 0xff0000,
                    });
                    break;
                case PetalType.CUBE:
                    case PetalType.CUBE_LEGENDARY:
                    geometry = new THREE.BoxGeometry(0.8, 0.8, 0.8);
                    material = new THREE.MeshBasicMaterial({ 
                        color: 0x0000ff,
                    });
                    break;
                    case PetalType.PEA:
                        // Load the pea model for inventory preview
                        const modelLoader = new GLTFLoader();
                        modelLoader.load('peas.glb', (gltf) => {
                            const peaMesh = gltf.scene;
                            peaMesh.scale.set(0.15, 0.15, 0.15);
                            
                            // Add green tint to all meshes in the model
                            peaMesh.traverse((child) => {
                                if (child instanceof THREE.Mesh) {
                                    child.material = new THREE.MeshPhongMaterial({
                                        color: 0x90EE90,
                                        shininess: 30
                                    });
                                }
                            });
                            
                            scene.add(peaMesh);
                            
                            // Store renderer, scene, camera, and mesh for updates
                            this.inventoryPreviews.set(type, {
                                renderer,
                                scene,
                                camera,
                                mesh: peaMesh
                            });
                        });
                        return; // Return early as model loading is async
                    case PetalType.STINGER:
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

            const mesh = new THREE.Mesh(geometry, material);
            scene.add(mesh);

            // Store renderer, scene, camera, and mesh for updates
            this.inventoryPreviews.set(type, {
                renderer,
                scene,
                camera,
                mesh
            });
            }
        });

        document.body.appendChild(menu);
    }

    private toggleInventoryMenu(): void {
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
    }

    private updateInventoryDisplay(): void {
        if (!this.inventoryMenu || !this.socket?.id) return;

        // Clear existing grid
        const grid = this.inventoryMenu.querySelector('div:nth-child(2)');
        if (!grid) return;
        grid.innerHTML = '';

        // Group petals by type
        const groupedPetals = this.collectedPetals.reduce((acc, type) => {
            acc.set(type, (acc.get(type) || 0) + 1);
            return acc;
        }, new Map<PetalType, number>());

        // Add each group to the grid
        groupedPetals.forEach((count, petalType) => {
            const slot = document.createElement('div');
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
            const rarity = PETAL_STATS[petalType as PetalType].rarity;
            const rarityColor = this.settings.rarityTinting ? 
                '#' + RARITY_COLORS[rarity].toString(16).padStart(6, '0') : 
                'rgba(255, 255, 255, 0.2)';
            slot.style.backgroundColor = rarityColor;
            slot.style.border = this.settings.rarityTinting ? 
                `2px solid ${rarityColor}` : 
                '2px solid rgba(255, 255, 255, 0.3)';

            // Create canvas container
            const canvasContainer = document.createElement('div');
            canvasContainer.style.width = '100%';
            canvasContainer.style.height = '100%';
            slot.appendChild(canvasContainer);

            // Add count badge
            const countBadge = document.createElement('div');
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
            const rarityLabel = document.createElement('div');
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
            const preview = this.inventoryPreviews.get(petalType);
            if (preview) {
                const { renderer, scene, camera, mesh } = preview;
                canvasContainer.appendChild(renderer.domElement);

                // Start rendering the preview
                const animate = () => {
                    if (!this.isInventoryOpen) return;
                    mesh.rotation.x += 0.02;
                    mesh.rotation.y += 0.02;
                    renderer.render(scene, camera);
                    requestAnimationFrame(animate);
                };
                animate();
            }

            // Add click event listener
            slot.addEventListener('click', () => {
                if (!this.socket?.id) return;
                const inventory = this.playerInventories.get(this.socket.id);
                if (!inventory) return;

                // Find the first empty slot
                const slots = inventory.getSlots();
                const emptySlotIndex = slots.findIndex(slot => !slot.petal);
                
                if (emptySlotIndex !== -1) {
                    // Add petal to the empty slot
                    inventory.addPetal(petalType, emptySlotIndex);
                    
                    // Remove one from collected petals
                    const petalIndex = this.collectedPetals.findIndex(p => p === petalType);
                    if (petalIndex !== -1) {
                        this.collectedPetals.splice(petalIndex, 1);
                    }
                    
                    // Update inventory display
                    this.updateInventoryDisplay();
                }
            });

            grid.appendChild(slot);
        });

        // Create inventory slots
        const inventoryGrid = document.createElement('div');
        inventoryGrid.style.display = 'grid';
        inventoryGrid.style.gridTemplateColumns = 'repeat(5, 1fr)';
        inventoryGrid.style.gap = '8px';
        inventoryGrid.style.marginTop = '15px';
        grid.appendChild(inventoryGrid);

        // Add inventory slots
        const inventory = this.playerInventories.get(this.socket.id);
        if (inventory) {
            inventory.getSlots().forEach((slot, index) => {
                // Show current petal if exists
                if (slot.petal) {
                    const preview = this.inventoryPreviews.get(slot.petal.getType());
                    if (preview) {
                        const { renderer } = preview;
                    }
                }
            });
        }
    }

    private setupConnectionMonitoring(): void {
        if (!this.socket) return;

        // Handle disconnection
        this.socket.on('disconnect', (reason) => {
            console.log('Disconnected from server:', reason);
            
            if (reason === 'io server disconnect' || reason === 'transport close') {
                // Server is down, attempt to reconnect
                this.attemptReconnect();
            }
        });

        // Handle connection error
        this.socket.on('connect_error', (error) => {
            console.log('Connection error:', error);
            this.attemptReconnect();
        });

        // Reset reconnection attempts on successful connection
        this.socket.on('connect', () => {
            console.log('Connected to server');
            this.reconnectAttempts = 0;
        });
    }

    private attemptReconnect(): void {
        this.reconnectAttempts++;
        console.log(`Reconnection attempt ${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS}`);

        if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
            console.log('Max reconnection attempts reached. Reloading page...');
            // Add a small delay before reloading to allow for console message
            setTimeout(() => {
                window.location.reload();
            }, 1000);
            return;
        }

        // Try to reconnect after delay
        setTimeout(() => {
            if (this.socket) {
                this.socket.connect();
            }
        }, this.RECONNECT_DELAY);
    }

    private updateLighting(config: LightingConfig): void {
        // Update ambient light
        this.ambientLight.color.setHex(config.ambientLight.color);
        this.ambientLight.intensity = config.ambientLight.intensity;

        // Update directional light
        this.directionalLight.color.setHex(config.directionalLight.color);
        this.directionalLight.intensity = config.directionalLight.intensity;
        this.directionalLight.position.set(
            config.directionalLight.position.x,
            config.directionalLight.position.y,
            config.directionalLight.position.z
        );

        // Update hemisphere light
        this.hemisphereLight.color.setHex(config.hemisphereLight.skyColor);
        this.hemisphereLight.groundColor.setHex(config.hemisphereLight.groundColor);
        this.hemisphereLight.intensity = config.hemisphereLight.intensity;
    }

    public getCollectedPetals(): PetalType[] {
        return this.collectedPetals;
    }

    public isRarityTintingEnabled(): boolean {
        return this.settings.rarityTinting;
    }

    private createSettingsButton(): void {
        const settingsButton = document.createElement('button');
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
        settingsButton.addEventListener('click', () => this.toggleSettingsMenu());
        document.body.appendChild(settingsButton);
    }

    private createSettingsMenu(): void {
        this.settingsMenu = document.createElement('div');
        const menu = this.settingsMenu;
        
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
        const title = document.createElement('h2');
        title.textContent = 'Settings';
        title.style.textAlign = 'left';
        title.style.marginBottom = '15px';
        title.style.fontSize = '18px';
        title.style.color = 'white';
        menu.appendChild(title);

        // Create settings container
        const settingsContainer = document.createElement('div');
        settingsContainer.style.display = 'flex';
        settingsContainer.style.flexDirection = 'column';
        settingsContainer.style.gap = '10px';

        // Add rarity tinting toggle
        const rarityTintingContainer = document.createElement('div');
        rarityTintingContainer.style.display = 'flex';
        rarityTintingContainer.style.alignItems = 'center';
        rarityTintingContainer.style.gap = '10px';

        const rarityTintingLabel = document.createElement('label');
        rarityTintingLabel.textContent = 'Rarity Tinting';
        rarityTintingLabel.style.color = 'white';
        rarityTintingLabel.htmlFor = 'rarity-tinting';

        const rarityTintingToggle = document.createElement('input');
        rarityTintingToggle.type = 'checkbox';
        rarityTintingToggle.id = 'rarity-tinting';
        rarityTintingToggle.checked = this.settings.rarityTinting;
        
        // Add change event listener
        rarityTintingToggle.onchange = () => {
            this.settings.rarityTinting = rarityTintingToggle.checked;
            // Immediately update all petal colors
            this.updateAllPetalColors();
            // Update inventory previews
            if (this.isInventoryOpen) {
                this.updateInventoryDisplay();
            }
            // Update crafting previews if open
            if (this.isCraftingOpen) {
                this.updateCraftingDisplay();
            }
        };

        rarityTintingContainer.appendChild(rarityTintingLabel);
        rarityTintingContainer.appendChild(rarityTintingToggle);
        settingsContainer.appendChild(rarityTintingContainer);

        // Add logout button
        const logoutButton = document.createElement('button');
        logoutButton.textContent = 'Logout';
        logoutButton.style.cssText = `
            padding: 8px 16px;
            background-color: #dc3545;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
            margin-top: 10px;
            transition: background-color 0.3s;
        `;
        logoutButton.addEventListener('mouseover', () => {
            logoutButton.style.backgroundColor = '#c82333';
        });
        logoutButton.addEventListener('mouseout', () => {
            logoutButton.style.backgroundColor = '#dc3545';
        });
        logoutButton.addEventListener('click', () => {
            this.handleLogout();
        });
        settingsContainer.appendChild(logoutButton);

        menu.appendChild(settingsContainer);
        document.body.appendChild(menu);
    }

    private handleLogout(): void {
        // Close settings menu
        this.isSettingsOpen = false;
        if (this.settingsMenu) {
            this.settingsMenu.style.display = 'none';
        }

        // Logout from account manager
        this.accountManager.logout();

        // Disconnect from server
        if (this.socket) {
            this.socket.disconnect();
        }

        // Reset game state
        this.isGameStarted = false;

        // Clear the scene
        this.players.forEach((player, id) => {
            this.scene.remove(player);
        });
        this.players.clear();

        this.enemies.forEach((enemy) => {
            enemy.remove();
        });
        this.enemies.clear();

        this.playerInventories.forEach((inventory) => {
            inventory.clear();
        });
        this.playerInventories.clear();

        this.playerHealthBars.forEach((healthBar) => {
            healthBar.remove();
        });
        this.playerHealthBars.clear();

        this.items.forEach(item => {
            item.remove();
        });
        this.items.clear();

        // Hide wave UI
        this.waveUI.hide();

        // Reset camera position for title screen
        this.camera.position.set(0, 15, 0);
        this.camera.lookAt(0, 0, 0);

        // Reinitialize spectator connection for title screen
        this.networkManager.initializeSpectatorConnection();
        this.socket = this.networkManager.socket;

        // Recreate title screen
        this.init();

        // Update page title
        const title = document.querySelector('title');
        if (title) {
            title.textContent = '3dflower.io';
        }
    }

    private toggleSettingsMenu(): void {
        if (!this.settingsMenu) {
            this.createSettingsMenu();
        }

        this.isSettingsOpen = !this.isSettingsOpen;
        if (this.settingsMenu) {
            this.settingsMenu.style.display = this.isSettingsOpen ? 'block' : 'none';

            // Get the checkbox
            const rarityTintingCheckbox = this.settingsMenu.querySelector('#rarity-tinting') as HTMLInputElement;
            if (rarityTintingCheckbox) {
                // Update the setting when checkbox changes
                rarityTintingCheckbox.onchange = () => {
                    this.settings.rarityTinting = rarityTintingCheckbox.checked;
                    // Immediately update all petal colors
                    this.updateAllPetalColors();
                    // Update inventory previews
                    if (this.isInventoryOpen) {
                        this.updateInventoryDisplay();
                    }
                    // Update crafting previews if open
                    if (this.isCraftingOpen) {
                        this.updateCraftingDisplay();
                    }
                };
            }
        }
    }

    private updateAllPetalColors(): void {
        // Update inventory slots
        const inventorySlots = document.querySelectorAll('[id^="inventory-slot-"]');
        inventorySlots.forEach(slot => {
            const petalType = (slot as HTMLElement).getAttribute('data-type');
            if (petalType && PETAL_STATS[petalType as PetalType]) {
                const stats = PETAL_STATS[petalType as PetalType];
                // Basic petals should never be tinted
                if (petalType === PetalType.BASIC) {
                    (slot as HTMLElement).style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
                } else {
                    const color = this.settings.rarityTinting ? 
                        `rgba(${(RARITY_COLORS[stats.rarity] >> 16) & 255}, ${(RARITY_COLORS[stats.rarity] >> 8) & 255}, ${RARITY_COLORS[stats.rarity] & 255}, 0.2)` : 
                        'rgba(255, 255, 255, 0.2)';
                    (slot as HTMLElement).style.backgroundColor = color;
                }
            }
        });

        // Update crafting slots if crafting menu exists
        if (this.craftingMenu) {
            const craftingSlots = document.querySelectorAll('[id^="crafting-slot-"]');
            craftingSlots.forEach(slot => {
                const petalType = (slot as HTMLElement).getAttribute('data-petal-type');
                if (petalType && PETAL_STATS[petalType as PetalType]) {
                    const stats = PETAL_STATS[petalType as PetalType];
                    // Basic petals should never be tinted
                    if (petalType === PetalType.BASIC) {
                        (slot as HTMLElement).style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
                    } else {
                        const color = this.settings.rarityTinting ? 
                            `rgba(${(RARITY_COLORS[stats.rarity] >> 16) & 255}, ${(RARITY_COLORS[stats.rarity] >> 8) & 255}, ${RARITY_COLORS[stats.rarity] & 255}, 0.2)` : 
                            'rgba(255, 255, 255, 0.2)';
                        (slot as HTMLElement).style.backgroundColor = color;
                    }
                }
            });
        }

        // Update equipped petals if player inventory exists
        if (this.socket?.id) {
            const inventory = this.playerInventories.get(this.socket.id);
            if (inventory) {
                inventory.getPetals().forEach(petal => {
                    if (petal.getType() !== PetalType.BASIC) {
                        const stats = PETAL_STATS[petal.getType()];
                        const color = this.settings.rarityTinting ? RARITY_COLORS[stats.rarity] : 0xffffff;
                        petal.updateColor(color);
                    }
                });
            }
        }
    }

    private createCraftingMenu(): void {
        if (this.craftingMenu) {
            document.body.removeChild(this.craftingMenu);
        }
        
        this.craftingMenu = document.createElement('div');
        const menu = this.craftingMenu;
        
        // Style the menu for bottom left corner
        menu.style.position = 'fixed';
        menu.style.bottom = '20px';
        menu.style.left = '20px';  // Position in bottom left
        menu.style.width = '300px';
        menu.style.backgroundColor = '#77ea65';  // Match inventory color
        menu.style.padding = '15px';
        menu.style.borderRadius = '10px';
        menu.style.display = 'none';
        menu.style.zIndex = '1000';
        menu.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.5)';

        // Add title
        const title = document.createElement('h2');
        title.textContent = 'Crafting';
        title.style.textAlign = 'left';
        title.style.marginBottom = '15px';
        title.style.fontSize = '18px';
        title.style.color = 'white';
        menu.appendChild(title);

        // Create grid container for crafting slots
        const grid = document.createElement('div');
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = 'repeat(5, 1fr)';
        grid.style.gap = '8px';
        grid.style.marginBottom = '15px';
        menu.appendChild(grid);

        // Create 5 crafting slots
        for (let i = 0; i < 5; i++) {
            const slot = document.createElement('div');
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
        const craftButton = document.createElement('button');
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
        
        craftButton.onclick = () => this.attemptCraft();
        menu.appendChild(craftButton);

        document.body.appendChild(menu);
    }

    private attemptCraft(): void {
        if (!this.craftingSystem || !this.socket) return;

        // Get crafting slots from the UI
        const grid = this.craftingMenu?.querySelector('div:nth-child(2)');
        if (!grid) return;

        // Get all petal types in crafting slots
        const petalTypes = Array.from(grid.children)
            .map(slot => slot.getAttribute('data-petal-type'))
            .filter((type): type is PetalType => type !== null && Object.values(PetalType).includes(type as PetalType));

        // Check if we have 5 of the same type
        if (petalTypes.length !== 5 || !petalTypes.every(type => type === petalTypes[0])) {
            console.log('You need 5 of the same petal type to craft!');
            return;
        }

        // Determine the upgrade path
        const basePetalType = petalTypes[0];
        let upgradedType: PetalType | null = null;

        switch (basePetalType) {
            case PetalType.BASIC:
                upgradedType = PetalType.BASIC_UNCOMMON;
                break;
            case PetalType.BASIC_UNCOMMON:
                upgradedType = PetalType.BASIC_RARE;
                break;
            case PetalType.TETRAHEDRON:
                upgradedType = PetalType.TETRAHEDRON_EPIC;
                break;
            case PetalType.CUBE:
                upgradedType = PetalType.CUBE_LEGENDARY;
                break;
            default:
                console.log('This petal type cannot be upgraded!');
                return;
        }

        if (upgradedType) {
            // Remove the used petals
            petalTypes.forEach(petal => {
                this.socket?.emit('inventoryUpdate', {
                    type: petal,
                    action: 'remove'
                });
            });

            // Add the crafted item
            this.socket?.emit('inventoryUpdate', {
                type: upgradedType,
                action: 'add'
            });

            // Save the inventory state
            const playerInventory = this.playerInventories.get(this.socket?.id || '');
            if (playerInventory) {
                playerInventory.savePetals();
            }

            // Clear crafting slots
            Array.from(grid.children).forEach(slot => {
                slot.innerHTML = '';
                slot.removeAttribute('data-petal-type');
            });

            // Update displays
            this.updateCraftingDisplay();
            this.updateInventoryDisplay();
        }
    }

    private updateCraftingDisplay(): void {
        if (!this.craftingMenu || !this.socket?.id) return;

        // Get the grid container
        const grid = this.craftingMenu.querySelector('div:nth-child(2)');
        if (!grid) return;

        // Clear all slots first
        Array.from(grid.children).forEach(slot => {
            slot.innerHTML = '';
            
            // Create preview container
            const previewContainer = document.createElement('div');
            previewContainer.style.width = '100%';
            previewContainer.style.height = '100%';
            previewContainer.style.display = 'flex';
            previewContainer.style.justifyContent = 'center';
            previewContainer.style.alignItems = 'center';
            slot.appendChild(previewContainer);

            // Add drop functionality
            (slot as HTMLDivElement).ondragover = (e: DragEvent) => {
                e.preventDefault();
                (slot as HTMLDivElement).style.backgroundColor = 'rgba(255, 255, 255, 0.4)';
            };
            
            (slot as HTMLDivElement).ondragleave = () => {
                (slot as HTMLDivElement).style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
            };
            
            (slot as HTMLDivElement).ondrop = (e: DragEvent) => {
                e.preventDefault();
                (slot as HTMLDivElement).style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
                const petalType = e.dataTransfer?.getData('petalType');
                if (petalType) {
                    this.addPetalToCraftingSlot(petalType as PetalType, Array.from(grid.children).indexOf(slot));
                }
            };
        });
    }

    private addPetalToCraftingSlot(petalType: PetalType, slotIndex: number): void {
        if (!this.craftingMenu) return;

        // Find and remove one petal of this type from collected petals
        const petalIndex = this.collectedPetals.findIndex(p => p === petalType);
        if (petalIndex !== -1) {
            this.collectedPetals.splice(petalIndex, 1);
            
            // Add preview to crafting slot
            const grid = this.craftingMenu.querySelector('div:nth-child(2)');
            if (!grid) return;
            
            const slot = grid.children[slotIndex];
            if (!slot) return;

            const preview = this.inventoryPreviews.get(petalType);
            if (preview) {
                const { renderer } = preview;
                const container = slot.querySelector('div');
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
    }

    private updateTerrainPlaneColors(groundColor: number): void {
        // Update terrain plane colors with enhanced material properties
        this.collisionManager.getTerrainPlanes().forEach(plane => {
            if (plane.material instanceof THREE.MeshPhongMaterial) {
                // Make terrain slightly darker and more saturated than ground
                const color = new THREE.Color(groundColor);
                color.multiplyScalar(0.8); // Make it 20% darker
                color.offsetHSL(0, 0.2, 0); // Increase saturation by 20%
                
                plane.material.color.copy(color);
                plane.material.needsUpdate = true;
            }
        });
    }
}

// Start the game
new Game(); 