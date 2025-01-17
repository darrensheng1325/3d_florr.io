import * as THREE from 'three';
import { io, Socket } from 'socket.io-client';
import playerSvg from './player.svg';
import { Petal } from './petal';

class Game {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private socket: Socket;
    private players: Map<string, THREE.Mesh>;
    private cameraRotation: number = 0;
    private ground: THREE.Mesh;
    private textureLoader: THREE.TextureLoader;
    private playerPetals: Map<string, Petal[]> = new Map();

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

            // Add petals for the player
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
        
        // Update all petals
        this.playerPetals.forEach(petals => {
            petals.forEach(petal => petal.update());
        });

        this.updateCameraPosition();
        this.renderer.render(this.scene, this.camera);
    }

    private setupControls(): void {
        document.addEventListener('keydown', (event) => {
            if (!this.socket.id) return;
            
            const player = this.players.get(this.socket.id);
            if (!player) return;

            const moveSpeed = 0.2;
            const movement = { x: 0, z: 0 };
            const mapSize = 15; // Half of 30x30 map

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
    }

    private onWindowResize(): void {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}

// Start the game
new Game(); 