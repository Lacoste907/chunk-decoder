# Minecraft Bedrock Chunk Decoder

## Installation Steps
-------------------

1. **Initialize package.json:**
   ```bash
   npm init -y
   ```

2. **Install Required Module:**
   ```bash
   npm install bedrock-protocol@3.42.3
   ```

3. **Add Start Script to package.json:**
   ```bash
   npm pkg set scripts.start="node index.js"
   ```

## Running the Project
-------------------
Start the project with:
```bash
npm start
```

## Project Structure
---------------
- `index.js`: Main application file
- `ChunkDecoder.js`: Class handling chunk decoding operations

## Output Information
------------------
When the program runs:
- First, block mappings are loaded
- Chunk data begins to arrive
- For each chunk, block information is displayed:
  * Block name and ID
  * Coordinates (both in-chunk and world)
  * Chunk structure and layers

## Requirements
---------
- Node.js v14 or higher
- Internet connection

## Troubleshooting
----------------
If you encounter errors:
1. Delete the `node_modules` folder
2. Delete `package-lock.json`
3. Run `npm install` again
4. Start the program with `npm start`