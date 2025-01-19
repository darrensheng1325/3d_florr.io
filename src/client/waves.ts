export class WaveUI {
    private container: HTMLDivElement;
    private waveText: HTMLDivElement;
    private progressContainer: HTMLDivElement;
    private xpProgress: HTMLDivElement;
    private killProgress: HTMLDivElement;

    constructor() {
        // Create main container
        this.container = document.createElement('div');
        this.container.style.position = 'absolute';
        this.container.style.top = '20px';
        this.container.style.left = '50%';
        this.container.style.transform = 'translateX(-50%)';
        this.container.style.textAlign = 'center';
        this.container.style.zIndex = '1000';
        document.body.appendChild(this.container);

        // Create wave text
        this.waveText = document.createElement('div');
        this.waveText.style.color = 'white';
        this.waveText.style.fontFamily = 'Arial, sans-serif';
        this.waveText.style.fontSize = '32px';
        this.waveText.style.fontWeight = 'bold';
        this.waveText.style.textShadow = '2px 2px 4px rgba(0,0,0,0.5)';
        this.waveText.style.marginBottom = '10px';
        this.waveText.textContent = 'Wave 1';  // Set initial text
        this.container.appendChild(this.waveText);

        // Create progress bar container
        this.progressContainer = document.createElement('div');
        this.progressContainer.style.width = '300px';
        this.progressContainer.style.height = '20px';
        this.progressContainer.style.backgroundColor = 'rgba(0,0,0,0.5)';
        this.progressContainer.style.borderRadius = '10px';
        this.progressContainer.style.overflow = 'hidden';
        this.progressContainer.style.position = 'relative';
        this.container.appendChild(this.progressContainer);

        // Create kill progress bar (red)
        this.killProgress = document.createElement('div');
        this.killProgress.style.width = '0%';
        this.killProgress.style.height = '100%';
        this.killProgress.style.backgroundColor = '#ff4444';
        this.killProgress.style.position = 'absolute';
        this.killProgress.style.left = '0';
        this.killProgress.style.top = '0';
        this.killProgress.style.transition = 'width 0.3s ease-in-out';
        this.progressContainer.appendChild(this.killProgress);

        // Create XP progress bar (green)
        this.xpProgress = document.createElement('div');
        this.xpProgress.style.width = '0%';
        this.xpProgress.style.height = '100%';
        this.xpProgress.style.backgroundColor = '#4CAF50';
        this.xpProgress.style.position = 'absolute';
        this.xpProgress.style.left = '0';
        this.xpProgress.style.top = '0';
        this.xpProgress.style.transition = 'width 0.3s ease-in-out';
        this.progressContainer.appendChild(this.xpProgress);

        // Add progress text
        const progressText = document.createElement('div');
        progressText.style.position = 'absolute';
        progressText.style.width = '100%';
        progressText.style.textAlign = 'center';
        progressText.style.color = 'white';
        progressText.style.fontFamily = 'Arial, sans-serif';
        progressText.style.fontSize = '14px';
        progressText.style.fontWeight = 'bold';
        progressText.style.textShadow = '1px 1px 2px rgba(0,0,0,0.5)';
        progressText.style.lineHeight = '20px';  // Same as progress bar height
        progressText.textContent = '0 / 20 enemies - 0 XP';
        this.progressContainer.appendChild(progressText);
    }

    public update(wave: number, enemiesKilled: number, totalXP: number): void {
        // Update wave text
        this.waveText.textContent = `Wave ${wave}`;

        // Calculate progress
        const killProgress = Math.min((enemiesKilled / 20) * 100, 100);
        const xpProgress = Math.min((totalXP / 1000) * 100, 100);

        // Update progress bars
        this.killProgress.style.width = `${killProgress}%`;
        this.xpProgress.style.width = `${xpProgress}%`;

        // Update progress text
        const progressText = this.progressContainer.querySelector('div:last-child') as HTMLDivElement;
        progressText.textContent = `${enemiesKilled} / 20 enemies - ${totalXP} XP`;

        // Layer the progress bars
        if (xpProgress > killProgress) {
            this.xpProgress.style.zIndex = '2';
            this.killProgress.style.zIndex = '1';
        } else {
            this.xpProgress.style.zIndex = '1';
            this.killProgress.style.zIndex = '2';
        }
    }

    public show(): void {
        this.container.style.display = 'block';
    }

    public hide(): void {
        this.container.style.display = 'none';
    }

    public remove(): void {
        document.body.removeChild(this.container);
    }
} 