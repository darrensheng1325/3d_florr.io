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
    loadData() {
        try {
            const fileContent = fs_1.default.readFileSync(this.dbPath, 'utf-8');
            this.data = JSON.parse(fileContent);
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
                petals: []
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