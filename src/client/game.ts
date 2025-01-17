import * as THREE from 'three';
import { io, Socket } from 'socket.io-client';
import playerSvg from './player.svg';
import { Petal } from './petal';
import { HealthBar } from './health';
import { Enemy } from './enemy';

export class Game {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private socket: Socket;
    public players: Map<string, THREE.Mesh>;
    private cameraRotation: number = 0;
    private ground: THREE.Mesh;
    private textureLoader: THREE.TextureLoader;
    private playerPetals: Map<string, Petal[]> = new Map();
    private enemies: Enemy[] = [];
    private playerHealthBars: Map<string, HealthBar> = new Map();
    private spawnInterval: number = 5000; // Spawn enemy every 5 seconds
    private lastSpawnTime: number = 0;
    private playerVelocities: Map<string, THREE.Vector3> = new Map();

    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer();
        this.socket = io('/');
        this.players = new Map();
        this.textureLoader = new THREE.TextureLoader();

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

        // Set initial camera position
        this.camera.position.set(0, 5, 10);
        this.camera.lookAt(0, 0, 0);

        // Setup socket events first
        this.setupSocketEvents();

        // Setup controls
        this.setupControls();
        this.setupMouseControls();

        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize());

        // Start animation loop
        this.animate();
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
        if (!this.socket.id) return;
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
        this.socket.on('connect', () => {
            if (this.socket.id) {
                this.createPlayer(this.socket.id);
                this.playerVelocities.set(this.socket.id, new THREE.Vector3());
            }
        });

        this.socket.on('playerJoined', (playerId: string) => {
            this.createPlayer(playerId);
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
    }

    private animate(): void {
        requestAnimationFrame(() => this.animate());
        
        this.updateEnemies();
        this.updatePlayers();
        
        // Update all petals
        this.playerPetals.forEach(petals => {
            petals.forEach(petal => petal.update());
        });

        // Update health bar positions
        this.playerHealthBars.forEach(healthBar => {
            healthBar.updatePosition();
        });

        this.updateCameraPosition();
        this.renderer.render(this.scene, this.camera);
    }

    private setupControls(): void {
        document.addEventListener('keydown', (event) => {
            if (!this.socket.id) return;
            
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
            if (!this.socket.id) return;
            
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
    }

    private spawnEnemy(): void {
        const angle = Math.random() * Math.PI * 2;
        const mapSize = 15;
        const position = new THREE.Vector3(
            Math.cos(angle) * mapSize,
            0.5,
            Math.sin(angle) * mapSize
        );
        
        const enemy = new Enemy(this.scene, position, this.camera, this);
        this.enemies.push(enemy);
    }

    private updateEnemies(): void {
        const currentTime = Date.now();
        if (currentTime - this.lastSpawnTime >= this.spawnInterval) {
            this.spawnEnemy();
            this.lastSpawnTime = currentTime;
        }

        // Update and check for dead enemies
        this.enemies = this.enemies.filter(enemy => {
            enemy.update(this.players, this.playerPetals, this.playerHealthBars);
            
            // Check if enemy is dead (health <= 0)
            const isDead = enemy.takeDamageWithKnockback(0, enemy.getPosition()); // Check health without dealing damage
            if (isDead) {
                enemy.remove();
                return false;
            }
            return true;
        });
    }

    private updatePlayers(): void {
        this.playerVelocities.forEach((velocity, playerId) => {
            const player = this.players.get(playerId);
            if (player) {
                // Apply velocity
                player.position.add(velocity);
                
                // Apply resistance
                velocity.multiplyScalar(0.95);

                // Keep within bounds
                const mapSize = 15;
                player.position.x = Math.max(-mapSize, Math.min(mapSize, player.position.x));
                player.position.z = Math.max(-mapSize, Math.min(mapSize, player.position.z));
                player.position.y = 0.5;

                // Emit position if it's the local player
                if (playerId === this.socket.id) {
                    this.socket.emit('move', {
                        x: player.position.x,
                        y: player.position.y,
                        z: player.position.z
                    });
                }
            }
        });
    }
}

// Start the game
new Game(); 