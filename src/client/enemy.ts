import * as THREE from 'three';
import { HealthBar } from './health';
import ladybugSvg from './ladybug.svg';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

export enum EnemyType {
    LADYBUG = 'ladybug',
    BEE = 'bee',
    CENTIPEDE = 'centipede',
    CENTIPEDE_SEGMENT = 'centipede_segment'  // For the body segments
}

interface EnemyStats {
    health: number;
    size: number;
}

const ENEMY_STATS: Record<EnemyType, EnemyStats> = {
    [EnemyType.LADYBUG]: {
        health: 50,
        size: 0.5
    },
    [EnemyType.BEE]: {
        health: 30,
        size: 0.4
    },
    [EnemyType.CENTIPEDE]: {
        health: 40,
        size: 0.3
    },
    [EnemyType.CENTIPEDE_SEGMENT]: {
        health: 25,
        size: 0.3
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

    constructor(scene: THREE.Scene, position: THREE.Vector3, camera: THREE.Camera, type: EnemyType, id: string, health: number, isAggressive: boolean) {
        this.type = type;
        this.id = id;
        this.scene = scene;
        this.camera = camera;
        this.health = health;
        this.isAggressive = isAggressive;
        this.mesh = new THREE.Mesh(); // Initialize with empty mesh
        this.createModel();

        const stats = ENEMY_STATS[type];

        if (type === EnemyType.LADYBUG) {
            // Create the base mesh with appropriate material based on type
            const geometry = new THREE.SphereGeometry(stats.size, 64, 32);
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
        } else if (type === EnemyType.BEE) {
            // For bees, create an invisible mesh as the base while we load the model
            const geometry = new THREE.BoxGeometry(0.01, 0.01, 0.01);
            const material = new THREE.MeshBasicMaterial({ visible: false });
            this.mesh = new THREE.Mesh(geometry, material);
            
            // Load the bee model
            Enemy.gltfLoader.load(
                '/bee.glb',
                (gltf) => {
                    console.log('Bee model loaded successfully');
                    const model = gltf.scene;
                    
                    // Apply MeshBasicMaterial to all meshes in the model
                    model.traverse((child) => {
                        if (child instanceof THREE.Mesh) {
                            const oldMaterial = child.material as THREE.MeshStandardMaterial;
                            // Create a flat, unlit material that ignores lighting
                            const newMaterial = new THREE.MeshBasicMaterial({
                                color: oldMaterial.color,
                                map: oldMaterial.map,
                                side: THREE.DoubleSide,  // Render both sides
                                toneMapped: false,       // Disable tone mapping
                                fog: false               // Disable fog effect
                            });
                            child.material = newMaterial;
                        }
                    });

                    // Scale the model to match our game size
                    model.scale.set(0.5, 0.5, 0.5);
                    // Rotate 90 degrees to the right
                    model.rotation.y = -Math.PI / 2;
                    // Add the model to our base mesh
                    this.mesh.add(model);
                },
                (progress) => {
                    console.log('Loading bee model:', (progress.loaded / progress.total * 100) + '%');
                },
                (error) => {
                    console.error('Error loading bee model:', error);
                }
            );
        } else if (type === EnemyType.CENTIPEDE || type === EnemyType.CENTIPEDE_SEGMENT) {
            // Create the main sphere for the body segment
            const geometry = new THREE.SphereGeometry(stats.size);
            const material = new THREE.MeshPhongMaterial({ 
                color: 0x8fc45b,
                shininess: 30,
                specular: 0x333333
            });
            this.mesh = new THREE.Mesh(geometry, material);

            // Add antennae only for the head segment
            if (type === EnemyType.CENTIPEDE) {
                const antennaGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.4);
                const antennaMaterial = new THREE.MeshPhongMaterial({ 
                    color: 0x000000,
                    shininess: 30,
                    specular: 0x333333
                });
                
                // Left antenna
                const leftAntenna = new THREE.Mesh(antennaGeometry, antennaMaterial);
                leftAntenna.position.set(-0.15, 0.2, 0);
                leftAntenna.rotation.z = Math.PI / 4;
                this.mesh.add(leftAntenna);
                
                // Right antenna
                const rightAntenna = new THREE.Mesh(antennaGeometry, antennaMaterial);
                rightAntenna.position.set(0.15, 0.2, 0);
                rightAntenna.rotation.z = -Math.PI / 4;
                this.mesh.add(rightAntenna);
            }
        }

        this.mesh.position.copy(position);
        this.scene.add(this.mesh);

        // Add health bar
        this.healthBar = new HealthBar(camera, this.mesh, stats.health);

        // Add decorative elements based on type
        this.addDecorativeElements();
    }

    private createModel(): void {
        const stats = ENEMY_STATS[this.type];
        
        if (this.type === EnemyType.LADYBUG) {
            // Create the base mesh with appropriate material based on type
            const geometry = new THREE.SphereGeometry(stats.size, 64, 32);
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
        } else if (this.type === EnemyType.BEE) {
            // For bees, create an invisible mesh as the base while we load the model
            const geometry = new THREE.BoxGeometry(0.01, 0.01, 0.01);
            const material = new THREE.MeshBasicMaterial({ visible: false });
            this.mesh = new THREE.Mesh(geometry, material);
            
            // Load the bee model
            Enemy.gltfLoader.load(
                '/bee.glb',
                (gltf) => {
                    console.log('Bee model loaded successfully');
                    const model = gltf.scene;
                    
                    // Apply MeshBasicMaterial to all meshes in the model
                    model.traverse((child) => {
                        if (child instanceof THREE.Mesh) {
                            const oldMaterial = child.material as THREE.MeshStandardMaterial;
                            // Create a flat, unlit material that ignores lighting
                            const newMaterial = new THREE.MeshBasicMaterial({
                                color: oldMaterial.color,
                                map: oldMaterial.map,
                                side: THREE.DoubleSide,  // Render both sides
                                toneMapped: false,       // Disable tone mapping
                                fog: false               // Disable fog effect
                            });
                            child.material = newMaterial;
                        }
                    });

                    // Scale the model to match our game size
                    model.scale.set(0.5, 0.5, 0.5);
                    // Rotate 90 degrees to the right
                    model.rotation.y = -Math.PI / 2;
                    // Add the model to our base mesh
                    this.mesh.add(model);
                },
                (progress) => {
                    console.log('Loading bee model:', (progress.loaded / progress.total * 100) + '%');
                },
                (error) => {
                    console.error('Error loading bee model:', error);
                }
            );
        } else if (this.type === EnemyType.CENTIPEDE || this.type === EnemyType.CENTIPEDE_SEGMENT) {
            // Create the main sphere for the body segment
            const geometry = new THREE.SphereGeometry(stats.size);
            const material = new THREE.MeshPhongMaterial({ 
                color: 0x8fc45b,
                shininess: 30,
                specular: 0x333333
            });
            this.mesh = new THREE.Mesh(geometry, material);

            // Add antennae only for the head segment
            if (this.type === EnemyType.CENTIPEDE) {
                const antennaGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.4);
                const antennaMaterial = new THREE.MeshPhongMaterial({ 
                    color: 0x000000,
                    shininess: 30,
                    specular: 0x333333
                });
                
                // Left antenna
                const leftAntenna = new THREE.Mesh(antennaGeometry, antennaMaterial);
                leftAntenna.position.set(-0.15, 0.2, 0);
                leftAntenna.rotation.z = Math.PI / 4;
                this.mesh.add(leftAntenna);
                
                // Right antenna
                const rightAntenna = new THREE.Mesh(antennaGeometry, antennaMaterial);
                rightAntenna.position.set(0.15, 0.2, 0);
                rightAntenna.rotation.z = -Math.PI / 4;
                this.mesh.add(rightAntenna);
            }
        }
    }

    protected getBaseColor(): number {
        switch (this.type) {
            case EnemyType.LADYBUG:
                return 0xff0000; // Red
            case EnemyType.BEE:
                return 0xffff00; // Gold
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
        this.mesh.position.set(position.x, position.y, position.z);
        
        // Update rotation based on enemy type
        if (this.type === EnemyType.LADYBUG) {
            // For ladybug, subtract 90 degrees to make it face the movement direction
            this.mesh.rotation.y = rotation - Math.PI/2;
        } else {
            // For other enemies, use rotation directly
            this.mesh.rotation.y = rotation;
        }

        // Update health bar position
        if (this.healthBar) {
            this.healthBar.updatePosition();
        }
    }

    public takeDamage(amount: number): boolean {
        return this.healthBar.takeDamage(amount);
    }

    public remove(): void {
        this.scene.remove(this.mesh);
        this.healthBar.remove();
    }

    public getPosition(): THREE.Vector3 {
        return this.mesh.position;
    }

    public getId(): string {
        return this.id;
    }
} 