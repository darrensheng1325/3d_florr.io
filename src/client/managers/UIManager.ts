import * as THREE from 'three';
import { AccountManager } from '../account';

export class UIManager {
    private titleCanvas: HTMLCanvasElement;
    private titleCtx: CanvasRenderingContext2D;
    private deathScreen: HTMLDivElement | null = null;
    private inventoryMenu: HTMLDivElement | null = null;
    private settingsMenu: HTMLDivElement | null = null;
    private craftingMenu: HTMLDivElement | null = null;
    private isGameStarted: () => boolean;
    
    constructor(
        private accountManager: AccountManager,
        private renderer: THREE.WebGLRenderer,
        private camera: THREE.PerspectiveCamera,
        private scene: THREE.Scene,
        isGameStarted: () => boolean,
        private respawnPlayer: () => void,
    ) {
        this.isGameStarted = isGameStarted;
        this.titleCanvas = document.createElement('canvas');
        this.titleCanvas.style.position = 'absolute';
        this.titleCanvas.style.top = '0';
        this.titleCanvas.style.left = '0';
        this.titleCanvas.style.pointerEvents = 'none';
        document.body.appendChild(this.titleCanvas);
        
        const ctx = this.titleCanvas.getContext('2d');
        if (!ctx) throw new Error('Could not get 2D context');
        this.titleCtx = ctx;
        
        window.addEventListener('resize', () => this.onWindowResize());
    }
    
