import * as THREE from 'three';
import { HealthBar } from './health';
import ladybugSvg from './ladybug.svg';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

export enum EnemyType {
    LADYBUG = 'ladybug',
    BEE = 'bee'
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
    }
};

export class Enemy {
    private scene: THREE.Scene;
    private mesh: THREE.Mesh;
    private healthBar: HealthBar;
    private type: EnemyType;
    private id: string;
    private static gltfLoader = new GLTFLoader();

    constructor(scene: THREE.Scene, position: THREE.Vector3, camera: THREE.Camera, type: EnemyType, id: string) {
        this.type = type;
        this.id = id;
        this.scene = scene;
        
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
            texture.rotation = 0;

            const material = new THREE.MeshBasicMaterial({
                map: texture,
                side: THREE.FrontSide
            });
            this.mesh = new THREE.Mesh(geometry, material);
        } else {
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
        }

        this.mesh.position.copy(position);
        this.scene.add(this.mesh);

        // Add health bar
        this.healthBar = new HealthBar(camera, this.mesh, stats.health);

        // Add decorative elements based on type
        this.addDecorativeElements();
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

    public updatePosition(position: { x: number; y: number; z: number }, rotation: number): void {
        this.mesh.position.set(position.x, position.y, position.z);
        this.mesh.rotation.y = rotation;
        this.healthBar.updatePosition();
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