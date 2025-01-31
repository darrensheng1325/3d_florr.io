import * as THREE from 'three';
import { HealthBar } from './health';
import ladybugSvg from './ladybug.svg';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { Rarity, RARITY_COLORS, RARITY_MULTIPLIERS, BASE_SIZES, MODEL_BASE_SIZES, EnemyType } from '../shared/types';

interface EnemyStats {
    health: number;
    size: number;
}

const ENEMY_STATS: Record<EnemyType, EnemyStats> = {
    ladybug: {
        health: 50,
        size: BASE_SIZES.ladybug
    },
    bee: {
        health: 30,
        size: BASE_SIZES.bee
    },
    centipede: {
        health: 40,
        size: BASE_SIZES.centipede
    },
    centipede_segment: {
        health: 25,
        size: BASE_SIZES.centipede_segment
    },
    spider: {
        health: 60,
        size: BASE_SIZES.spider
    }
};

// Add name mapping for enemies
const ENEMY_NAMES: Record<EnemyType, string> = {
    ladybug: 'Ladybug',
    bee: 'Bee',
    centipede: 'Centipede',
    centipede_segment: 'Segment',
    spider: 'Spider'
};

export class Enemy {
    private scene: THREE.Scene;
    private mesh: THREE.Mesh;
    private healthBar: HealthBar;
    private type: EnemyType;
    private id: string;
    private static gltfLoader = new GLTFLoader();
    private health: number;
    private isAggressive: boolean;
    private camera: THREE.Camera;
    private position: THREE.Vector3;
    private maxHealth: number;
    private rarity: Rarity;
    private descriptionElement?: HTMLDivElement;

    constructor(
        scene: THREE.Scene,
        position: THREE.Vector3,
        camera: THREE.PerspectiveCamera,
        type: EnemyType,
        id: string,
        health: number,
        isAggressive: boolean,
        rarity: Rarity
    ) {
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
            const enemyName = ENEMY_NAMES[type];
            const rarityColor = RARITY_COLORS[rarity];
            this.descriptionElement.innerHTML = `${enemyName} <span style="color: ${rarityColor}">[${rarity}]</span>`;
            
            document.body.appendChild(this.descriptionElement);
        }

        // Calculate base size and rarity multiplier
        const baseSize = ENEMY_STATS[type].size;
        const rarityMultiplier = 1 + (RARITY_MULTIPLIERS[rarity] - 1) * 0.5; // Same formula as server
        const finalSize = baseSize * rarityMultiplier;

