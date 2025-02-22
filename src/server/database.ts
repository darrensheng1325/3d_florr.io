import fs from 'fs';
import path from 'path';
import { PetalType } from '../shared/types';

interface AccountData {
    id: string;
    lastSeen: number;
    totalXP: number;
    highestWave: number;
    inventory: {
        petals: Array<{
            type: PetalType;
            amount: number;
        }>;
        collectedItems: Array<{
            type: string;
            amount: number;
        }>;
    };
    stats: {
        totalKills: number;
        totalDeaths: number;
        totalPlayTime: number;
        bestXP: number;
    };
}

class DatabaseManager {
    private dbPath: string;
    private data: { [accountId: string]: AccountData } = {};

    constructor() {
        this.dbPath = path.join(__dirname, '../../data/accounts.json');
        this.ensureDbExists();
        this.loadData();
    }

    private ensureDbExists(): void {
        const dir = path.dirname(this.dbPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        if (!fs.existsSync(this.dbPath)) {
            fs.writeFileSync(this.dbPath, JSON.stringify({}, null, 2));
        }
    }

    private loadData(): void {
        try {
            const fileContent = fs.readFileSync(this.dbPath, 'utf-8');
            this.data = JSON.parse(fileContent);
        } catch (error) {
            console.error('Error loading database:', error);
            this.data = {};
        }
    }

    private saveData(): void {
        try {
            fs.writeFileSync(this.dbPath, JSON.stringify(this.data, null, 2));
        } catch (error) {
            console.error('Error saving database:', error);
        }
    }

    public getAccount(accountId: string): AccountData | null {
        return this.data[accountId] || null;
    }

    public createAccount(accountId: string): AccountData {
        const newAccount: AccountData = {
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

    public updateAccount(accountId: string, updates: Partial<AccountData>): void {
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

    public updateStats(accountId: string, gameStats: {
        timeAlive: number;
        highestWave: number;
        totalXP: number;
        kills?: number;
    }): void {
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

    public addPetal(accountId: string, type: PetalType): void {
        const account = this.data[accountId];
        if (!account) {
            throw new Error(`Account ${accountId} not found`);
        }

        const existingPetal = account.inventory.petals.find(p => p.type === type);
        if (existingPetal) {
            existingPetal.amount++;
        } else {
            account.inventory.petals.push({
                type,
                amount: 1
            });
        }

        account.lastSeen = Date.now();
        this.saveData();
    }

    public removePetal(accountId: string, type: PetalType): void {
        const account = this.data[accountId];
        if (!account) {
            throw new Error(`Account ${accountId} not found`);
        }

        const petalIndex = account.inventory.petals.findIndex(p => p.type === type);
        if (petalIndex !== -1) {
            const petal = account.inventory.petals[petalIndex];
            petal.amount--;
            if (petal.amount <= 0) {
                account.inventory.petals.splice(petalIndex, 1);
            }
        }

        account.lastSeen = Date.now();
        this.saveData();
    }

    public addCollectedItem(accountId: string, itemType: string): void {
        const account = this.data[accountId];
        if (!account) {
            throw new Error(`Account ${accountId} not found`);
        }

        const existingItem = account.inventory.collectedItems.find(item => item.type === itemType);
        if (existingItem) {
            existingItem.amount++;
        } else {
            account.inventory.collectedItems.push({
                type: itemType,
                amount: 1
            });
        }

        account.lastSeen = Date.now();
        this.saveData();
    }

    public getCollectedItems(accountId: string): Array<{
        type: string;
        amount: number;
    }> {
        const account = this.data[accountId];
        if (!account) {
            throw new Error(`Account ${accountId} not found`);
        }

        return account.inventory.collectedItems;
    }

    public clearCollectedItems(accountId: string): void {
        const account = this.data[accountId];
        if (!account) {
            throw new Error(`Account ${accountId} not found`);
        }

        account.inventory.collectedItems = [];
        account.lastSeen = Date.now();
        this.saveData();
    }

    public getLeaderboard(sortBy: 'totalXP' | 'bestXP' | 'highestWave' = 'totalXP', limit: number = 10): Array<{
        accountId: string;
        value: number;
    }> {
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
export const dbManager = new DatabaseManager(); 