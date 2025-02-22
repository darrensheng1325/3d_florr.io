"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dbManager = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class DatabaseManager {
    constructor() {
        this.data = {};
        this.dbPath = path_1.default.join(__dirname, '../../data/accounts.json');
        this.ensureDbExists();
        this.loadData();
    }
    ensureDbExists() {
        const dir = path_1.default.dirname(this.dbPath);
        if (!fs_1.default.existsSync(dir)) {
            fs_1.default.mkdirSync(dir, { recursive: true });
        }
        if (!fs_1.default.existsSync(this.dbPath)) {
            fs_1.default.writeFileSync(this.dbPath, JSON.stringify({}, null, 2));
        }
    }
    migrateAccountData(account) {
        var _a, _b, _c, _d, _e, _f;
        // Ensure all required properties exist with default values
        return {
            id: account.id || '',
            lastSeen: account.lastSeen || Date.now(),
            totalXP: account.totalXP || 0,
            highestWave: account.highestWave || 0,
            inventory: {
                petals: ((_a = account.inventory) === null || _a === void 0 ? void 0 : _a.petals) || [],
                collectedItems: ((_b = account.inventory) === null || _b === void 0 ? void 0 : _b.collectedItems) || []
            },
            stats: {
                totalKills: ((_c = account.stats) === null || _c === void 0 ? void 0 : _c.totalKills) || 0,
                totalDeaths: ((_d = account.stats) === null || _d === void 0 ? void 0 : _d.totalDeaths) || 0,
                totalPlayTime: ((_e = account.stats) === null || _e === void 0 ? void 0 : _e.totalPlayTime) || 0,
                bestXP: ((_f = account.stats) === null || _f === void 0 ? void 0 : _f.bestXP) || 0
            }
        };
    }
    loadData() {
        try {
            const fileContent = fs_1.default.readFileSync(this.dbPath, 'utf-8');
            const rawData = JSON.parse(fileContent);
            // Migrate each account's data to ensure all required fields exist
            this.data = Object.entries(rawData).reduce((acc, [accountId, accountData]) => {
                acc[accountId] = this.migrateAccountData(accountData);
                return acc;
            }, {});
            // Save migrated data back to file
            this.saveData();
        }
        catch (error) {
            console.error('Error loading database:', error);
            this.data = {};
        }
    }
    saveData() {
        try {
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
        this.saveData();
        return newAccount;
    }
    updateAccount(accountId, updates) {
        if (!this.data[accountId]) {
            throw new Error(`Account ${accountId} not found`);
        }
        this.data[accountId] = {
            ...this.data[accountId],
            ...updates,
            lastSeen: Date.now()
        };
        this.saveData();
    }
    updateStats(accountId, gameStats) {
        const account = this.data[accountId];
        if (!account) {
            throw new Error(`Account ${accountId} not found`);
        }
        account.stats.totalPlayTime += gameStats.timeAlive;
        account.stats.totalDeaths += 1;
        account.stats.totalKills += gameStats.kills || 0;
        account.stats.bestXP = Math.max(account.stats.bestXP, gameStats.totalXP);
        account.highestWave = Math.max(account.highestWave, gameStats.highestWave);
        account.totalXP += gameStats.totalXP;
        account.lastSeen = Date.now();
        this.saveData();
    }
    saveInventory(accountId, petals) {
        const account = this.data[accountId];
        if (!account) {
            throw new Error(`Account ${accountId} not found`);
        }
        account.inventory.petals = petals;
        account.lastSeen = Date.now();
        this.saveData();
    }
    addCollectedItem(accountId, item) {
        const account = this.data[accountId];
        if (!account) {
            throw new Error(`Account ${accountId} not found`);
        }
        account.inventory.collectedItems.push({
            ...item,
            obtainedAt: Date.now()
        });
        account.lastSeen = Date.now();
        this.saveData();
    }
    getCollectedItems(accountId) {
        const account = this.data[accountId];
        if (!account) {
            throw new Error(`Account ${accountId} not found`);
        }
        return account.inventory.collectedItems;
    }
    clearCollectedItems(accountId) {
        const account = this.data[accountId];
        if (!account) {
            throw new Error(`Account ${accountId} not found`);
        }
        account.inventory.collectedItems = [];
        account.lastSeen = Date.now();
        this.saveData();
    }
    getLeaderboard(sortBy = 'totalXP', limit = 10) {
        return Object.entries(this.data)
            .map(([accountId, data]) => ({
            accountId,
            value: sortBy === 'totalXP' ? data.totalXP :
                sortBy === 'bestXP' ? data.stats.bestXP :
                    data.highestWave
        }))
            .sort((a, b) => b.value - a.value)
            .slice(0, limit);
    }
}
// Create and export a single instance
exports.dbManager = new DatabaseManager();
//# sourceMappingURL=database.js.map