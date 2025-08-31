# Heightmap System Documentation

## Overview

The heightmap system provides comprehensive terrain generation, editing, and rendering capabilities for the 3D Florr.io game. It includes both client-side and server-side components, with a visual editor for creating and modifying terrain.

## Architecture

### Core Components

1. **HeightmapUtils** (`src/shared/heightmap.ts`) - Shared utility class for heightmap operations
2. **TerrainManager** (`src/client/managers/TerrainManager.ts`) - Client-side terrain management
3. **ServerTerrainManager** (`src/server/terrain_manager.ts`) - Server-side terrain management
4. **TerrainEditor** (`src/client/terrain_editor.ts`) - Visual terrain editing interface

### Data Flow

```
TerrainEditor → HeightmapUtils → TerrainManager → Three.js Scene
     ↓              ↓              ↓
HeightmapData → HeightmapData → 3D Mesh
     ↓              ↓              ↓
Export/Import → Server Sync → Client Rendering
```

## Features

### 1. Heightmap Generation

#### Supported Algorithms
- **Perlin Noise** - Classic smooth noise generation
- **Simplex Noise** - Improved noise algorithm
- **Fractal Noise** - Multi-octave noise with persistence
- **Cellular Noise** - Voronoi-based noise patterns
- **Random** - Pure random height values

#### Generation Parameters
```typescript
interface HeightmapGenerationParams {
    width: number;           // Terrain width in world units
    height: number;          // Terrain height in world units
    resolution: number;      // Grid size between height points
    algorithm: string;       // Noise algorithm to use
    seed?: number;          // Random seed for reproducible results
    octaves?: number;       // Number of noise layers
    frequency?: number;     // Base frequency of noise
    amplitude?: number;     // Height amplitude
    persistence?: number;   // How much each octave contributes
    lacunarity?: number;    // How frequency increases per octave
    minHeight: number;      // Minimum terrain height
    maxHeight: number;      // Maximum terrain height
    smoothing?: number;     // Smoothing iterations
}
```

### 2. Terrain Editing

#### Brush Tools
- **Raise** - Increase terrain height
- **Lower** - Decrease terrain height
- **Smooth** - Average heights with neighbors
- **Flatten** - Set height to target value
- **Noise** - Add random variation

#### Brush Settings
- **Radius** - Size of brush effect
- **Intensity** - Strength of brush effect
- **Falloff** - How effect decreases from center
  - Linear - Linear decrease
  - Exponential - Exponential decrease
  - Gaussian - Bell curve decrease

### 3. Material System

#### Material Types
- **Basic** - Simple flat material
- **Phong** - Phong lighting model
- **Standard** - PBR material with roughness/metalness

#### Material Properties
- **Color** - Base terrain color
- **Roughness** - Surface roughness (0-1)
- **Metalness** - Metallic appearance (0-1)
- **Normal Map** - Surface detail mapping
- **Displacement Map** - Height-based displacement

### 4. Collision Detection

#### Terrain Collision
- Height-based collision detection
- Slope calculation and movement restrictions
- Configurable collision precision levels

#### Collision Response
- Automatic height snapping to terrain
- Slope-based movement constraints
- Fall damage prevention

### 5. Performance Features

#### Chunked Rendering
- Dynamic terrain chunk loading
- Viewport-based chunk management
- Configurable chunk sizes and limits

#### LOD System
- Distance-based detail reduction
- Automatic mesh optimization
- Memory-efficient terrain storage

## Usage

### 1. Basic Terrain Generation

```typescript
import { HeightmapUtils } from './shared/heightmap';

const heightmap = HeightmapUtils.generateHeightmap({
    width: 256,
    height: 256,
    resolution: 1,
    algorithm: 'perlin',
    seed: 12345,
    octaves: 4,
    frequency: 0.02,
    amplitude: 1,
    minHeight: -5,
    maxHeight: 5,
    smoothing: 2
});
```

### 2. Terrain Modification

```typescript
import { HeightmapUtils } from './shared/heightmap';

const modification = {
    type: 'raise',
    x: 0,
    z: 0,
    radius: 20,
    intensity: 2.0,
    falloff: 'gaussian'
};

const modifiedHeightmap = HeightmapUtils.modifyHeightmap(heightmap, modification);
```

### 3. Client-Side Integration

```typescript
import { TerrainManager } from './managers/TerrainManager';

const terrainManager = new TerrainManager(scene);
await terrainManager.initialize();

// Get height at world position
const height = terrainManager.getHeightAt(worldX, worldZ);

// Check collision
const collision = terrainManager.checkCollision(position, radius);

// Apply terrain collision to object
terrainManager.applyTerrainCollision(object, radius);
```

### 4. Server-Side Integration

```typescript
import { ServerTerrainManager } from './terrain_manager';

const terrainManager = new ServerTerrainManager();
await terrainManager.initialize();

// Get collision data for player
const collisionData = terrainManager.getCollisionData(playerPosition, radius);

// Find path with slope constraints
const path = terrainManager.findPath(start, end, maxSlope);
```

## File Formats

