import * as THREE from 'three';
import { io, Socket } from 'socket.io-client';
import playerSvg from './player.svg';
import { Petal } from './petal';
import { HealthBar } from './health';
import { Enemy, EnemyType } from './enemy';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry';
import { FontLoader, Font } from 'three/examples/jsm/loaders/FontLoader';

export class Game {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private socket: Socket | null = null;
    public players: Map<string, THREE.Mesh>;
    private cameraRotation: number = 0;
    private ground: THREE.Mesh;
    private textureLoader: THREE.TextureLoader;
    private playerPetals: Map<string, Petal[]> = new Map();
    private enemies: Map<string, Enemy> = new Map();
    private playerHealthBars: Map<string, HealthBar> = new Map();
    private playerVelocities: Map<string, THREE.Vector3> = new Map();
    private isGameStarted: boolean = false;
    private titleCanvas: HTMLCanvasElement;
    private titleCtx: CanvasRenderingContext2D;

    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer();
        this.players = new Map();
        this.textureLoader = new THREE.TextureLoader();

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

        // Create ground
        const groundGeometry = new THREE.PlaneGeometry(30, 30);
        const groundMaterial = new THREE.MeshPhongMaterial({ 
            color: 0x55ff55,
            side: THREE.DoubleSide 
        });
        this.ground = new THREE.Mesh(groundGeometry, groundMaterial);
        this.ground.rotation.x = Math.PI / 2;
        this.ground.position.y = 0;

        this.init();
        
        // Connect to server immediately for spectating
        this.socket = io('/');
        this.setupSpectatorEvents();
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
                this.titleCtx.fillStyle = '#ff0000';
                this.titleCtx.fillText('FLORR.IO', this.titleCanvas.width / 2, this.titleCanvas.height / 3);
                
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

        // Clear the scene of all spectator elements
        this.players.forEach((player, id) => {
            this.scene.remove(player);
        });
        this.players.clear();

        this.enemies.forEach((enemy) => {
            enemy.remove();
        });
        this.enemies.clear();

        this.playerPetals.forEach((petals) => {
            petals.forEach(petal => petal.remove(this.scene));
        });
        this.playerPetals.clear();

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
        const gridHelper = new THREE.GridHelper(30, 30, 0x000000, 0x000000);
        gridHelper.position.y = 0.01;
        this.scene.add(gridHelper);

        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize());

        // Create and show title screen
        this.createTitleScreen();
    }

    private animate(): void {
        if (!this.isGameStarted) return;

        requestAnimationFrame(() => this.animate());

        // Update petals
        this.playerPetals.forEach(petals => {
            petals.forEach(petal => petal.update());
        });

        // Check petal collisions
        this.checkPetalCollisions();

        // Update health bars
        this.playerHealthBars.forEach(healthBar => healthBar.updatePosition());

        // Update camera
        this.updateCameraPosition();

        // Render game scene
        this.renderer.render(this.scene, this.camera);
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
            
            // Rotate the sphere 90 degrees to the left around the Y axis
            player.rotateY(Math.PI / 2);
            
            this.scene.add(player);
            this.players.set(playerId, player);

            // Add health bar with camera reference
            const healthBar = new HealthBar(this.camera, player);
            this.playerHealthBars.set(playerId, healthBar);

            // Add petals
            const petals: Petal[] = [];
            const numPetals = 8;
            for (let i = 0; i < numPetals; i++) {
                petals.push(new Petal(this.scene, player, i, numPetals));
            }
            this.playerPetals.set(playerId, petals);
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

        this.socket.on('playerJoined', (data: { id: string, position: { x: number, y: number, z: number } }) => {
            this.createPlayer(data.id);
        });

        this.socket.on('playerLeft', (playerId: string) => {
            const player = this.players.get(playerId);
            if (player) {
                this.scene.remove(player);
                this.players.delete(playerId);
                
                // Remove petals
                const petals = this.playerPetals.get(playerId);
                if (petals) {
                    petals.forEach(petal => petal.remove(this.scene));
                    this.playerPetals.delete(playerId);
                }
            }
        });

        this.socket.on('playerMoved', (data: { id: string, position: { x: number, y: number, z: number } }) => {
            const player = this.players.get(data.id);
            if (player) {
                player.position.set(data.position.x, data.position.y, data.position.z);
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

        this.socket.on('enemyDied', (enemyId: string) => {
            const enemy = this.enemies.get(enemyId);
            if (enemy) {
                enemy.remove();
                this.enemies.delete(enemyId);
            }
        });

        this.socket.on('playerDamaged', (data: { id: string, health: number }) => {
            const healthBar = this.playerHealthBars.get(data.id);
            if (healthBar) {
                // Calculate damage based on current health
                const currentHealth = data.health;
                const damage = 100 - currentHealth;  // Assuming max health is 100
                healthBar.takeDamage(damage);
            }
        });
    }

    private setupControls(): void {
        document.addEventListener('keydown', (event) => {
            if (!this.socket?.id) return;
            
            const player = this.players.get(this.socket.id);
            if (!player) return;

            // Handle petal expansion with space key
            if (event.code === 'Space') {
                const petals = this.playerPetals.get(this.socket.id);
                if (petals) {
                    petals.forEach(petal => petal.expand());
                }
                return;
            }

            const moveSpeed = 0.2;
            const movement = { x: 0, z: 0 };
            const mapSize = 15;

            switch(event.key) {
                case 'w':
                case 'ArrowUp':
                    movement.x = -Math.sin(this.cameraRotation);
                    movement.z = -Math.cos(this.cameraRotation);
                    player.rotation.y = this.cameraRotation + Math.PI/2;
                    break;
                case 's':
                case 'ArrowDown':
                    movement.x = Math.sin(this.cameraRotation);
                    movement.z = Math.cos(this.cameraRotation);
                    player.rotation.y = this.cameraRotation + Math.PI * 3/2;
                    break;
                case 'a':
                case 'ArrowLeft':
                    movement.x = -Math.cos(this.cameraRotation);
                    movement.z = Math.sin(this.cameraRotation);
                    player.rotation.y = this.cameraRotation + Math.PI;
                    break;
                case 'd':
                case 'ArrowRight':
                    movement.x = Math.cos(this.cameraRotation);
                    movement.z = -Math.sin(this.cameraRotation);
                    player.rotation.y = this.cameraRotation;
                    break;
            }

            // Calculate new position
            const newX = player.position.x + movement.x * moveSpeed;
            const newZ = player.position.z + movement.z * moveSpeed;

            // Check boundaries before applying movement
            if (newX >= -mapSize && newX <= mapSize && 
                newZ >= -mapSize && newZ <= mapSize) {
                player.position.x = newX;
                player.position.z = newZ;
                player.position.y = 0.5; // This is correct since sphere radius is 0.5
            }

            // Emit position to server
            this.socket.emit('move', {
                x: player.position.x,
                y: player.position.y,
                z: player.position.z
            });
        });

        // Add keyup handler for space to contract petals
        document.addEventListener('keyup', (event) => {
            if (!this.socket?.id) return;
            
            if (event.code === 'Space') {
                const petals = this.playerPetals.get(this.socket.id);
                if (petals) {
                    petals.forEach(petal => petal.contract());
                }
            }
        });
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
        
        const petals = this.playerPetals.get(this.socket.id);
        if (!petals) return;

        this.enemies.forEach((enemy) => {
            petals.forEach(petal => {
                const petalPosition = petal.getPosition();
                const enemyPosition = enemy.getPosition();
                const distance = petalPosition.distanceTo(enemyPosition);
                
                if (distance < 0.6) {
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
}

// Start the game
new Game(); 