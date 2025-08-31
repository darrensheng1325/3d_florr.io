const io = require('socket.io-client');

console.log('Starting heightmap server test...');

// Test basic heightmap queries
async function testHeightmapSystem() {
    try {
        console.log('Connecting to server...');
        
        // Connect to the server
        const socket = io('http://localhost:3000', {
            timeout: 5000,
            forceNew: true
        });

        // Set up event handlers
        socket.on('connect', () => {
            console.log('✅ Connected to server successfully');
            
            // Test getting terrain height
            console.log('Testing terrain height query...');
            socket.emit('getTerrainHeight', { x: 0, z: 0 });
            
            // Test getting terrain config
            console.log('Testing terrain config query...');
            socket.emit('getTerrainConfig');
            
            // Test getting heightmap data
            console.log('Testing heightmap data query...');
            socket.emit('getHeightmapData');
        });

        socket.on('connect_error', (error) => {
            console.error('❌ Connection error:', error.message);
        });

        socket.on('error', (error) => {
            console.error('❌ Socket error:', error);
        });

        // Listen for responses
        socket.on('terrainHeight', (data) => {
            console.log('✅ Terrain height response:', data);
        });

        socket.on('terrainConfig', (config) => {
            console.log('✅ Terrain config response:', config);
        });

        socket.on('heightmapData', (data) => {
            console.log('✅ Heightmap data response received');
            console.log(`  Size: ${data.width}x${data.height}`);
            console.log(`  Resolution: ${data.resolution}`);
            console.log(`  Heights array: ${data.heights.length}x${data.heights[0]?.length || 0}`);
        });

        socket.on('disconnect', (reason) => {
            console.log('🔌 Disconnected from server:', reason);
        });

        // Wait for responses
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        console.log('Test completed, disconnecting...');
        socket.disconnect();
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

// Run the test
testHeightmapSystem().then(() => {
    console.log('Test script finished');
    process.exit(0);
}).catch(error => {
    console.error('Test script error:', error);
    process.exit(1);
});
