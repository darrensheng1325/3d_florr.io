"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccountManager = void 0;
var AccountManager = /** @class */ (function () {
    function AccountManager() {
        this.inventory = {
            petals: [],
            collectedItems: []
        };
        // Try to load existing account ID from localStorage
        var storedId = localStorage.getItem(AccountManager.ACCOUNT_ID_KEY);
        if (!storedId) {
            // Generate new ID if none exists
            var username = prompt("Enter a username");
            if (username) {
                var username_lower = username.toLowerCase().replace(/ /g, '_');
                var total_characters = 1;
                for (var i = 0; i < username_lower.length; i++) {
                    var character = username_lower.charCodeAt(i);
                    total_characters *= character;
                }
                storedId = total_characters.toString();
                localStorage.setItem(AccountManager.ACCOUNT_ID_KEY, storedId);
            }
            else {
                console.error("No username provided");
            }
        }
        this.accountId = storedId || '';
    }
    AccountManager.prototype.getAccountId = function () {
        return this.accountId;
    };
    AccountManager.prototype.getInventory = function () {
        return this.inventory;
    };
    AccountManager.prototype.setInventory = function (inventory) {
        this.inventory = inventory;
    };
    AccountManager.prototype.addPetal = function (type) {
        var existingPetal = this.inventory.petals.find(function (p) { return p.type === type; });
        if (existingPetal) {
            existingPetal.amount++;
        }
        else {
            this.inventory.petals.push({
                type: type,
                amount: 1
            });
        }
    };
    AccountManager.prototype.removePetal = function (type) {
        var petalIndex = this.inventory.petals.findIndex(function (p) { return p.type === type; });
        if (petalIndex !== -1) {
            var petal = this.inventory.petals[petalIndex];
            petal.amount--;
            if (petal.amount <= 0) {
                this.inventory.petals.splice(petalIndex, 1);
            }
        }
    };
    AccountManager.prototype.getPetalAmount = function (type) {
        var petal = this.inventory.petals.find(function (p) { return p.type === type; });
        return (petal === null || petal === void 0 ? void 0 : petal.amount) || 0;
    };
    AccountManager.prototype.addCollectedItem = function (type, rarity) {
        this.inventory.collectedItems.push({
            type: type,
            rarity: rarity,
            obtainedAt: Date.now()
        });
    };
    AccountManager.prototype.clearCollectedItems = function () {
        this.inventory.collectedItems = [];
    };
    AccountManager.ACCOUNT_ID_KEY = 'florr_account_id';
    return AccountManager;
}());
exports.AccountManager = AccountManager;
//# sourceMappingURL=account.js.map