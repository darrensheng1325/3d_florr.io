import * as THREE from 'three';
import { io, Socket } from 'socket.io-client';
import playerSvg from './player.svg';
import { Petal } from './petal';
import { HealthBar } from './health';
import { Enemy, EnemyType } from './enemy';
import { Inventory, PetalType, PetalSlot } from './inventory';
import { WaveUI } from './waves';
import { Item, ItemType } from './item';

export class Game {
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
    private cameraRotation: number = 0;
    private ground: THREE.Mesh;
    private textureLoader: THREE.TextureLoader;
    private playerInventories: Map<string, Inventory> = new Map();
    private enemies: Map<string, Enemy> = new Map();
    private playerHealthBars: Map<string, HealthBar> = new Map();
    private playerVelocities: Map<string, THREE.Vector3> = new Map();
    private isGameStarted: boolean = false;
    private titleCanvas: HTMLCanvasElement;
    private titleCtx: CanvasRenderingContext2D;
    private pressedKeys: Set<string> = new Set();
    private moveSpeed: number = 0.05;
    private mapSize: number = 15;
    private lastFrameTime: number = 0;
    private readonly targetFPS: number = 60;
    private readonly frameInterval: number = 1000 / 60;
    private deathScreen: HTMLDivElement | null = null;
    private lastHealTime: number = 0;
    private readonly HEAL_INTERVAL: number = 1000; // Heal every second
    private readonly HEAL_AMOUNT: number = 5;      // Heal 5 health per tick
    private items: Map<string, Item> = new Map();
    private inventoryMenu: HTMLDivElement | null = null;
    private collectedPetals: PetalType[] = [];
    private isInventoryOpen: boolean = false;
    private inventoryPreviews: Map<PetalType, {
        renderer: THREE.WebGLRenderer;
        scene: THREE.Scene;
        camera: THREE.PerspectiveCamera;
        mesh: THREE.Mesh;
    }> = new Map();

    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer();
        this.players = new Map();
        this.textureLoader = new THREE.TextureLoader();
        this.waveUI = new WaveUI();

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
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
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

