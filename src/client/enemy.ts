import * as THREE from 'three';
import { HealthBar } from './health';
import ladybugSvg from './ladybug.svg';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { Rarity, RARITY_COLORS, RARITY_MULTIPLIERS, BASE_SIZES, MODEL_BASE_SIZES } from '../shared/types';

export enum EnemyType {
    LADYBUG = 'ladybug',
    BEE = 'bee',
    CENTIPEDE = 'centipede',
    CENTIPEDE_SEGMENT = 'centipede_segment',
    SPIDER = 'spider'  // Add spider type
}

interface EnemyStats {
    health: number;
    size: number;
}

const ENEMY_STATS: Record<EnemyType, EnemyStats> = {
    [EnemyType.LADYBUG]: {
        health: 50,
        size: BASE_SIZES.ladybug
    },
    [EnemyType.BEE]: {
        health: 30,
        size: BASE_SIZES.bee
    },
    [EnemyType.CENTIPEDE]: {
        health: 40,
        size: BASE_SIZES.centipede
    },
    [EnemyType.CENTIPEDE_SEGMENT]: {
        health: 25,
        size: BASE_SIZES.centipede_segment
    },
    [EnemyType.SPIDER]: {
        health: 60,
        size: BASE_SIZES.spider
    }
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
    private aura: THREE.Mesh | null = null;
    private position: THREE.Vector3;
    private maxHealth: number;
    private rarity: Rarity;

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

        // Calculate base size and rarity multiplier
        const baseSize = ENEMY_STATS[type].size;
        const rarityMultiplier = 1 + (RARITY_MULTIPLIERS[rarity] - 1) * 0.5; // Same formula as server
        const finalSize = baseSize * rarityMultiplier;

        if (type === EnemyType.LADYBUG) {
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
        } else if (type === EnemyType.BEE || type === EnemyType.SPIDER) {
            // For bees and spiders, create an invisible mesh as the base while we load the model
            const geometry = new THREE.BoxGeometry(0.01, 0.01, 0.01);
            const material = new THREE.MeshBasicMaterial({ visible: false });
            this.mesh = new THREE.Mesh(geometry, material);
            
            // Load the model
            const modelPath = type === EnemyType.BEE ? '/bee.glb' : '/spider.glb';
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
                    const modelBaseSize = type === EnemyType.BEE ? MODEL_BASE_SIZES.bee : MODEL_BASE_SIZES.spider;
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
        } else if (type === EnemyType.CENTIPEDE || type === EnemyType.CENTIPEDE_SEGMENT) {
            // Create the main sphere for the body segment
            const geometry = new THREE.SphereGeometry(finalSize);
            const material = new THREE.MeshPhongMaterial({ 
                color: 0x8fc45b,
                shininess: 30,
                specular: 0x333333
            });
            this.mesh = new THREE.Mesh(geometry, material);

            // Add antennae only for the head segment
            if (type === EnemyType.CENTIPEDE) {
                const antennaGeometry = new THREE.CylinderGeometry(
                    0.02 * rarityMultiplier, // Scale antenna thickness with rarity
                    0.02 * rarityMultiplier,
                    finalSize * 0.8
                );
                const antennaMaterial = new THREE.MeshPhongMaterial({ 
                    color: 0x000000,
                    shininess: 30,
                    specular: 0x333333
                });
                
                // Left antenna
                const leftAntenna = new THREE.Mesh(antennaGeometry, antennaMaterial);
                leftAntenna.position.set(-finalSize * 0.3, finalSize * 0.4, 0);
                leftAntenna.rotation.z = Math.PI / 4;
                this.mesh.add(leftAntenna);
                
                // Right antenna
                const rightAntenna = new THREE.Mesh(antennaGeometry, antennaMaterial);
                rightAntenna.position.set(finalSize * 0.3, finalSize * 0.4, 0);
                rightAntenna.rotation.z = -Math.PI / 4;
                this.mesh.add(rightAntenna);
            }
        }

        this.mesh.position.copy(position);
        this.scene.add(this.mesh);

        // Add health bar
        this.healthBar = new HealthBar(camera, this.mesh, health);

        // Create rarity aura
        this.createAura(scene, finalSize);
    }

    protected getBaseColor(): number {
        switch (this.type) {
            case EnemyType.LADYBUG:
                return 0xff0000; // Red
            case EnemyType.BEE:
                return 0xffff00; // Gold
            case EnemyType.SPIDER:
                return 0x4a4a4a; // Dark gray
            default:
                return 0xff0000;
        }
    }

    protected addDecorativeElements(): void {
        if (this.type === EnemyType.BEE) {
            // Nothing needed here anymore as we're using the model
        }
    }

    public updatePosition(position: { x: number, y: number, z: number }, rotation: number): void {
        this.position.set(position.x, position.y, position.z);
        this.mesh.position.copy(this.position);
        this.mesh.rotation.y = rotation;

        // Update health bar position
        if (this.healthBar) {
            this.healthBar.updatePosition();
        }

        // Update aura position
        if (this.aura) {
            this.aura.position.copy(this.position);
        }
    }

    public takeDamage(amount: number): boolean {
        return this.healthBar.takeDamage(amount);
    }

    public remove(): void {
        this.scene.remove(this.mesh);
        this.healthBar.remove();
        if (this.aura && this.aura.parent) {
            this.aura.parent.remove(this.aura);
        }
    }

    public getPosition(): THREE.Vector3 {
        return this.position;
    }

    public getId(): string {
        return this.id;
    }

    private createAura(scene: THREE.Scene, size: number): void {
        // Create aura geometry slightly larger than the enemy
        const auraGeometry = new THREE.SphereGeometry(
            size * 1.5, // Use the final size for the aura
            32,
            32
        );

        // Create aura material with rarity color
        const auraMaterial = new THREE.ShaderMaterial({
            uniforms: {
                color: { value: new THREE.Color(RARITY_COLORS[this.rarity]) },
                time: { value: 0 }
            },
            vertexShader: `
                varying vec2 vUv;
                varying vec3 vPosition;
                void main() {
                    vUv = uv;
                    vPosition = position;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 color;
                uniform float time;
                varying vec2 vUv;
                varying vec3 vPosition;
                
                void main() {
                    float pulse = sin(time * 2.0) * 0.5 + 0.5;
                    float edge = 1.0 - smoothstep(0.4, 0.5, length(vPosition));
                    // Make aura more intense for higher rarities
                    float intensity = ${this.rarity === Rarity.LEGENDARY ? '0.6' : 
                                     this.rarity === Rarity.EPIC ? '0.5' :
                                     this.rarity === Rarity.RARE ? '0.4' :
                                     this.rarity === Rarity.UNCOMMON ? '0.3' : '0.2'};
                    float alpha = edge * (intensity + pulse * 0.2);
                    gl_FragColor = vec4(color, alpha);
                }
            `,
            transparent: true,
            side: THREE.DoubleSide
        });

        this.aura = new THREE.Mesh(auraGeometry, auraMaterial);
        scene.add(this.aura);
        
        // Start aura animation
        const animate = () => {
            if (this.aura) {
                (this.aura.material as THREE.ShaderMaterial).uniforms.time.value = performance.now() / 1000;
            }
            requestAnimationFrame(animate);
        };
        animate();
    }
} 