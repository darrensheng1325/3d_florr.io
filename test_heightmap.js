// Simple test script for the heightmap system
// Run with: node test_heightmap.js

const { HeightmapUtils } = require('./dist/shared/heightmap.js');

console.log('Testing Heightmap System...\n');

// Test 1: Generate a simple heightmap
console.log('Test 1: Generating heightmap...');
try {
    const heightmap = HeightmapUtils.generateHeightmap({
        width: 64,
        height: 64,
        resolution: 1,
        algorithm: 'perlin',
        seed: 12345,
        octaves: 2,
        frequency: 0.05,
        amplitude: 1,
        minHeight: -2,
        maxHeight: 2,
        smoothing: 1
    });
    
    console.log('✓ Heightmap generated successfully');
    console.log(`  - Size: ${heightmap.width}x${heightmap.height}`);
    console.log(`  - Resolution: ${heightmap.resolution}`);
    console.log(`  - Height range: ${heightmap.minHeight} to ${heightmap.maxHeight}`);
    console.log(`  - Grid size: ${heightmap.heights[0].length}x${heightmap.heights.length}`);
    
} catch (error) {
    console.log('✗ Heightmap generation failed:', error.message);
}

// Test 2: Modify heightmap
console.log('\nTest 2: Modifying heightmap...');
try {
    const heightmap = HeightmapUtils.generateHeightmap({
        width: 32,
        height: 32,
        resolution: 1,
        algorithm: 'random',
        minHeight: 0,
        maxHeight: 1
    });
    
    const modification = {
        type: 'raise',
        x: 16,
        z: 16,
        radius: 8,
        intensity: 2,
        falloff: 'gaussian'
    };
    
    const modified = HeightmapUtils.modifyHeightmap(heightmap, modification);
    console.log('✓ Heightmap modification successful');
    console.log(`  - Original max height: ${heightmap.maxHeight}`);
    console.log(`  - Modified max height: ${modified.maxHeight}`);
    
} catch (error) {
    console.log('✗ Heightmap modification failed:', error.message);
}

// Test 3: Get height at position
console.log('\nTest 3: Getting height at position...');
try {
    const heightmap = HeightmapUtils.generateHeightmap({
        width: 16,
        height: 16,
        resolution: 1,
        algorithm: 'perlin',
        minHeight: -1,
        maxHeight: 1
    });
    
    const height = HeightmapUtils.getHeightAt(heightmap, 0, 0);
    const normal = HeightmapUtils.getNormalAt(heightmap, 0, 0);
    
    console.log('✓ Height and normal calculation successful');
    console.log(`  - Height at (0,0): ${height.toFixed(3)}`);
    console.log(`  - Normal at (0,0): (${normal.x.toFixed(3)}, ${normal.y.toFixed(3)}, ${normal.z.toFixed(3)})`);
    
} catch (error) {
    console.log('✗ Height calculation failed:', error.message);
}

// Test 4: Export/Import
console.log('\nTest 4: Export/Import functionality...');
try {
    const heightmap = HeightmapUtils.generateHeightmap({
        width: 8,
        height: 8,
        resolution: 1,
        algorithm: 'random',
        minHeight: 0,
        maxHeight: 1
    });
    
    // Export to JSON
    const jsonExport = HeightmapUtils.exportHeightmap(heightmap, 'json');
    console.log('✓ JSON export successful');
    
    // Import from JSON
    const imported = HeightmapUtils.importHeightmap(jsonExport, 'json', 8, 8, 1);
    console.log('✓ JSON import successful');
    console.log(`  - Imported size: ${imported.width}x${imported.height}`);
    
} catch (error) {
    console.log('✗ Export/Import failed:', error.message);
}

// Test 5: Chunk creation
console.log('\nTest 5: Chunk creation...');
try {
    const heightmap = HeightmapUtils.generateHeightmap({
        width: 32,
        height: 32,
        resolution: 1,
        algorithm: 'perlin',
        minHeight: -1,
        maxHeight: 1
    });
    
    const chunk = HeightmapUtils.createChunk(heightmap, 0, 0, 16);
    console.log('✓ Chunk creation successful');
    console.log(`  - Chunk size: ${chunk.width}x${chunk.height}`);
    console.log(`  - Chunk position: (${chunk.x}, ${chunk.z})`);
    
} catch (error) {
    console.log('✗ Chunk creation failed:', error.message);
}

console.log('\nHeightmap system tests completed!');
console.log('\nTo test the full system:');
console.log('1. Run: npm run build');
console.log('2. Open: dist/terrain_editor.html');
console.log('3. Use the terrain editor to create and modify heightmaps');
console.log('4. Test in-game by running the main game');
