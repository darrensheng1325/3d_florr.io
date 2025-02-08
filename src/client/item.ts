import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

export enum ItemType {
    TETRAHEDRON = 'tetrahedron',
    CUBE = 'cube',
    LEAF = 'leaf',
    STINGER = 'stinger'
}

export class Item {
    private mesh: THREE.Mesh | THREE.Group | null = null;
    private scene: THREE.Scene;
    private id: string;
    private type: ItemType;
    private floatOffset: number;
    private startTime: number;
    private static leafModel: THREE.Group | null = null;
    private static modelLoader = new GLTFLoader();

    constructor(scene: THREE.Scene, position: THREE.Vector3, type: ItemType, id: string) {
        this.scene = scene;
        this.id = id;
        this.type = type;
        this.startTime = Date.now();
        this.floatOffset = Math.random() * Math.PI * 2; // Random starting phase

        if (type === ItemType.LEAF) {
            // Load the leaf model if not already loaded
            if (!Item.leafModel) {
                Item.modelLoader.load('leaf.glb', (gltf) => {
                    Item.leafModel = gltf.scene;
                    this.initLeafModel(position);
                });
            } else {
                this.initLeafModel(position);
            }
        } else {
            // Create geometry based on type
            let geometry: THREE.BufferGeometry;
            if (type === ItemType.TETRAHEDRON) {
                geometry = new THREE.TetrahedronGeometry(0.3);
            } else if (type === ItemType.STINGER) {
                geometry = new THREE.ConeGeometry(0.15, 0.4, 16); // Cone shape for stinger
            } else {
                geometry = new THREE.BoxGeometry(0.3, 0.3, 0.3);
            }

            // Create material based on type
            const material = new THREE.MeshPhongMaterial({
                color: this.getItemColor(),
                shininess: 30,
                transparent: type !== ItemType.STINGER // Make stinger opaque
            });

            this.mesh = new THREE.Mesh(geometry, material);
            this.mesh.position.copy(position);
            this.scene.add(this.mesh);
        }
    }

    private getItemColor(): number {
        switch (this.type) {
            case ItemType.TETRAHEDRON:
                return 0xff0000; // Red
            case ItemType.CUBE:
                return 0x0000ff; // Blue
            case ItemType.STINGER:
                return 0xffd700; // Gold/Yellow for stinger
            default:
                return 0xffffff; // White for unknown types
        }
    }

    private initLeafModel(position: THREE.Vector3): void {
        if (Item.leafModel) {
            this.mesh = Item.leafModel.clone();
            this.mesh.position.copy(position);
            this.mesh.scale.set(0.3, 0.3, 0.3); // Adjust scale as needed
            this.scene.add(this.mesh);
        }
    }

    public update(): void {
        // Make item float and rotate
        const time = (Date.now() - this.startTime) * 0.001;
        if (this.mesh) {
            this.mesh.position.y = 0.3 + Math.sin(time * 2 + this.floatOffset) * 0.1;
            this.mesh.rotation.y = time * 2;
        }
    }

    public remove(): void {
        if (this.mesh) {
            this.scene.remove(this.mesh);
        }
    }

    public getPosition(): THREE.Vector3 {
        return this.mesh ? this.mesh.position : new THREE.Vector3();
    }

    public getId(): string {
        return this.id;
    }

    public getType(): ItemType {
        return this.type;
    }
} 