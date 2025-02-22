import fs from 'fs';
import path from 'path';

interface AccountData {
    id: string;
    lastSeen: number;
    totalXP: number;
    highestWave: number;
    inventory: {
        petals: Array<{
            type: string;
            slotIndex: number;
            rarity: string;
            health: number;
        }>;
        collectedItems: Array<{
            type: string;
            rarity: string;
            obtainedAt: number;
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

    private migrateAccountData(account: any): AccountData {
        // Ensure all required properties exist with default values
        return {
            id: account.id || '',
            lastSeen: account.lastSeen || Date.now(),
            totalXP: account.totalXP || 0,
            highestWave: account.highestWave || 0,
            inventory: {
                petals: account.inventory?.petals || [],
                collectedItems: account.inventory?.collectedItems || []
            },
            stats: {
                totalKills: account.stats?.totalKills || 0,
                totalDeaths: account.stats?.totalDeaths || 0,
                totalPlayTime: account.stats?.totalPlayTime || 0,
                bestXP: account.stats?.bestXP || 0
            }
        };
    }

    private loadData(): void {
        try {
            const fileContent = fs.readFileSync(this.dbPath, 'utf-8');
            const rawData = JSON.parse(fileContent);
            
            // Migrate each account's data to ensure all required fields exist
            this.data = Object.entries(rawData).reduce((acc, [accountId, accountData]) => {
                acc[accountId] = this.migrateAccountData(accountData);
                return acc;
            }, {} as { [accountId: string]: AccountData });

            // Save migrated data back to file
            this.saveData();
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

    public saveInventory(accountId: string, petals: Array<{
        type: string;
        slotIndex: number;
        rarity: string;
        health: number;
    }>): void {
        const account = this.data[accountId];
        if (!account) {
            throw new Error(`Account ${accountId} not found`);
        }

        account.inventory.petals = petals;
        account.lastSeen = Date.now();
        this.saveData();
    }

    public addCollectedItem(accountId: string, item: {
        type: string;
        rarity: string;
    }): void {
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

    public getCollectedItems(accountId: string): Array<{
        type: string;
        rarity: string;
        obtainedAt: number;
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