### 1. JSON Export
```json
{
    "width": 256,
    "height": 256,
    "resolution": 1,
    "heights": [[...], [...], ...],
    "minHeight": -5,
    "maxHeight": 5,
    "metadata": {
        "name": "Generated_perlin_1234567890",
        "created": "2024-01-01T00:00:00.000Z",
        "version": "1.0"
    }
}
```

### 2. Raw Binary Export
- 32-bit float values
- Row-major order
- No metadata

### 3. PNG Export
- Grayscale height representation
- 8-bit per channel
- Height values normalized to 0-255

## Terrain Editor

### Accessing the Editor
Navigate to `terrain_editor.html` in your browser to access the visual terrain editor.

### Editor Features
- **Real-time Preview** - See changes immediately
- **Brush Tools** - Interactive terrain sculpting
- **Preset Terrains** - Quick terrain generation
- **Undo/Redo** - Full editing history
- **Import/Export** - Multiple format support
- **Material Editor** - Visual material configuration

### Editor Workflow
1. Generate base terrain using noise algorithms
2. Use brush tools to sculpt terrain features
3. Apply material settings for visual appearance
4. Export final heightmap for use in game

## Performance Considerations

### Memory Usage
- Heightmap data: `width × height × 4 bytes` (float32)
- 256×256 heightmap ≈ 256KB
- 1024×1024 heightmap ≈ 4MB

### Rendering Performance
- Chunked rendering reduces draw calls
- LOD system improves frame rates
- GPU instancing for repeated elements

### Network Optimization
- Chunk-based terrain streaming
- Delta compression for heightmap updates
- Client-side prediction for smooth movement

## Configuration

### Terrain Configuration
```typescript
interface TerrainConfig {
    heightmap: HeightmapData;
    material: MaterialConfig;
    collision: CollisionConfig;
    rendering: RenderingConfig;
}
```

### Server Configuration
```typescript
// In server_config.ts
terrain: {
    chunkSize: 32,
    maxChunks: 16,
    collisionPrecision: 'medium',
    enablePathfinding: true
}
```

## Troubleshooting

### Common Issues

1. **Terrain Not Rendering**
   - Check if TerrainManager is initialized
   - Verify heightmap data is valid
   - Check console for errors

2. **Performance Issues**
   - Reduce chunk size
   - Limit maximum chunks
   - Enable LOD system

3. **Collision Problems**
   - Verify collision is enabled
   - Check collision precision settings
   - Ensure proper object radius

### Debug Tools
- Enable wireframe mode for geometry inspection
- Use terrain analysis tools for data validation
- Check network tab for terrain data transmission

## Future Enhancements

### Planned Features
- **Procedural Texturing** - Automatic texture generation
- **Weather Effects** - Dynamic terrain modification
- **Multiplayer Editing** - Collaborative terrain creation
- **Advanced LOD** - Adaptive detail levels
- **Terrain Streaming** - Infinite terrain generation

### Integration Opportunities
- **Physics Engine** - Advanced collision detection
- **AI Pathfinding** - Terrain-aware navigation
- **Procedural Content** - Terrain-based generation
- **Visual Effects** - Terrain-based particle systems

## API Reference

### HeightmapUtils Class
- `generateHeightmap(params)` - Create new heightmap
- `modifyHeightmap(heightmap, modification)` - Apply modifications
- `getHeightAt(heightmap, x, z)` - Get height at position
- `getNormalAt(heightmap, x, z)` - Get surface normal
- `exportHeightmap(heightmap, format)` - Export to file
- `importHeightmap(data, format, width, height, resolution)` - Import from file

### TerrainManager Class
- `initialize()` - Setup terrain system
- `getHeightAt(x, z)` - Get terrain height
- `checkCollision(position, radius)` - Check collision
- `applyTerrainCollision(object, radius)` - Apply collision
- `updateChunks(cameraPosition)` - Update visible chunks
- `exportHeightmap(format)` - Export terrain data

### ServerTerrainManager Class
- `initialize()` - Setup server terrain
- `getCollisionData(position, radius)` - Get collision info
- `findPath(start, end, maxSlope)` - Find valid path
- `analyzeTerrain()` - Get terrain statistics
- `batchModifyHeightmap(modifications)` - Apply multiple changes

## Examples

### Creating a Mountain Range
```typescript
const mountainModifications = [
    { type: 'raise', x: 0, z: 0, radius: 50, intensity: 3, falloff: 'gaussian' },
    { type: 'raise', x: 20, z: 20, radius: 30, intensity: 2, falloff: 'gaussian' },
    { type: 'smooth', x: 0, z: 0, radius: 60, intensity: 0.5, falloff: 'gaussian' }
];

for (const mod of mountainModifications) {
    heightmap = HeightmapUtils.modifyHeightmap(heightmap, mod);
}
```

### Terrain-Aware Movement
```typescript
function updatePlayerPosition(player, movement) {
    const newX = player.position.x + movement.x;
    const newZ = player.position.z + movement.z;
    const terrainHeight = terrainManager.getHeightAt(newX, newZ);
    
    player.position.x = newX;
    player.position.z = newZ;
    player.position.y = Math.max(terrainHeight + 0.5, player.position.y);
}
```

This heightmap system provides a robust foundation for creating dynamic, interactive terrain in your 3D game while maintaining good performance and extensibility.
