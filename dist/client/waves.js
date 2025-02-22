"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WaveUI = void 0;
var types_1 = require("../shared/types");
var WaveUI = /** @class */ (function () {
    function WaveUI() {
        // Create main container
        this.container = document.createElement('div');
        this.container.style.position = 'absolute';
        this.container.style.top = '20px';
        this.container.style.left = '50%';
        this.container.style.transform = 'translateX(-50%)';
        this.container.style.textAlign = 'center';
        this.container.style.zIndex = '1000';
        this.container.style.display = 'none';
        document.body.appendChild(this.container);
        // Create wave text
        this.waveText = document.createElement('div');
        this.waveText.style.color = 'white';
        this.waveText.style.fontFamily = 'Arial, sans-serif';
        this.waveText.style.fontSize = '32px';
        this.waveText.style.fontWeight = 'bold';
        this.waveText.style.textShadow = '2px 2px 4px rgba(0,0,0,0.5)';
        this.waveText.style.marginBottom = '10px';
        this.waveText.textContent = 'Wave 1'; // Set initial text
        this.container.appendChild(this.waveText);
        // Create rarity text
        this.rarityText = document.createElement('div');
        this.rarityText.style.fontSize = '16px';
        this.rarityText.style.marginTop = '5px';
        this.container.appendChild(this.rarityText);
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
        // Create progress text
        this.progressText = document.createElement('div');
        this.progressText.style.fontSize = '16px';
        this.progressText.style.marginTop = '5px';
        this.container.appendChild(this.progressText);
        // Create XP text
        this.xpText = document.createElement('div');
        this.xpText.style.fontSize = '16px';
        this.xpText.style.marginTop = '5px';
        this.container.appendChild(this.xpText);
        // Add progress text
        var progressText = document.createElement('div');
        progressText.style.position = 'absolute';
        progressText.style.width = '100%';
        progressText.style.textAlign = 'center';
        progressText.style.color = 'white';
        progressText.style.fontFamily = 'Arial, sans-serif';
        progressText.style.fontSize = '14px';
        progressText.style.fontWeight = 'bold';
        progressText.style.textShadow = '1px 1px 2px rgba(0,0,0,0.5)';
        progressText.style.lineHeight = '20px'; // Same as progress bar height
        progressText.textContent = '0 / 20 enemies - 0 XP';
        this.progressContainer.appendChild(progressText);
    }
    WaveUI.prototype.update = function (wave, enemiesKilled, totalXP, minRarity) {
        // Update wave text
        this.waveText.textContent = "Wave ".concat(wave);
        // Calculate progress
        var killProgress = Math.min((enemiesKilled / 20) * 100, 100);
        var xpProgress = Math.min((totalXP / 1000) * 100, 100);
        // Update progress bars
        this.killProgress.style.width = "".concat(killProgress, "%");
        this.xpProgress.style.width = "".concat(xpProgress, "%");
        // Update progress text
        var progressText = this.progressContainer.querySelector('div:last-child');
        progressText.textContent = "".concat(enemiesKilled, " / 20 enemies - ").concat(totalXP, " XP");
        // Layer the progress bars
        if (xpProgress > killProgress) {
            this.xpProgress.style.zIndex = '2';
            this.killProgress.style.zIndex = '1';
        }
        else {
            this.xpProgress.style.zIndex = '1';
            this.killProgress.style.zIndex = '2';
        }
        if (minRarity) {
            this.rarityText.textContent = "Minimum Rarity: ".concat(minRarity);
            // Update rarity color
            var rarityColor = '#' + types_1.RARITY_COLORS[minRarity].toString(16).padStart(6, '0');
            this.rarityText.style.color = rarityColor;
            // Add glow effect for higher rarities
            if (minRarity === types_1.Rarity.LEGENDARY || minRarity === types_1.Rarity.EPIC) {
                this.rarityText.style.textShadow = "0 0 10px ".concat(rarityColor);
            }
            else {
                this.rarityText.style.textShadow = 'none';
            }
        }
    };
    WaveUI.prototype.show = function () {
        this.container.style.display = 'block';
    };
    WaveUI.prototype.hide = function () {
        this.container.style.display = 'none';
    };
    WaveUI.prototype.remove = function () {
        document.body.removeChild(this.container);
    };
    return WaveUI;
}());
exports.WaveUI = WaveUI;
//# sourceMappingURL=waves.js.map