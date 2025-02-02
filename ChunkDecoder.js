/**
 * ChunkDecoder class for Minecraft Bedrock Edition
 * Handles decoding of chunk data and block state mappings
 */
class ChunkDecoder {
  constructor() {
    // Store runtime ID to block name mappings
    // Example: { 1: "minecraft:stone", 2: "minecraft:grass", ... }
    this.blockMappings = {};

    // Cache recently decoded chunks using chunk coordinates as keys
    // Format: Map<"x,z", ChunkData>
    this.chunkCache = new Map();
  }

  /**
   * Set block state mappings from game start packet
   * These mappings are essential to convert runtime IDs to block names
   * @param {Object[]} itemstates - Array of block state definitions from server
   * @param {string} itemstates[].name - Block name (e.g., "minecraft:stone")
   * @param {number} itemstates[].runtime_id - Runtime ID assigned by server
   */
  setBlockMappings(itemstates) {
    itemstates.forEach(state => {
      if (state.runtime_id !== undefined) {
        this.blockMappings[state.runtime_id] = state.name;
      }
    });
  }

  /**
   * Decode raw chunk data from network packet
   * A chunk is a 16x16 column of blocks extending from bottom to top of world
   * @param {Buffer} payload - Raw chunk data buffer from network packet
   * @param {number} chunkX - Chunk X coordinate in chunk space
   * @param {number} chunkZ - Chunk Z coordinate in chunk space
   * @returns {Object} Decoded chunk data containing subchunks and block information
   * @throws {Error} If chunk data is invalid or decoding fails
   */
  decodeChunk(payload, chunkX, chunkZ) {
    let offset = 0;
    const chunk = {
      x: chunkX,
      z: chunkZ,
      subChunks: []
    };

    try {
      // Validate chunk payload
      if (!payload || payload.length < 2) {
        throw new Error('Invalid chunk payload: too short');
      }

      // First byte: number of subchunks in this chunk
      const subChunkCount = payload.readInt8(offset++);
      
      // Second byte: storage version used for this chunk
      const storageVersion = payload.readInt8(offset++);

      console.log('Chunk info:', {
        x: chunkX,
        z: chunkZ,
        subChunkCount,
        storageVersion
      });

      // Process each subchunk (16x16x16 cube of blocks)
      for (let y = 0; y < subChunkCount && offset < payload.length - 1; y++) {
        const subChunkData = this.decodeSubChunk(payload, offset, y);
        offset = subChunkData.newOffset;
        chunk.subChunks.push(subChunkData.data);
      }

      this.cacheChunk(chunk);
      return chunk;

    } catch (err) {
      throw new Error(`Failed to decode chunk at ${chunkX},${chunkZ}: ${err.message}`);
    }
  }

  /**
   * Decode a single subchunk section (16x16x16 blocks)
   * Each subchunk can have multiple layers for different block states
   * @param {Buffer} payload - Chunk data buffer
   * @param {number} offset - Current position in buffer
   * @param {number} yLevel - Vertical index of subchunk
   * @returns {Object} Decoded subchunk data and new buffer position
   * @throws {Error} If subchunk data is invalid or buffer overflow occurs
   */
  decodeSubChunk(payload, offset, yLevel) {
    // Ensure we don't read past buffer end
    if (offset >= payload.length - 1) {
      throw new Error('Buffer overflow while reading subchunk');
    }

    // Read subchunk version
    const version = payload.readInt8(offset++);
    
    // Read number of layers in this subchunk
    const layerCount = payload.readInt8(offset++);

    console.log(`Subchunk Y=${yLevel}:`, {
      version,
      layerCount
    });

    const subChunk = {
      y: yLevel,
      version,
      layers: []
    };

    // Process each layer in the subchunk
    for (let layer = 0; layer < layerCount && offset < payload.length - 1; layer++) {
      const blocks = [];
      
      // Read all blocks in 16x16x16 space
      for (let i = 0; i < 4096 && offset < payload.length - 1; i++) {
        try {
          const blockId = payload.readUInt8(offset++);
          if (blockId !== 0) { // Skip air blocks (ID: 0)
            blocks.push(this.createBlockData(blockId, i));
          }
        } catch (e) {
          console.warn(`Block read error (y=${yLevel}, layer=${layer}, i=${i}):`, e.message);
          break;
        }
      }

      if (blocks.length > 0) {
        subChunk.layers.push({
          index: layer,
          blocks: blocks
        });
        console.log(`Y=${yLevel}, Layer ${layer}: ${blocks.length} blocks`);
      }
    }

    return {
      data: subChunk,
      newOffset: offset
    };
  }

