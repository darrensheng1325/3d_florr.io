"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MODEL_BASE_SIZES = exports.BASE_SIZES = exports.RARITY_MULTIPLIERS = exports.RARITY_COLORS = exports.Rarity = void 0;
var Rarity;
(function (Rarity) {
    Rarity["COMMON"] = "common";
    Rarity["UNCOMMON"] = "uncommon";
    Rarity["RARE"] = "rare";
    Rarity["EPIC"] = "epic";
    Rarity["LEGENDARY"] = "legendary";
})(Rarity || (exports.Rarity = Rarity = {}));
exports.RARITY_COLORS = {
    [Rarity.COMMON]: '#ffffff', // White
    [Rarity.UNCOMMON]: '#2ecc71', // Green
    [Rarity.RARE]: '#3498db', // Blue
    [Rarity.EPIC]: '#9b59b6', // Purple
    [Rarity.LEGENDARY]: '#f1c40f' // Gold
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
    spider: 0.4
};
// Base model sizes (for 3D models)
exports.MODEL_BASE_SIZES = {
    bee: 0.4, // The size the bee model was designed for
    spider: 0.4 // The size the spider model was designed for
};
//# sourceMappingURL=types.js.map