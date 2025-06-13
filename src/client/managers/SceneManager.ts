import * as THREE from 'three';
import { LightingConfig } from '../../shared/types';
import { ServerConfig } from '../../server/server_config';

export class SceneManager {
    public scene: THREE.Scene;
    public camera: THREE.PerspectiveCamera;
    public renderer: THREE.WebGLRenderer;

    private ambientLight: THREE.AmbientLight;
    private directionalLight: THREE.DirectionalLight;
    private hemisphereLight: THREE.HemisphereLight;
    private ground: THREE.Mesh;
    private gridHelper: THREE.GridHelper;
    private readonly mapSize: number;

    constructor(mapSize: number) {
        this.mapSize = mapSize;
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer();
        
        // Initialize lights with default values
        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        this.directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
        this.hemisphereLight = new THREE.HemisphereLight(0x9BE2FF, 0x00ff2d, 0.8);

        // Initialize grid helper with default values
        this.gridHelper = new THREE.GridHelper(30, 30, 0x038f21, 0x038f21);

        // Create ground plane
        const groundGeometry = new THREE.PlaneGeometry(this.mapSize * 2, this.mapSize * 2);
        const groundMaterial = new THREE.MeshPhongMaterial({
            color: ServerConfig.getInstance().getCurrentConfig().hemisphereLight.groundColor,
            side: THREE.DoubleSide,
            shininess: 0
        });
        this.ground = new THREE.Mesh(groundGeometry, groundMaterial);

        this.init();
    }

    private init(): void {
        // Setup renderer
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        document.body.appendChild(this.renderer.domElement);

        // Set default background color
        this.scene.background = new THREE.Color(0x87CEEB);

        // Add lights
        this.scene.add(this.ambientLight);
        this.directionalLight.position.set(0, 10, 0);
        this.directionalLight.target.position.set(0, 0, 0);
        this.scene.add(this.directionalLight);
        this.scene.add(this.directionalLight.target);
        this.scene.add(this.hemisphereLight);

        // Add ground to scene
        this.ground.rotation.x = -Math.PI / 2;
        this.ground.position.y = 0;
        this.scene.add(this.ground);

        // Add grid helper
        this.gridHelper.position.y = 0.01;
        this.scene.add(this.gridHelper);

        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize());
    }

    public updateLighting(config: LightingConfig): void {
        // Update ambient light
        this.ambientLight.color.setHex(config.ambientLight.color);
        this.ambientLight.intensity = config.ambientLight.intensity;

        // Update directional light
        this.directionalLight.color.setHex(config.directionalLight.color);
        this.directionalLight.intensity = config.directionalLight.intensity;
        this.directionalLight.position.set(
            config.directionalLight.position.x,
            config.directionalLight.position.y,
            config.directionalLight.position.z
        );

        // Update hemisphere light
        this.hemisphereLight.color.setHex(config.hemisphereLight.skyColor);
        this.hemisphereLight.groundColor.setHex(config.hemisphereLight.groundColor);
        this.hemisphereLight.intensity = config.hemisphereLight.intensity;
        
        // Update sky color
        this.scene.background = new THREE.Color(config.skyColor);
        
        // Update ground color
        if (this.ground && this.ground.material instanceof THREE.MeshPhongMaterial) {
            this.ground.material.color.setHex(config.hemisphereLight.groundColor);
            this.ground.material.needsUpdate = true;
        }

        // Update grid color
        if (config.gridConfig && this.gridHelper) {
            this.scene.remove(this.gridHelper);
            this.gridHelper = new THREE.GridHelper(30, 30, config.gridConfig.gridColor, config.gridConfig.gridColor);
            this.gridHelper.position.y = 0.01;
            this.scene.add(this.gridHelper);
        }
    }
    
    public getGround(): THREE.Mesh {
        return this.ground;
    }

    private onWindowResize(): void {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
} 