        // Create ground
        const groundGeometry = new THREE.PlaneGeometry(30, 30);
        const groundMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x00cf2d,
            side: THREE.DoubleSide 
        });
        this.ground = new THREE.Mesh(groundGeometry, groundMaterial);
        this.ground.rotation.x = Math.PI / 2;
        this.ground.position.y = 0;

        this.init();
        
        // Connect to server immediately for spectating
        this.socket = io('/');
        this.setupSpectatorEvents();

        // Setup wave events
        this.setupWaveEvents();
    }

    private setupEnemyEvents(): void {
        if (!this.socket) return;

        // Handle enemies
        this.socket.on('enemySpawned', (data: { id: string, type: string, position: { x: number, y: number, z: number } }) => {
            const enemy = new Enemy(
                this.scene,
                new THREE.Vector3(data.position.x, data.position.y, data.position.z),
                this.camera,
                data.type as EnemyType,
                data.id
            );
            this.enemies.set(data.id, enemy);
        });

        this.socket.on('enemyMoved', (data: { id: string, position: { x: number, y: number, z: number }, rotation: number }) => {
            const enemy = this.enemies.get(data.id);
            if (enemy) {
                enemy.updatePosition(data.position, data.rotation);
            }
        });

        this.socket.on('enemyDied', (data: { enemyId: string, position: { x: number, y: number, z: number }, itemType: string}) => {
            const enemy = this.enemies.get(data.enemyId);
            if (enemy) {
                enemy.remove();
                this.enemies.delete(data.enemyId);
                this.enemiesKilled++;
                this.waveUI.update(this.currentWave, this.enemiesKilled, this.totalXP);

                // If there's an item drop, create it
                if (data.itemType) {
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
    }

    private setupSpectatorEvents(): void {
        if (!this.socket) return;

        // Handle other players
        this.socket.on('playerJoined', (data: { id: string, position: { x: number, y: number, z: number } }) => {
            if (!this.isGameStarted) {  // Only handle other players while spectating
                this.createPlayer(data.id);
            }
        });

        this.socket.on('playerLeft', (playerId: string) => {
            const player = this.players.get(playerId);
            if (player) {
                this.scene.remove(player);
                this.players.delete(playerId);
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
    }

    private createTitleScreen(): void {
        // Set camera for spectating
        this.camera.position.set(0, 15, 0);
        this.camera.lookAt(0, 0, 0);

        // Start rotating camera for spectating
        let angle = 0;
        
        // Add space key listener
        document.addEventListener('keydown', (event) => {
            if (event.code === 'Space' && !this.isGameStarted) {
                this.startGame();
            }
        });

        // Update canvas size
        this.onWindowResize();

        // Animate title screen
        const animate = () => {
            if (!this.isGameStarted) {
                requestAnimationFrame(animate);
                
                // Rotate camera around the scene
                angle += 0.001;
                const radius = 15;
                this.camera.position.x = Math.cos(angle) * radius;
                this.camera.position.z = Math.sin(angle) * radius;
                this.camera.lookAt(0, 0, 0);

                // Render game scene
                this.renderer.render(this.scene, this.camera);
                
                // Clear and draw title text
                this.titleCtx.clearRect(0, 0, this.titleCanvas.width, this.titleCanvas.height);
                
                // Draw title
                this.titleCtx.font = 'bold 72px Arial';
                this.titleCtx.textAlign = 'center';
                this.titleCtx.fillStyle = '#ffffff';
                this.titleCtx.strokeStyle = '#000000';
                this.titleCtx.lineWidth = 5;
                this.titleCtx.strokeText('florr.io', this.titleCanvas.width / 2, this.titleCanvas.height / 3);
                this.titleCtx.fillText('florr.io', this.titleCanvas.width / 2, this.titleCanvas.height / 3);
                
                // Draw subtitle with floating animation
                this.titleCtx.font = '24px Arial';
                this.titleCtx.fillStyle = '#000000';
                const yOffset = Math.sin(Date.now() * 0.002) * 5;
                this.titleCtx.fillText('Press SPACE to start', this.titleCanvas.width / 2, this.titleCanvas.height / 2 + yOffset);
            }
        };
        animate();
    }

    private startGame(): void {
        this.isGameStarted = true;
        
        // Remove title canvas if it exists and is attached
        if (this.titleCanvas && this.titleCanvas.parentNode === document.body) {
            document.body.removeChild(this.titleCanvas);
        }

        // Show wave UI
        this.waveUI.show();

        // Clear the scene of all spectator elements
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

        // Clear the renderer
        this.renderer.clear();

        // Clear items
        this.items.forEach(item => {
            item.remove();
        });
        this.items.clear();

        // Reconnect to server to get a fresh connection
        if (this.socket) {
            this.socket.disconnect();
        }
        this.socket = io('/');

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
        // Setup renderer
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        document.body.appendChild(this.renderer.domElement);

        // Set background color to sky blue
        this.scene.background = new THREE.Color(0x87CEEB);

        // Add lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        this.scene.add(ambientLight);
        const pointLight = new THREE.PointLight(0xffffff, 1.0);
        pointLight.position.set(5, 10, 5);
        this.scene.add(pointLight);

        // Add ground to scene
        this.scene.add(this.ground);

        // Add grid helper
        const gridHelper = new THREE.GridHelper(30, 30, 0x038f21, 0x038f21);
        gridHelper.position.y = 0.01;
        this.scene.add(gridHelper);

        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize());

        // Create and show title screen
        this.createTitleScreen();
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
        if (!this.socket?.id) return;

        const currentTime = Date.now();
        if (currentTime - this.lastHealTime >= this.HEAL_INTERVAL) {
            const healthBar = this.playerHealthBars.get(this.socket.id);
            if (healthBar) {
                healthBar.heal(this.HEAL_AMOUNT);
            }
            this.lastHealTime = currentTime;
        }
    }

    private createPlayer(playerId: string): void {
        // Create a sphere for the player
        const geometry = new THREE.SphereGeometry(0.5, 32, 32);
        
        // Load the SVG texture
        this.textureLoader.load(playerSvg, (texture) => {
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
            
            this.scene.add(player);
            this.players.set(playerId, player);

            // Add health bar with camera reference
            const healthBar = new HealthBar(this.camera, player);
            this.playerHealthBars.set(playerId, healthBar);

            // Create inventory with default petals
            const inventory = new Inventory(this.scene, player);
            for (let i = 0; i < 5; i++) {
                inventory.addPetal(PetalType.BASIC, i);
            }
            this.playerInventories.set(playerId, inventory);
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
            if (this.socket?.id) {
                this.createPlayer(this.socket.id);
                this.playerVelocities.set(this.socket.id, new THREE.Vector3());
            }
        });

        // Add player damage event handler
        this.socket.on('playerDamaged', (data: { id: string, health: number }) => {
            if (this.socket?.id === data.id) {
                const healthBar = this.playerHealthBars.get(this.socket.id);
                if (healthBar) {
                    const isDead = healthBar.takeDamage(10);
                    if (isDead) {
                        this.showDeathScreen();
                    }
                }
            }
        });

        this.socket.on('playerJoined', (data: { id: string, position: { x: number, y: number, z: number }, xp: number }) => {
            this.createPlayer(data.id);
        });

        this.socket.on('playerLeft', (playerId: string) => {
            const player = this.players.get(playerId);
            if (player) {
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
        this.socket.on('waveStart', (data: { wave: number }) => {
            // Clear all existing enemies
            this.enemies.forEach(enemy => {
                enemy.remove();
            });
            this.enemies.clear();

            // Reset wave stats
            this.currentWave = data.wave;
            this.enemiesKilled = 0;
            this.totalXP = 0;
            this.waveUI.update(this.currentWave, this.enemiesKilled, this.totalXP);
        });

        this.socket.on('playerXP', (data: { id: string, xp: number }) => {
            if (this.socket?.id === data.id) {
                this.totalXP = data.xp % this.XP_PER_WAVE;
                this.waveUI.update(this.currentWave, this.enemiesKilled, this.totalXP);
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

        // Check boundaries before applying movement
        if (newX >= -this.mapSize && newX <= this.mapSize && 
            newZ >= -this.mapSize && newZ <= this.mapSize) {
            player.position.x = newX;
            player.position.z = newZ;
            player.position.y = 0.5;

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
    }

    private onWindowResize(): void {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        
        // Update title canvas size if it exists
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

                    // Send damage event to server
                    this.socket?.emit('enemyDamaged', {
                        enemyId: enemy.getId(),
                        damage: 5,
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
                // Convert item type to petal type and add to inventory
                const petalType = item.getType() === ItemType.TETRAHEDRON ? 
                    PetalType.TETRAHEDRON : PetalType.CUBE;
                this.collectedPetals.push(petalType);

                // Remove item
                item.remove();
                this.items.delete(itemId);

                // Update inventory display if open
                if (this.isInventoryOpen) {
                    this.updateInventoryDisplay();
                }
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
                const material = new THREE.MeshPhongMaterial({ 
                    color: 0xffffff,
                    shininess: 100,
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

        this.socket.on('waveStart', (data: { wave: number }) => {
            this.currentWave = data.wave;
            this.enemiesKilled = 0;
            this.totalXP = 0;
            this.waveUI.update(this.currentWave, this.enemiesKilled, this.totalXP);
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

    private showDeathScreen(): void {
        if (!this.deathScreen) {
            this.createDeathScreen();
        }
        document.body.appendChild(this.deathScreen!);

        // Stop game loop
        this.isGameStarted = false;
    }

    private hideDeathScreen(): void {
        if (this.deathScreen && this.deathScreen.parentNode) {
            this.deathScreen.parentNode.removeChild(this.deathScreen);
        }
    }

    private respawnPlayer(): void {
        if (!this.socket?.id) return;
        
        // Hide death screen
        this.hideDeathScreen();
        
        // Clear game state
        this.players.forEach((player) => {
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

        // Reset game state
        this.isGameStarted = false;
        
        // Reconnect for spectating
        if (this.socket) {
            this.socket.disconnect();
        }
        this.socket = io('/');
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
        
        const ctx = this.titleCanvas.getContext('2d');
        if (!ctx) throw new Error('Could not get 2D context');
        this.titleCtx = ctx;

        // Update canvas size
        this.onWindowResize();

        // Hide wave UI
        this.waveUI.hide();

        // Start title screen animation
        let angle = 0;
        const animate = () => {
            if (this.isGameStarted) return;

            // Clear the canvas
            this.titleCtx.clearRect(0, 0, this.titleCanvas.width, this.titleCanvas.height);

            // Draw title text
            this.titleCtx.font = 'bold 64px Arial';
            this.titleCtx.fillStyle = '#ffffff';
            this.titleCtx.textAlign = 'center';
            this.titleCtx.textBaseline = 'middle';
            this.titleCtx.fillText('florr.io', this.titleCanvas.width / 2, this.titleCanvas.height / 2 - 40);

            // Draw subtitle with floating animation
            this.titleCtx.font = '24px Arial';
            this.titleCtx.fillStyle = '#000000';
            const floatOffset = Math.sin(Date.now() * 0.003) * 5;
            this.titleCtx.fillText('Press SPACE to start', this.titleCanvas.width / 2, this.titleCanvas.height / 2 + 40 + floatOffset);

            // Rotate camera
            angle += 0.002;
            this.camera.position.x = Math.sin(angle) * 15;
            this.camera.position.z = Math.cos(angle) * 15;
            this.camera.position.y = 15;
            this.camera.lookAt(0, 0, 0);

            // Render scene
            this.renderer.render(this.scene, this.camera);

            requestAnimationFrame(animate);
        };
        animate();
    }

    private createInventoryMenu(): void {
        this.inventoryMenu = document.createElement('div');
        const menu = this.inventoryMenu;
        
        // Style the menu for bottom left corner
        menu.style.position = 'fixed';
        menu.style.bottom = '20px';
        menu.style.left = '20px';
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
            let geometry: THREE.BufferGeometry;
            let material: THREE.Material;

            switch (type) {
                case PetalType.TETRAHEDRON:
                    geometry = new THREE.TetrahedronGeometry(0.8);
                    material = new THREE.MeshPhongMaterial({ 
                        color: 0xff0000,
                        shininess: 100
                    });
                    break;
                case PetalType.CUBE:
                    geometry = new THREE.BoxGeometry(0.8, 0.8, 0.8);
                    material = new THREE.MeshPhongMaterial({ 
                        color: 0x0000ff,
                        shininess: 100
                    });
                    break;
                default:
                    geometry = new THREE.SphereGeometry(0.8, 32, 32);
                    material = new THREE.MeshPhongMaterial({ 
                        color: 0xffffff,
                        shininess: 100
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
        });

        document.body.appendChild(menu);
    }

    private toggleInventoryMenu(): void {
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
            countBadge.style.backgroundColor = '#333';
            countBadge.style.color = 'white';
            countBadge.style.padding = '2px 6px';
            countBadge.style.borderRadius = '10px';
            countBadge.style.fontSize = '12px';
            slot.appendChild(countBadge);

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
}

// Start the game
new Game(); 