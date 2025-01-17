import * as THREE from 'three';

export class HealthBar {
    private container: HTMLDivElement;
    private fill: HTMLDivElement;
    private maxHealth: number;
    private currentHealth: number;
    private parent3D: THREE.Mesh;
    private camera: THREE.Camera;

    constructor(camera: THREE.Camera, parent3D: THREE.Mesh, maxHealth: number = 100) {
        this.maxHealth = maxHealth;
        this.currentHealth = maxHealth;
        this.parent3D = parent3D;
        this.camera = camera;

        // Create container div
        this.container = document.createElement('div');
        this.container.style.cssText = `
            position: absolute;
            width: 50px;
            height: 5px;
            background-color: #ff0000;
            pointer-events: none;
            transform: translate(-50%, -50%);
        `;

        // Create health fill div
        this.fill = document.createElement('div');
        this.fill.style.cssText = `
            width: 100%;
            height: 100%;
            background-color: #00ff00;
            transition: width 0.2s;
        `;

        this.container.appendChild(this.fill);
        document.body.appendChild(this.container);

        this.updatePosition();
    }

    public updatePosition(): void {
        // Get screen position
        const screenPosition = this.get2DPosition(this.parent3D.position);
        
        if (screenPosition) {
            this.container.style.display = 'block';
            this.container.style.left = `${screenPosition.x}px`;
            this.container.style.top = `${screenPosition.y - 30}px`; // Offset above the object
        } else {
            this.container.style.display = 'none';
        }
    }

    private get2DPosition(position3D: THREE.Vector3): { x: number, y: number } | null {
        const vector = position3D.clone();
        vector.project(this.camera);

        // Check if the point is behind the camera
        if (vector.z > 1) {
            return null;
        }

        return {
            x: (vector.x * 0.5 + 0.5) * window.innerWidth,
            y: (-vector.y * 0.5 + 0.5) * window.innerHeight
        };
    }

    public takeDamage(amount: number): boolean {
        this.currentHealth = Math.max(0, this.currentHealth - amount);
        this.updateHealthBar();
        return this.currentHealth <= 0;
    }

    public heal(amount: number): void {
        this.currentHealth = Math.min(this.maxHealth, this.currentHealth + amount);
        this.updateHealthBar();
    }

    private updateHealthBar(): void {
        const healthPercent = (this.currentHealth / this.maxHealth) * 100;
        this.fill.style.width = `${healthPercent}%`;
    }

    public remove(): void {
        document.body.removeChild(this.container);
    }
} 