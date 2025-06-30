"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PetalType = exports.BasePetalType = exports.ItemType = exports.MODEL_BASE_SIZES = exports.BASE_SIZES = exports.RARITY_DAMAGE_MULTIPLIERS = exports.RARITY_MULTIPLIERS = exports.RARITY_COLORS = exports.Rarity = void 0;
exports.getPetalType = getPetalType;
exports.parsePetalType = parsePetalType;
var Rarity;
(function (Rarity) {
    Rarity["COMMON"] = "COMMON";
    Rarity["UNCOMMON"] = "UNCOMMON";
    Rarity["RARE"] = "RARE";
    Rarity["EPIC"] = "EPIC";
    Rarity["LEGENDARY"] = "LEGENDARY";
    Rarity["MYTHIC"] = "MYTHIC";
})(Rarity || (exports.Rarity = Rarity = {}));
exports.RARITY_COLORS = {
    [Rarity.COMMON]: 0x82ee6c, // Light green
    [Rarity.UNCOMMON]: 0xffe55e, // Yellow
    [Rarity.RARE]: 0x4f51e2, // Blue
    [Rarity.EPIC]: 0x861ee0, // Purple
    [Rarity.LEGENDARY]: 0xff0000, // Red
    [Rarity.MYTHIC]: 0xff00ff // Pink
};
exports.RARITY_MULTIPLIERS = {
    [Rarity.COMMON]: 1,
    [Rarity.UNCOMMON]: 1.5,
    [Rarity.RARE]: 2.25,
    [Rarity.EPIC]: 3.375,
    [Rarity.LEGENDARY]: 5,
    [Rarity.MYTHIC]: 7.5
};
// Damage multiplier for each rarity level (1.2x scaling)
exports.RARITY_DAMAGE_MULTIPLIERS = {
    [Rarity.COMMON]: 1,
    [Rarity.UNCOMMON]: 1.2,
    [Rarity.RARE]: 1.44, // 1.2^2
    [Rarity.EPIC]: 1.728, // 1.2^3
    [Rarity.LEGENDARY]: 2.074, // 1.2^4
    [Rarity.MYTHIC]: 2.488 // 1.2^5
};
// Base sizes for each enemy type
exports.BASE_SIZES = {
    ladybug: 0.5,
    bee: 0.15, // Reduced from 0.25
    centipede: 0.3,
    centipede_segment: 0.3,
    spider: 0.4,
    soldier_ant: 0.2,
    worker_ant: 0.2,
    baby_ant: 0.15 // Same size as bee
};
// Base model sizes (for 3D models)
exports.MODEL_BASE_SIZES = {
    bee: 0.4, // The size the bee model was designed for
    spider: 0.4, // The size the spider model was designed for
    soldier_ant: 0.2, // The size the soldier ant model was designed for
    worker_ant: 0.2, // The size the worker ant model was designed for
    baby_ant: 0.15 // The size the baby ant model was designed for
};
var ItemType;
(function (ItemType) {
    ItemType["TETRAHEDRON"] = "TETRAHEDRON";
    ItemType["LEAF"] = "LEAF";
    ItemType["STINGER"] = "STINGER";
    ItemType["PEA"] = "PEA";
    ItemType["CUBE"] = "CUBE";
})(ItemType || (exports.ItemType = ItemType = {}));
// Base petal types (without rarity suffixes)
var BasePetalType;
(function (BasePetalType) {
    BasePetalType["BASIC"] = "BASIC";
    BasePetalType["TETRAHEDRON"] = "TETRAHEDRON";
    BasePetalType["CUBE"] = "CUBE";
    BasePetalType["LEAF"] = "LEAF";
    BasePetalType["STINGER"] = "STINGER";
    BasePetalType["PEA"] = "PEA";
})(BasePetalType || (exports.BasePetalType = BasePetalType = {}));
// Full petal types (including rarity variations) - keeping for backward compatibility
var PetalType;
(function (PetalType) {
    PetalType["BASIC"] = "BASIC";
    PetalType["BASIC_UNCOMMON"] = "basic_uncommon";
    PetalType["BASIC_RARE"] = "basic_rare";
    PetalType["TETRAHEDRON"] = "tetrahedron";
    PetalType["TETRAHEDRON_EPIC"] = "tetrahedron_epic";
    PetalType["CUBE"] = "cube";
    PetalType["CUBE_LEGENDARY"] = "cube_legendary";
    PetalType["LEAF"] = "leaf";
    PetalType["STINGER"] = "stinger";
    PetalType["PEA"] = "pea";
})(PetalType || (exports.PetalType = PetalType = {}));
// Helper function to get petal type from base type and rarity
function getPetalType(baseType, rarity) {
    if (rarity === Rarity.COMMON) {
        return baseType;
    }
    return `${baseType.toLowerCase()}_${rarity.toLowerCase()}`;
}
// Helper function to extract base type and rarity from petal type
function parsePetalType(petalType) {
    const parts = petalType.split('_');
    if (parts.length === 1) {
        // Common rarity, no suffix
        return {
            baseType: parts[0].toUpperCase(),
            rarity: Rarity.COMMON
        };
    }
    else {
        // Has rarity suffix
        const baseType = parts[0].toUpperCase();
        const rarityStr = parts.slice(1).join('_').toUpperCase();
        return { baseType, rarity: rarityStr };
    }
}
//# sourceMappingURL=types.js.map