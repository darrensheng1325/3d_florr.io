"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dbManager = void 0;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path_1 = __importDefault(require("path"));
class DatabaseManager {
    constructor() {
        this.db = new better_sqlite3_1.default(path_1.default.join(__dirname, '../../data/game.db'));
        this.init();
    }
    init() {
        // Create tables if they don't exist
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS players (
                id TEXT PRIMARY KEY,
                lastSeen DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS inventory_items (
                id TEXT PRIMARY KEY,
                playerId TEXT,
                petalType TEXT,
                slotIndex INTEGER,
                rarity TEXT,
                health INTEGER,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (playerId) REFERENCES players(id)
            );
        `);
    }
    addPlayer(playerId) {
        const stmt = this.db.prepare('INSERT OR REPLACE INTO players (id) VALUES (?)');
        stmt.run(playerId);
    }
    updatePlayerLastSeen(playerId) {
        const stmt = this.db.prepare('UPDATE players SET lastSeen = CURRENT_TIMESTAMP WHERE id = ?');
        stmt.run(playerId);
    }
    addInventoryItem(item) {
        const stmt = this.db.prepare(`
            INSERT INTO inventory_items (id, playerId, petalType, slotIndex, rarity, health)
            VALUES (@id, @playerId, @petalType, @slotIndex, @rarity, @health)
        `);
        stmt.run(item);
    }
    getPlayerInventory(playerId) {
        const stmt = this.db.prepare(`
            SELECT * FROM inventory_items 
            WHERE playerId = ? 
            ORDER BY slotIndex ASC
        `);
        const rows = stmt.all(playerId);
        return rows.map(row => ({
            ...row,
            createdAt: new Date(row.createdAt)
        }));
    }
    updateInventoryItemSlot(itemId, newSlotIndex) {
        const stmt = this.db.prepare('UPDATE inventory_items SET slotIndex = ? WHERE id = ?');
        stmt.run(newSlotIndex, itemId);
    }
    updateInventoryItemHealth(itemId, health) {
        const stmt = this.db.prepare('UPDATE inventory_items SET health = ? WHERE id = ?');
        stmt.run(health, itemId);
    }
    removeInventoryItem(itemId) {
        const stmt = this.db.prepare('DELETE FROM inventory_items WHERE id = ?');
        stmt.run(itemId);
    }
    clearPlayerInventory(playerId) {
        const stmt = this.db.prepare('DELETE FROM inventory_items WHERE playerId = ?');
        stmt.run(playerId);
    }
    close() {
        this.db.close();
    }
}
// Create and export a single instance
exports.dbManager = new DatabaseManager();
//# sourceMappingURL=database.js.map