    public createTitleScreen(handleStartGame: () => void): void {
        this.camera.position.set(0, 15, 0);
        this.camera.lookAt(0, 0, 0);

        let angle = 0;
        
        document.addEventListener('keydown', (event) => {
            if (event.code === 'Space' && !this.isGameStarted()) {
                handleStartGame();
            }
        });

        const loginButton = document.createElement('button');
        loginButton.style.cssText = `
            position: fixed;
            top: 60%;
            left: 50%;
            transform: translateX(-50%);
            padding: 15px 30px;
            font-size: 18px;
            font-weight: bold;
            background: linear-gradient(135deg, #00FF00 0%, #AAFF00 100%);
            color: white;
            border: none;
            border-radius: 12px;
            cursor: pointer;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
            transition: all 0.3s ease;
            z-index: 1000;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        `;
        loginButton.textContent = 'Start';
        loginButton.addEventListener('click', () => handleStartGame());
        loginButton.addEventListener('mouseover', () => {
            loginButton.style.transform = 'translateX(-50%) translateY(-2px)';
            loginButton.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.3)';
        });
        loginButton.addEventListener('mouseout', () => {
            loginButton.style.transform = 'translateX(-50%)';
            loginButton.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.2)';
        });
        document.body.appendChild(loginButton);

        (window as any).titleLoginButton = loginButton;

        if (this.accountManager.hasAccount()) {
            const accountStatus = document.createElement('div');
            accountStatus.style.cssText = `
                position: fixed;
                top: 70%;
                left: 50%;
                transform: translateX(-50%);
                text-align: center;
                color: #ffffff;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                font-size: 14px;
                background: rgba(0, 0, 0, 0.5);
                padding: 10px 20px;
                border-radius: 8px;
                z-index: 1000;
            `;
            accountStatus.innerHTML = `
                <div>Welcome back, <strong>${this.accountManager.getUsername()}</strong>!</div>
                <div style="margin-top: 5px; font-size: 12px; opacity: 0.8;">Your progress will be saved automatically</div>
            `;
            document.body.appendChild(accountStatus);
            (window as any).titleAccountStatus = accountStatus;
        }

        this.onWindowResize();

        const animate = () => {
            if (!this.isGameStarted()) {
                requestAnimationFrame(animate);
                
                angle += 0.001;
                const radius = 15;
                this.camera.position.x = Math.cos(angle) * radius;
                this.camera.position.z = Math.sin(angle) * radius;
                this.camera.lookAt(0, 0, 0);

                this.renderer.render(this.scene, this.camera);
                
                this.titleCtx.clearRect(0, 0, this.titleCanvas.width, this.titleCanvas.height);
                
                this.titleCtx.font = 'bold 72px Arial';
                this.titleCtx.textAlign = 'center';
                this.titleCtx.fillStyle = '#ffffff';
                this.titleCtx.strokeStyle = '#000000';
                this.titleCtx.lineWidth = 5;
                this.titleCtx.strokeText('3dflower.io', this.titleCanvas.width / 2, this.titleCanvas.height / 3);
                this.titleCtx.fillText('3dflower.io', this.titleCanvas.width / 2, this.titleCanvas.height / 3);
                
                this.titleCtx.font = '24px Arial';
                this.titleCtx.fillStyle = '#ffffff';
                this.titleCtx.strokeStyle = '#000000';
                this.titleCtx.lineWidth = 2;
                const yOffset = Math.sin(Date.now() * 0.002) * 5;
                const subtitleText = 'Press SPACE or click Play Game to start';
                this.titleCtx.strokeText(subtitleText, this.titleCanvas.width / 2, this.titleCanvas.height / 2 + yOffset);
                this.titleCtx.fillText(subtitleText, this.titleCanvas.width / 2, this.titleCanvas.height / 2 + yOffset);
            }
        };
        animate();
    }
    
    public clearTitleScreen(): void {
        if (this.titleCanvas && this.titleCanvas.parentNode) {
            this.titleCanvas.parentNode.removeChild(this.titleCanvas);
        }
        const loginButton = (window as any).titleLoginButton;
        if (loginButton && loginButton.parentNode) {
            loginButton.parentNode.removeChild(loginButton);
        }
        const accountStatus = (window as any).titleAccountStatus;
        if (accountStatus && accountStatus.parentNode) {
            accountStatus.parentNode.removeChild(accountStatus);
        }
    }

    public createDeathScreen(respawnPlayer: () => void): void {
        this.deathScreen = document.createElement('div');
        this.deathScreen.style.position = 'fixed';
        this.deathScreen.style.top = '0';
        this.deathScreen.style.left = '0';
        this.deathScreen.style.width = '100%';
        this.deathScreen.style.height = '100%';
        this.deathScreen.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        this.deathScreen.style.display = 'flex';
        this.deathScreen.style.flexDirection = 'column';
        this.deathScreen.style.alignItems = 'center';
        this.deathScreen.style.justifyContent = 'center';
        this.deathScreen.style.zIndex = '1000';

        const deathText = document.createElement('div');
        deathText.textContent = 'You Died';
        deathText.style.color = '#ff0000';
        deathText.style.fontSize = '64px';
        deathText.style.fontFamily = 'Arial, sans-serif';
        deathText.style.fontWeight = 'bold';
        deathText.style.marginBottom = '30px';
        this.deathScreen.appendChild(deathText);

        const continueButton = document.createElement('button');
        continueButton.textContent = 'Return to Title';
        continueButton.style.padding = '15px 30px';
        continueButton.style.fontSize = '24px';
        continueButton.style.backgroundColor = '#4CAF50';
        continueButton.style.color = 'white';
        continueButton.style.border = 'none';
        continueButton.style.borderRadius = '5px';
        continueButton.style.cursor = 'pointer';
        continueButton.style.transition = 'background-color 0.3s';
        
        continueButton.addEventListener('mouseover', () => {
            continueButton.style.backgroundColor = '#45a049';
        });
        
        continueButton.addEventListener('mouseout', () => {
            continueButton.style.backgroundColor = '#4CAF50';
        });
        
        continueButton.addEventListener('click', () => {
            this.respawnPlayer();
        });
        
        this.deathScreen.appendChild(continueButton);
    }
    
    public showDeathScreen(): void {
        if (!this.deathScreen) {
            this.createDeathScreen(this.respawnPlayer);
        }
        document.body.appendChild(this.deathScreen!);
    }

    public hideDeathScreen(): void {
        if (this.deathScreen && this.deathScreen.parentNode) {
            this.deathScreen.parentNode.removeChild(this.deathScreen);
        }
    }
    
    private onWindowResize(): void {
        if (this.titleCanvas) {
            this.titleCanvas.width = window.innerWidth;
            this.titleCanvas.height = window.innerHeight;
        }
    }
} 