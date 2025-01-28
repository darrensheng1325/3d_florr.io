import * as THREE from 'three';

export enum ItemType {
    TETRAHEDRON = 'tetrahedron',
    CUBE = 'cube'
}

export class Item {
    private mesh: THREE.Mesh;
    private scene: THREE.Scene;
    private id: string;
    private type: ItemType;
    private floatOffset: number;
    private startTime: number;

    constructor(scene: THREE.Scene, position: THREE.Vector3, type: ItemType, id: string) {
        this.scene = scene;
        this.id = id;
        this.type = type;
        this.startTime = Date.now();
        this.floatOffset = Math.random() * Math.PI * 2; // Random starting phase

        // Create mesh based on item type
        let geometry: THREE.BufferGeometry;
        if (type === ItemType.TETRAHEDRON) {
            geometry = new THREE.TetrahedronGeometry(0.3);
        } else {
            geometry = new THREE.BoxGeometry(0.3, 0.3, 0.3);
        }

        const material = new THREE.MeshPhongMaterial({
            color: type === ItemType.TETRAHEDRON ? 0xff0000 : 0x0000ff,
            shininess: 100,
            specular: 0xffffff
        });

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(position);
        this.scene.add(this.mesh);
    }

    public update(): void {
        // Make item float and rotate
        const time = (Date.now() - this.startTime) * 0.001;
        this.mesh.position.y = 0.3 + Math.sin(time * 2 + this.floatOffset) * 0.1;
        this.mesh.rotation.y = time * 2;
    }

    public remove(): void {
        this.scene.remove(this.mesh);
    }

    public getPosition(): THREE.Vector3 {
        return this.mesh.position;
    }

    public getId(): string {
        return this.id;
    }

    public getType(): ItemType {
        return this.type;
    }
} 