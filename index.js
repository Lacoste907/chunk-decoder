/**
 * Minecraft Bedrock Edition Chunk Decoder Example
 * Demonstrates how to connect to a server and decode chunk data
 */

const bedrock = require('bedrock-protocol');
const ChunkDecoder = require('./ChunkDecoder');

// Initialize chunk decoder instance
const decoder = new ChunkDecoder();

// Create Bedrock client with server configuration
const client = bedrock.createClient({
  host: 'bedrock.bosscraft.net', // Server address
  port: 19132,                   // Server port (default: 19132)
  username: 'BedrockBot',        // Bot username
  offline: false                 // Online/Offline mode
});

/**
 * Handle game start event
 * Receives block state definitions from server and initializes mappings
 */
client.on('start_game', (packet) => {
  if (packet.itemstates) {
    // Set block mappings in decoder
    decoder.setBlockMappings(packet.itemstates);
    //decoder.debugBlockMappings(); // Uncomment to see all block types
    console.log('Block mappings loaded, total:', Object.keys(decoder.blockMappings).length);
  }
});

/**
 * Handle chunk data packets
 * Decodes raw chunk data and displays block information
 */
client.on('level_chunk', (packet) => {
  if (packet.payload) {
    try {
      // Decode chunk data
      const decodedChunk = decoder.decodeChunk(packet.payload, packet.x, packet.z);
      
      // Display detailed chunk information
      decoder.debugChunk(decodedChunk);
      
      /* Uncomment to see all blocks in chunk
      decodedChunk.subChunks.forEach(subChunk => {
        subChunk.layers.forEach(layer => {
          layer.blocks.forEach(block => {
            console.log(
              `Block found: ${block.name} (ID: ${block.id}) | ` +
              `Local[x:${block.x}, y:${block.y}, z:${block.z}] | ` +
              `World[x:${packet.x * 16 + block.x}, y:${block.y}, z:${packet.z * 16 + block.z}]`
            );
          });
        });
      });
      */
      
    } catch (err) {
      console.error('Chunk decode error:', err);
    }
  }
});