        if (type === 'ladybug') {
            // Create the base mesh with appropriate material based on type
            const geometry = new THREE.SphereGeometry(finalSize, 64, 32);
            // Load the SVG texture with clean mapping
            const texture = new THREE.TextureLoader().load(ladybugSvg);
            texture.minFilter = THREE.LinearFilter;
            texture.magFilter = THREE.LinearFilter;
            texture.wrapS = THREE.ClampToEdgeWrapping;
            texture.wrapT = THREE.ClampToEdgeWrapping;
            texture.center.set(0.5, 0.5);
            texture.rotation = -Math.PI / 2;  // Rotate texture -90 degrees (left)

            const material = new THREE.MeshPhongMaterial({
                map: texture,
                side: THREE.FrontSide,
                shininess: 30,
                specular: 0x333333,
                emissive: 0x000000,
                color: 0xffffff
            });
            this.mesh = new THREE.Mesh(geometry, material);
            this.mesh.rotateY(-Math.PI / 2);  // Rotate mesh -90 degrees (left) around Y axis
        } else if (type === 'bee' || type === 'spider') {
            // For bees and spiders, create an invisible mesh as the base while we load the model
            const geometry = new THREE.BoxGeometry(0.01, 0.01, 0.01);
            const material = new THREE.MeshBasicMaterial({ visible: false });
            this.mesh = new THREE.Mesh(geometry, material);
            
            // Load the model
            const modelPath = type === 'bee' ? '/bee.glb' : '/spider.glb';
            Enemy.gltfLoader.load(
                modelPath,
                (gltf) => {
                    const model = gltf.scene;
                    
                    // Apply materials and setup model
                    model.traverse((child) => {
                        if (child instanceof THREE.Mesh) {
                            const oldMaterial = child.material as THREE.MeshStandardMaterial;
                            const newMaterial = new THREE.MeshBasicMaterial({
                                color: oldMaterial.color,
                                map: oldMaterial.map,
                                side: THREE.DoubleSide,
                                toneMapped: false,
                                fog: false
                            });
                            child.material = newMaterial;
                        }
                    });

                    // Scale the model based on final size
                    const modelBaseSize = type === 'bee' ? MODEL_BASE_SIZES.bee : MODEL_BASE_SIZES.spider;
                    const modelScale = finalSize / modelBaseSize;
                    model.scale.set(modelScale, modelScale, modelScale);
                    model.rotation.y = -Math.PI / 2;
                    this.mesh.add(model);
                },
                (progress) => {
                    console.log(`Loading ${type} model:`, (progress.loaded / progress.total * 100) + '%');
                },
                (error) => {
                    console.error(`Error loading ${type} model:`, error);
                }
            );
        } else if (type === 'centipede' || type === 'centipede_segment') {
            // Create the main sphere for the body segment
            const geometry = new THREE.SphereGeometry(finalSize);
            const material = new THREE.MeshPhongMaterial({ 
                color: 0x8fc45b,
                shininess: 30,
                specular: 0x333333
            });
            this.mesh = new THREE.Mesh(geometry, material);

            // Add antennae only for the head segment
            if (type === 'centipede') {
                const antennaGeometry = new THREE.CylinderGeometry(
                    0.02 * rarityMultiplier, // Base thickness
                    0.01 * rarityMultiplier, // Tip thickness (tapered)
                    finalSize * 2.0, // Make them much longer (increased from 1.2)
                    8 // segments
                );
                const antennaMaterial = new THREE.MeshPhongMaterial({ 
                    color: 0x000000, // Pure black
                    shininess: 10,
                    specular: 0x111111
                });
                
                // Left antenna
                const leftAntenna = new THREE.Mesh(antennaGeometry, antennaMaterial);
                leftAntenna.position.set(-finalSize * 0.3, finalSize * 0.8, 0); // Higher position
                leftAntenna.rotation.z = Math.PI / 3; // Adjust angle
                this.mesh.add(leftAntenna);
                
                // Right antenna
                const rightAntenna = new THREE.Mesh(antennaGeometry, antennaMaterial);
                rightAntenna.position.set(finalSize * 0.3, finalSize * 0.8, 0); // Higher position
                rightAntenna.rotation.z = -Math.PI / 3; // Adjust angle
                this.mesh.add(rightAntenna);
            }
        }

        this.mesh.position.copy(position);
        this.scene.add(this.mesh);

        // Add health bar
        this.healthBar = new HealthBar(camera, this.mesh, health);
    }

    protected getBaseColor(): number {
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
    }

    protected addDecorativeElements(): void {
        if (this.type === 'bee') {
            // Nothing needed here anymore as we're using the model
        }
    }

    public updatePosition(position: { x: number, y: number, z: number }, rotation: number): void {
        this.position.set(position.x, position.y, position.z);
        this.mesh.position.copy(this.position);
        
        // Apply rotation based on enemy type
        if (this.type === 'ladybug') {
            this.mesh.rotation.y = rotation - Math.PI / 2; // Always rotate ladybugs 90 degrees left
        } else {
            this.mesh.rotation.y = rotation;
        }

        // Update health bar position
        if (this.healthBar) {
            this.healthBar.updatePosition();
        }

        // Update description position only if it exists
        if (this.descriptionElement) {
            const screenPosition = this.position.clone();
            screenPosition.y -= ENEMY_STATS[this.type].size * 1.2;
            screenPosition.project(this.camera);
            
            const x = (screenPosition.x * 0.5 + 0.5) * window.innerWidth;
            const y = (-screenPosition.y * 0.5 + 0.5) * window.innerHeight;
            
            this.descriptionElement.style.transform = `translate(-50%, -50%)`;
            this.descriptionElement.style.left = x + 'px';
            this.descriptionElement.style.top = y + 'px';
            
            // Hide if behind camera
            if (screenPosition.z > 1) {
                this.descriptionElement.style.display = 'none';
            } else {
                this.descriptionElement.style.display = 'block';
            }
        }
    }

    public takeDamage(amount: number): boolean {
        return this.healthBar.takeDamage(amount);
    }

    public remove(): void {
        this.scene.remove(this.mesh);
        this.healthBar.remove();
        // Remove description element if it exists
        if (this.descriptionElement && this.descriptionElement.parentNode) {
            this.descriptionElement.parentNode.removeChild(this.descriptionElement);
        }
    }

    public getPosition(): THREE.Vector3 {
        return this.position;
    }

    public getId(): string {
        return this.id;
    }
} 