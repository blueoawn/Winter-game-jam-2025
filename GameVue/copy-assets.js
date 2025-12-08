const fs = require('fs-extra');
const path = require('path');

console.log('Copying assets to dist folder...');

const rootDir = process.cwd();
const assetsSource = path.join(rootDir, 'assets');
const assetsDest = path.join(rootDir, 'dist', 'assets');

const mapsSource = path.join(rootDir, 'src', 'maps');
const mapsDest = path.join(rootDir, 'dist', 'src', 'maps');

try {
    // Copy assets folder
    if (fs.existsSync(assetsSource)) {
        fs.copySync(assetsSource, assetsDest, { overwrite: true });
        console.log('✓ Assets copied successfully');
    } else {
        console.error('× Assets folder not found:', assetsSource);
    }

    // Copy maps folder
    if (fs.existsSync(mapsSource)) {
        fs.copySync(mapsSource, mapsDest, { overwrite: true });
        console.log('✓ Maps copied successfully');
    } else {
        console.error('× Maps folder not found:', mapsSource);
    }

    console.log('Asset copying complete!');
} catch (err) {
    console.error('Error copying assets:', err);
    process.exit(1);
}

