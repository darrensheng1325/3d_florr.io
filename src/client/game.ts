import * as THREE from 'three';
import { io, Socket } from 'socket.io-client';
import playerSvg from './player.svg';
import { Petal } from './petal';
import { HealthBar } from './health';
import { Enemy, EnemyType } from './enemy';
import { Inventory, PetalType, PetalSlot } from './inventory';
import { WaveUI } from './waves';

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

        this.socket.on('enemyDied', (enemyId: string) => {
            const enemy = this.enemies.get(enemyId);
            if (enemy) {
                enemy.remove();
                this.enemies.delete(enemyId);
            }
        });
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
        
        // Remove title canvas
        document.body.removeChild(this.titleCanvas);

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

            // Check petal collisions
            this.checkPetalCollisions();

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

        // Wave and XP events
        this.socket.on('waveStart', (data: { wave: number }) => {
            console.log('Wave start:', data.wave);  // Debug log
            this.currentWave = data.wave;
            this.enemiesKilled = 0;
            this.totalXP = 0;
            this.waveUI.update(this.currentWave, this.enemiesKilled, this.totalXP);
        });

        this.socket.on('enemyDied', (enemyId: string) => {
            console.log('Enemy died, kills:', this.enemiesKilled + 1);  // Debug log
            const enemy = this.enemies.get(enemyId);
            if (enemy) {
                enemy.remove();
                this.enemies.delete(enemyId);
                this.enemiesKilled++;
                this.waveUI.update(this.currentWave, this.enemiesKilled, this.totalXP);
            }
        });

        this.socket.on('playerXP', (data: { id: string, xp: number }) => {
            console.log('XP update:', data);  // Debug log
            if (this.socket?.id === data.id) {
                this.totalXP = data.xp % this.XP_PER_WAVE;
                this.waveUI.update(this.currentWave, this.enemiesKilled, this.totalXP);
            }
        });

        // Enemy events
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

        this.socket.on('enemyDamaged', (data: { id: string, health: number }) => {
            const enemy = this.enemies.get(data.id);
            if (enemy) {
                enemy.takeDamage(data.health);
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
                        enemyId: enemy.id,
                        damage: 5,
                        knockback: { x: knockbackDir.x, z: knockbackDir.z }
                    });
                }
            });
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
                // Create a preview petal mesh using a sphere
                const geometry = new THREE.SphereGeometry(0.4, 32, 32);
                const material = new THREE.MeshPhongMaterial({ 
                    color: 0xffffff,
                    shininess: 100,
                    opacity: 1.0
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

        this.socket.on('enemyDied', () => {
            this.enemiesKilled++;
            this.waveUI.update(this.currentWave, this.enemiesKilled, this.totalXP);
        });

        this.socket.on('playerXP', (data: { id: string, xp: number }) => {
            if (this.socket?.id === data.id) {
                this.totalXP = data.xp % this.XP_PER_WAVE;
                this.waveUI.update(this.currentWave, this.enemiesKilled, this.totalXP);
            }
        });
    }
}

// Start the game
new Game(); 