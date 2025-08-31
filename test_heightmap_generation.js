const io = require('socket.io-client');

console.log('Testing heightmap generation...');

async function testHeightmapGeneration() {
    try {
        console.log('Connecting to server...');
        
        const socket = io('http://localhost:3000', {
            timeout: 5000,
            forceNew: true
        });

        socket.on('connect', () => {
            console.log('✅ Connected to server');
            
            // Test terrain generation
            console.log('Testing terrain generation...');
            const generationParams = {
                width: 30,
                height: 30,
                resolution: 1,
                algorithm: 'perlin',
                seed: 12345,
                octaves: 4,
                frequency: 0.02,
                amplitude: 1,
                minHeight: -5,
                maxHeight: 5,
                smoothing: 2
            };
            
            socket.emit('generateTerrain', generationParams);
        });

        socket.on('terrainGenerationResult', (result) => {
            if (result.success) {
                console.log('✅ Terrain generation successful!');
                console.log(`  Size: ${result.heightmap.width}x${result.heightmap.height}`);
                console.log(`  Resolution: ${result.heightmap.resolution}`);
                console.log(`  Heights: ${result.heightmap.heights.length}x${result.heightmap.heights[0]?.length || 0}`);
                
                // Now test getting the generated heightmap
                console.log('Testing heightmap data retrieval...');
                socket.emit('getHeightmapData');
            } else {
                console.error('❌ Terrain generation failed:', result.error);
            }
        });

        socket.on('heightmapData', (data) => {
            console.log('✅ Heightmap data after generation:');
            console.log(`  Size: ${data.width}x${data.height}`);
            console.log(`  Resolution: ${data.resolution}`);
            console.log(`  Heights: ${data.heights.length}x${data.heights[0]?.length || 0}`);
            
            // Test getting height at specific position
            console.log('Testing height query at position (5, 5)...');
            socket.emit('getTerrainHeight', { x: 5, z: 5 });
        });

        socket.on('terrainHeight', (data) => {
            console.log(`✅ Height at (${data.x}, ${data.z}): ${data.height}`);
        });

        socket.on('connect_error', (error) => {
            console.error('❌ Connection error:', error.message);
        });

        // Wait for responses
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        console.log('Test completed');
        socket.disconnect();
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

testHeightmapGeneration().then(() => {
    console.log('Generation test finished');
    process.exit(0);
}).catch(error => {
    console.error('Generation test error:', error);
    process.exit(1);
});
