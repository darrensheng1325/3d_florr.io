"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dbManager = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const types_1 = require("../shared/types");
class DatabaseManager {
    constructor() {
        this.data = {};
        this.dbPath = path_1.default.join(__dirname, '../../data/accounts.json');
        this.loadData();
    }
    loadData() {
        try {
            if (fs_1.default.existsSync(this.dbPath)) {
                const rawData = fs_1.default.readFileSync(this.dbPath, 'utf8');
                this.data = JSON.parse(rawData);
                // Migrate old format to new format if needed
                this.migrateOldData();
            }
        }
        catch (error) {
            console.error('Error loading database:', error);
            this.data = {};
        }
    }
    migrateOldData() {
        let migrationNeeded = false;
        Object.values(this.data).forEach(account => {
            let accountMigrated = false;
            // Check if this account has old format petals in the petals array
            if (account.inventory.petals && account.inventory.petals.length > 0) {
                const firstPetal = account.inventory.petals[0];
                // If it has a 'type' property, it's old format
                if ('type' in firstPetal && !('baseType' in firstPetal)) {
                    console.log(`Migrating account ${account.id} petals array from old format to new format`);
                    migrationNeeded = true;
                    accountMigrated = true;
                    // Convert old format to new format
                    const baseTypeGroups = {};
                    const oldPetals = account.inventory.petals;
                    oldPetals.forEach(oldPetal => {
                        const petalType = oldPetal.type;
                        const amount = oldPetal.amount || 1;
                        // Parse the old petal type to get base type and rarity
                        const { baseType, rarity } = (0, types_1.parsePetalType)(petalType);
                        if (!baseTypeGroups[baseType]) {
                            baseTypeGroups[baseType] = {
                                [types_1.Rarity.COMMON]: 0,
                                [types_1.Rarity.UNCOMMON]: 0,
                                [types_1.Rarity.RARE]: 0,
                                [types_1.Rarity.EPIC]: 0,
                                [types_1.Rarity.LEGENDARY]: 0,
                                [types_1.Rarity.MYTHIC]: 0
                            };
                        }
                        baseTypeGroups[baseType][rarity] += amount;
                    });
                    // Convert to new format
                    const newPetals = [];
                    Object.entries(baseTypeGroups).forEach(([baseType, rarities]) => {
                        newPetals.push({
                            baseType: baseType,
                            rarities: rarities
                        });
                    });
                    account.inventory.petals = newPetals;
                }
            }
            // Check if this account has items in collectedItems that should be migrated to new petal format
            if (account.inventory.collectedItems && account.inventory.collectedItems.length > 0) {
                // Check if we need to migrate from collectedItems to new petal format
                // This happens when collectedItems has petal types that need to be migrated
                const petalItemsInCollected = account.inventory.collectedItems.filter(item => item.type === 'PEA' || item.type === 'LEAF' || item.type === 'STINGER' ||
                    item.type === 'CUBE' || item.type === 'TETRAHEDRON' ||
                    item.type.includes('_') // rarity variants like pea_uncommon
                );
                // Check if any of these items represent significant quantities that should be migrated
                const hasSignificantPetalItems = petalItemsInCollected.some(item => item.amount > 0);
                if (hasSignificantPetalItems) {
                    console.log(`Migrating account ${account.id} collected items to new petal format`);
                    migrationNeeded = true;
                    // Group collected items by base type and rarity
                    const baseTypeGroups = {};
                    account.inventory.collectedItems.forEach(item => {
                        // Only migrate petal-type items
                        const petalTypes = ['pea', 'leaf', 'stinger', 'cube', 'tetrahedron', 'basic'];
                        const isPetalType = petalTypes.some(type => item.type === type || item.type.startsWith(type + '_'));
                        if (isPetalType) {
                            try {
                                const { baseType, rarity } = (0, types_1.parsePetalType)(item.type);
                                if (!baseTypeGroups[baseType]) {
                                    baseTypeGroups[baseType] = {
                                        [types_1.Rarity.COMMON]: 0,
                                        [types_1.Rarity.UNCOMMON]: 0,
                                        [types_1.Rarity.RARE]: 0,
                                        [types_1.Rarity.EPIC]: 0,
                                        [types_1.Rarity.LEGENDARY]: 0,
                                        [types_1.Rarity.MYTHIC]: 0
                                    };
                                }
                                baseTypeGroups[baseType][rarity] += item.amount;
                                console.log(`  Migrating ${item.amount}x ${item.type} -> ${baseType} (${rarity})`);
                            }
                            catch (error) {
                                console.log(`  Skipping unknown petal type: ${item.type}`);
                            }
                        }
                    });
                    // Merge with existing petals or create new
                    Object.entries(baseTypeGroups).forEach(([baseType, rarities]) => {
                        const existingEntry = account.inventory.petals.find(p => p.baseType === baseType);
                        if (existingEntry) {
                            // Merge with existing
                            Object.entries(rarities).forEach(([rarity, count]) => {
                                existingEntry.rarities[rarity] += count;
                            });
                        }
                        else {
                            // Create new entry
                            account.inventory.petals.push({
                                baseType: baseType,
                                rarities: rarities
                            });
                        }
                    });
                    console.log(`  Migration complete for account ${account.id}`);
                }
            }
        });
        if (migrationNeeded) {
            this.saveData();
            console.log('Database migration completed');
        }
    }
    saveData() {
        try {
            const dir = path_1.default.dirname(this.dbPath);
            if (!fs_1.default.existsSync(dir)) {
                fs_1.default.mkdirSync(dir, { recursive: true });
            }
            fs_1.default.writeFileSync(this.dbPath, JSON.stringify(this.data, null, 2));
        }
        catch (error) {
            console.error('Error saving database:', error);
        }
    }
    getAccount(accountId) {
        return this.data[accountId] || null;
    }
    createAccount(accountId) {
        const newAccount = {
            id: accountId,
            lastSeen: Date.now(),
            totalXP: 0,
            highestWave: 0,
            inventory: {
                petals: [],
                collectedItems: []
            },
            stats: {
                totalKills: 0,
                totalDeaths: 0,
                totalPlayTime: 0,
                bestXP: 0
            }
        };
        this.data[accountId] = newAccount;
        // Give new accounts 5 common basic petals to start with
        this.addPetal(accountId, types_1.BasePetalType.BASIC, types_1.Rarity.COMMON, 5);
        this.saveData();
        return newAccount;
    }
    updateAccount(accountId, updates) {
        const account = this.data[accountId];
        if (!account) {
            throw new Error(`Account ${accountId} not found`);
        }
        Object.assign(account, updates);
        account.lastSeen = Date.now();
        this.saveData();
    }
    addPetal(accountId, baseType, rarity = types_1.Rarity.COMMON, amount = 1) {
        const account = this.data[accountId];
        if (!account) {
            throw new Error(`Account ${accountId} not found`);
        }
        // Find existing entry for this base type
        let petalEntry = account.inventory.petals.find(p => p.baseType === baseType);
        if (!petalEntry) {
            // Create new entry
            petalEntry = {
                baseType: baseType,
                rarities: {
                    [types_1.Rarity.COMMON]: 0,
                    [types_1.Rarity.UNCOMMON]: 0,
                    [types_1.Rarity.RARE]: 0,
                    [types_1.Rarity.EPIC]: 0,
                    [types_1.Rarity.LEGENDARY]: 0,
                    [types_1.Rarity.MYTHIC]: 0
                }
            };
            account.inventory.petals.push(petalEntry);
        }
        petalEntry.rarities[rarity] += amount;
        account.lastSeen = Date.now();
        this.saveData();
    }
    removePetal(accountId, baseType, rarity = types_1.Rarity.COMMON, amount = 1) {
        const account = this.data[accountId];
        if (!account) {
            console.log(`[removePetal] Account ${accountId} not found`);
            throw new Error(`Account ${accountId} not found`);
        }
        const petalEntry = account.inventory.petals.find(p => p.baseType === baseType);
        if (!petalEntry) {
            console.log(`[removePetal] No petal entry found for baseType: ${baseType}`);
            return false;
        }
        const availableAmount = petalEntry.rarities[rarity];
        console.log(`[removePetal] Trying to remove ${amount} ${baseType} (${rarity}), available: ${availableAmount}`);
        if (availableAmount < amount) {
            console.log(`[removePetal] Not enough petals - need ${amount}, have ${availableAmount}`);
            return false; // Not enough petals of this type/rarity
        }
        petalEntry.rarities[rarity] -= amount;
        console.log(`[removePetal] Successfully removed ${amount} ${baseType} (${rarity}), remaining: ${petalEntry.rarities[rarity]}`);
        // If all rarities are 0, remove the entry
        const hasAnyPetals = Object.values(petalEntry.rarities).some(count => count > 0);
        if (!hasAnyPetals) {
            const index = account.inventory.petals.indexOf(petalEntry);
            account.inventory.petals.splice(index, 1);
            console.log(`[removePetal] Removed empty petal entry for ${baseType}`);
        }
        account.lastSeen = Date.now();
        this.saveData();
        return true;
    }
    // Legacy method for backward compatibility - converts old petal type format
    addPetalLegacy(accountId, petalType) {
        const { baseType, rarity } = (0, types_1.parsePetalType)(petalType);
        this.addPetal(accountId, baseType, rarity);
    }
    // Legacy method for backward compatibility - converts old petal type format
    removePetalLegacy(accountId, petalType) {
        const { baseType, rarity } = (0, types_1.parsePetalType)(petalType);
        return this.removePetal(accountId, baseType, rarity);
    }
    // Get petals in the old format for backward compatibility
    getPetalsLegacyFormat(accountId) {
        const account = this.data[accountId];
        if (!account) {
            return [];
        }
        const legacyPetals = [];
        account.inventory.petals.forEach(petalEntry => {
            Object.entries(petalEntry.rarities).forEach(([rarity, amount]) => {
                if (amount > 0) {
                    const petalType = (0, types_1.getPetalType)(petalEntry.baseType, rarity);
                    legacyPetals.push({
                        type: petalType,
                        amount: amount
                    });
                }
            });
        });
        return legacyPetals;
    }
    addCollectedItem(accountId, itemType) {
        const account = this.data[accountId];
        if (!account) {
            throw new Error(`Account ${accountId} not found`);
        }
        const existingItem = account.inventory.collectedItems.find(item => item.type === itemType);
        if (existingItem) {
            existingItem.amount++;
        }
        else {
            account.inventory.collectedItems.push({
                type: itemType,
                amount: 1
            });
        }
        account.lastSeen = Date.now();
        this.saveData();
    }
    removeCollectedItem(accountId, itemType) {
        const account = this.data[accountId];
        if (!account) {
            throw new Error(`Account ${accountId} not found`);
        }
        const itemIndex = account.inventory.collectedItems.findIndex(item => item.type === itemType);
        if (itemIndex !== -1) {
            const item = account.inventory.collectedItems[itemIndex];
            item.amount--;
            if (item.amount <= 0) {
                account.inventory.collectedItems.splice(itemIndex, 1);
            }
        }
        account.lastSeen = Date.now();
        this.saveData();
    }
    updateStats(accountId, stats) {
        const account = this.data[accountId];
        if (!account) {
            throw new Error(`Account ${accountId} not found`);
        }
        Object.assign(account.stats, stats);
        account.lastSeen = Date.now();
        this.saveData();
    }
    getAllAccounts() {
        return Object.values(this.data);
    }
    getTopPlayers(limit = 10) {
        return Object.values(this.data)
            .sort((a, b) => b.totalXP - a.totalXP)
            .slice(0, limit);
    }
}
exports.dbManager = new DatabaseManager();
//# sourceMappingURL=database.js.map