  /**
   * Create block data object from block ID and array index
   * Converts 1D array index to 3D coordinates within subchunk
   * @param {number} blockId - Runtime ID of the block
   * @param {number} index - Index in the 16x16x16 array
   * @returns {Object} Block data including position and type information
   */
  createBlockData(blockId, index) {
    return {
      index: index,
      id: blockId,
      name: this.blockMappings[blockId] || `unknown_block_${blockId}`,
      x: index % 16,                    // Local X within chunk (0-15)
      y: Math.floor(index / 256),       // Local Y within subchunk (0-15)
      z: Math.floor((index % 256) / 16) // Local Z within chunk (0-15)
    };
  }

  /**
   * Get block at specific coordinates within a chunk
   * @param {Object} chunk - Decoded chunk data
   * @param {number} x - Local X coordinate (0-15)
   * @param {number} y - Absolute Y coordinate
   * @param {number} z - Local Z coordinate (0-15)
   * @returns {Object|null} Block data or null if not found
   */
  getBlockAt(chunk, x, y, z) {
    if (x < 0 || x > 15 || z < 0 || z > 15) {
      throw new Error('Local coordinates must be between 0-15');
    }

    const subChunkIndex = Math.floor(y / 16);
    const localY = y % 16;
    
    const subChunk = chunk.subChunks.find(sc => sc.y === subChunkIndex);
    if (!subChunk) return null;

    const blockIndex = (localY * 256) + (z * 16) + x;

    for (const layer of subChunk.layers) {
      const block = layer.blocks.find(b => b.index === blockIndex);
      if (block) return block;
    }

    // Return air block if no solid block found
    return {
      index: blockIndex,
      id: 0,
      name: 'air',
      x, y, z
    };
  }

  /**
   * Cache decoded chunk data for later use
   * @param {Object} chunk - Decoded chunk data
   */
  cacheChunk(chunk) {
    const key = `${chunk.x},${chunk.z}`;
    this.chunkCache.set(key, chunk);
  }

  /**
   * Retrieve cached chunk data by coordinates
   * @param {number} x - Chunk X coordinate
   * @param {number} z - Chunk Z coordinate
   * @returns {Object|undefined} Cached chunk data or undefined if not found
   */
  getLastDecodedChunk(x, z) {
    return this.chunkCache.get(`${x},${z}`);
  }

  /**
   * Debug function to display all block mappings
   * Useful for development and troubleshooting
   */
  debugBlockMappings() {
    console.log('Current Block Mappings:');
    Object.entries(this.blockMappings).forEach(([id, name]) => {
      console.log(`ID: ${id} -> ${name}`);
    });
  }

  /**
   * Debug function to display detailed chunk information
   * Shows structure of chunk, subchunks, layers, and blocks
   * @param {Object} chunk - Decoded chunk data
   */
  debugChunk(chunk) {
    console.log(`\nChunk Debug (${chunk.x}, ${chunk.z}):`);
    console.log(`Number of SubChunks: ${chunk.subChunks.length}`);
    
    chunk.subChunks.forEach(subChunk => {
      console.log(`\nSubChunk Y=${subChunk.y}:`);
      console.log(`Version: ${subChunk.version}`);
      console.log(`Number of Layers: ${subChunk.layers.length}`);
      
      subChunk.layers.forEach(layer => {
        console.log(`\nLayer ${layer.index}:`);
        console.log(`Block Count: ${layer.blocks.length}`);
        
        // Show first 10 blocks as sample
        layer.blocks.slice(0, 10).forEach(block => {
          console.log(`- ${block.name} (ID: ${block.id}) at x:${block.x}, y:${block.y}, z:${block.z}`);
        });
        if (layer.blocks.length > 10) {
          console.log(`... and ${layer.blocks.length - 10} more blocks`);
        }
      });
    });
  }
}

module.exports = ChunkDecoder;