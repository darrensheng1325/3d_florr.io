"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PetalType = exports.MODEL_BASE_SIZES = exports.BASE_SIZES = exports.RARITY_MULTIPLIERS = exports.RARITY_COLORS = exports.Rarity = void 0;
var Rarity;
(function (Rarity) {
    Rarity["COMMON"] = "common";
    Rarity["UNCOMMON"] = "uncommon";
    Rarity["RARE"] = "rare";
    Rarity["EPIC"] = "epic";
    Rarity["LEGENDARY"] = "legendary";
})(Rarity || (exports.Rarity = Rarity = {}));
exports.RARITY_COLORS = {
    [Rarity.COMMON]: '#82ee6c', // White
    [Rarity.UNCOMMON]: '#ffe55e', // Green
    [Rarity.RARE]: '#4f51e2', // Blue
    [Rarity.EPIC]: '#861ee0', // Purple
    [Rarity.LEGENDARY]: '#ff0000' // Gold
};
exports.RARITY_MULTIPLIERS = {
    [Rarity.COMMON]: 1,
    [Rarity.UNCOMMON]: 1.5,
    [Rarity.RARE]: 2.25,
    [Rarity.EPIC]: 3.375,
    [Rarity.LEGENDARY]: 5
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
var PetalType;
(function (PetalType) {
    PetalType["BASIC"] = "basic";
    PetalType["BASIC_UNCOMMON"] = "basic_uncommon";
    PetalType["BASIC_RARE"] = "basic_rare";
    PetalType["TETRAHEDRON"] = "tetrahedron";
    PetalType["TETRAHEDRON_EPIC"] = "tetrahedron_epic";
    PetalType["CUBE"] = "cube";
    PetalType["CUBE_LEGENDARY"] = "cube_legendary";
    PetalType["LEAF"] = "leaf";
    PetalType["STINGER"] = "stinger";
})(PetalType || (exports.PetalType = PetalType = {}));
//# sourceMappingURL=types.js.map