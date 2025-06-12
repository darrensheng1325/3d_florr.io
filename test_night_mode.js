// Test script to verify night mode lighting configuration
const { ServerConfig } = require('./dist/server/server_config.js');

console.log('Testing Night Mode Lighting Configuration...\n');

// Create a server config instance
const serverConfig = ServerConfig.getInstance('default');

// Test day mode lighting
console.log('=== DAY MODE LIGHTING ===');
const dayConfig = serverConfig.getLightingConfig(false);
console.log('Sky Color:', '0x' + dayConfig.skyColor.toString(16));
console.log('Ambient Light:', {
    color: '0x' + dayConfig.ambientLight.color.toString(16),
    intensity: dayConfig.ambientLight.intensity
});
console.log('Directional Light:', {
    color: '0x' + dayConfig.directionalLight.color.toString(16),
    intensity: dayConfig.directionalLight.intensity,
    position: dayConfig.directionalLight.position
});

console.log('\n=== NIGHT MODE LIGHTING ===');
const nightConfig = serverConfig.getLightingConfig(true);
console.log('Sky Color:', '0x' + nightConfig.skyColor.toString(16));
console.log('Ambient Light:', {
    color: '0x' + nightConfig.ambientLight.color.toString(16),
    intensity: nightConfig.ambientLight.intensity
});
console.log('Directional Light:', {
    color: '0x' + nightConfig.directionalLight.color.toString(16),
    intensity: nightConfig.directionalLight.intensity,
    position: nightConfig.directionalLight.position
});

// Test night mode detection
console.log('\n=== WAVE NIGHT MODE DETECTION ===');
for (let wave = 1; wave <= 20; wave++) {
    const isNight = ((wave - 1) % 10) + 1 >= 5 && ((wave - 1) % 10) + 1 <= 9;
    console.log(`Wave ${wave}: ${isNight ? 'NIGHT' : 'DAY'}`);
}

console.log('\n✅ Night mode lighting configuration test completed!'); 