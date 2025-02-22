"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthBar = void 0;
var HealthBar = /** @class */ (function () {
    function HealthBar(camera, parent3D, maxHealth) {
        if (maxHealth === void 0) { maxHealth = 100; }
        this.maxHealth = maxHealth;
        this.currentHealth = maxHealth;
        this.parent3D = parent3D;
        this.camera = camera;
        // Create container div
        this.container = document.createElement('div');
        this.container.style.cssText = "\n            position: fixed;\n            width: 50px;\n            height: 5px;\n            background-color: #ff0000;\n            pointer-events: none;\n            transform: translate(-50%, -50%);\n            z-index: 1000;\n            display: none;\n        ";
        // Create health fill div
        this.fill = document.createElement('div');
        this.fill.style.cssText = "\n            width: 100%;\n            height: 100%;\n            background-color: #00ff00;\n            transition: width 0.2s;\n        ";
        this.container.appendChild(this.fill);
        document.body.appendChild(this.container);
        // Add global styles to prevent scrollbars if not already added
        if (!document.getElementById('healthbar-styles')) {
            var style = document.createElement('style');
            style.id = 'healthbar-styles';
            style.textContent = "\n                body {\n                    margin: 0;\n                    padding: 0;\n                    overflow: hidden;\n                }\n                canvas {\n                    display: block;\n                }\n            ";
            document.head.appendChild(style);
        }
        this.updatePosition();
    }
    HealthBar.prototype.updatePosition = function () {
        // Get screen position
        var screenPosition = this.get2DPosition(this.parent3D.position);
        if (screenPosition && this.isOnScreen(screenPosition)) {
            this.container.style.display = 'block';
            this.container.style.left = "".concat(screenPosition.x, "px");
            this.container.style.top = "".concat(screenPosition.y - 30, "px"); // Offset above the object
        }
        else {
            this.container.style.display = 'none';
        }
    };
    HealthBar.prototype.isOnScreen = function (position) {
        var margin = 50; // Buffer for health bar width/height
        return position.x >= -margin &&
            position.x <= window.innerWidth + margin &&
            position.y >= -margin &&
            position.y <= window.innerHeight + margin;
    };
    HealthBar.prototype.get2DPosition = function (position3D) {
        var vector = position3D.clone();
        vector.project(this.camera);
        // Check if the point is behind the camera or too far to sides
        if (vector.z > 1 || Math.abs(vector.x) > 1.1 || Math.abs(vector.y) > 1.1) {
            return null;
        }
        return {
            x: (vector.x * 0.5 + 0.5) * window.innerWidth,
            y: (-vector.y * 0.5 + 0.5) * window.innerHeight
        };
    };
    HealthBar.prototype.takeDamage = function (amount) {
        this.currentHealth = Math.max(0, this.currentHealth - amount);
        this.updateHealthBar();
        return this.currentHealth <= 0;
    };
    HealthBar.prototype.heal = function (amount) {
        this.currentHealth = Math.min(this.maxHealth, this.currentHealth + amount);
        this.updateHealthBar();
    };
    HealthBar.prototype.setHealth = function (percentage) {
        this.currentHealth = (percentage / 100) * this.maxHealth;
        this.updateHealthBar();
    };
    HealthBar.prototype.updateHealthBar = function () {
        var percentage = (this.currentHealth / this.maxHealth) * 100;
        this.fill.style.width = "".concat(percentage, "%");
    };
    HealthBar.prototype.remove = function () {
        document.body.removeChild(this.container);
    };
    return HealthBar;
}());
exports.HealthBar = HealthBar;
//# sourceMappingURL=health.js.map