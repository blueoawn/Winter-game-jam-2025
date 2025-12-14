import { describe, it, expect } from 'vitest';
import { existsSync } from 'fs';
import { resolve } from 'path';
import ASSETS from '../src/assets';

// Supported audio formats with cross-platform compatibility
const COMPATIBLE_AUDIO_FORMATS = ['.mp3', '.ogg', '.wav'];
const PROBLEMATIC_AUDIO_FORMATS = ['.m4a', '.aac', '.wma'];

// Get the paths where assets might be located
// Vite serves: public/ at root, and root assets/ folder may also be accessible
const PUBLIC_DIR = resolve(__dirname, '../public');
const ROOT_DIR = resolve(__dirname, '..');

// Helper to check if file exists in either public or root directory
function assetExists(filePath: string): boolean {
    const publicPath = resolve(PUBLIC_DIR, filePath);
    const rootPath = resolve(ROOT_DIR, filePath);
    return existsSync(publicPath) || existsSync(rootPath);
}

function getAssetLocation(filePath: string): string {
    const publicPath = resolve(PUBLIC_DIR, filePath);
    const rootPath = resolve(ROOT_DIR, filePath);
    if (existsSync(publicPath)) return publicPath;
    if (existsSync(rootPath)) return rootPath;
    return `Not found in:\n  - ${publicPath}\n  - ${rootPath}`;
}

describe('Asset Configuration', () => {
    describe('Audio Assets - File Existence', () => {
        const audioAssets = Object.entries(ASSETS.audio);

        audioAssets.forEach(([name, asset]) => {
            it(`audio asset "${name}" (${asset.key}) file should exist`, () => {
                const filePath = asset.args[0];

                expect(
                    assetExists(filePath),
                    `Audio file not found: ${getAssetLocation(filePath)}`
                ).toBe(true);
            });
        });
    });

    describe('Audio Assets - Format Compatibility', () => {
        const audioAssets = Object.entries(ASSETS.audio);

        audioAssets.forEach(([name, asset]) => {
            it(`audio asset "${name}" should use a cross-platform compatible format`, () => {
                const filePath = asset.args[0] as string;
                const extension = filePath.substring(filePath.lastIndexOf('.')).toLowerCase();

                const isCompatible = COMPATIBLE_AUDIO_FORMATS.includes(extension);
                const isProblematic = PROBLEMATIC_AUDIO_FORMATS.includes(extension);

                if (isProblematic) {
                    console.warn(
                        `⚠️  Audio "${name}" uses ${extension} format which may not work on Linux/Ubuntu browsers.\n` +
                        `   Consider converting to .mp3 or .ogg for better cross-platform support.`
                    );
                }

                expect(
                    isCompatible,
                    `Audio "${name}" uses ${extension} format.\n` +
                    `M4A/AAC files often fail to decode on Linux browsers.\n` +
                    `Recommended formats: ${COMPATIBLE_AUDIO_FORMATS.join(', ')}\n` +
                    `File: ${filePath}`
                ).toBe(true);
            });
        });
    });

    describe('Audio Assets - Key Uniqueness', () => {
        it('all audio asset keys should be unique', () => {
            const keys = Object.values(ASSETS.audio).map(asset => asset.key);
            const uniqueKeys = new Set(keys);

            expect(keys.length).toBe(uniqueKeys.size);
        });

        it('all audio asset keys should be valid identifiers (lowercase with hyphens)', () => {
            const audioAssets = Object.entries(ASSETS.audio);

            audioAssets.forEach(([name, asset]) => {
                expect(
                    /^[a-z0-9-]+$/.test(asset.key),
                    `Audio key "${asset.key}" for "${name}" should only contain lowercase letters, numbers, and hyphens`
                ).toBe(true);
            });
        });
    });

    describe('Image Assets - File Existence', () => {
        const imageAssets = Object.entries(ASSETS.image);

        imageAssets.forEach(([name, asset]) => {
            it(`image asset "${name}" (${asset.key}) file should exist`, () => {
                const filePath = asset.args[0];

                expect(
                    assetExists(filePath),
                    `Image file not found: ${getAssetLocation(filePath)}`
                ).toBe(true);
            });
        });
    });

    describe('Spritesheet Assets - File Existence', () => {
        const spritesheetAssets = Object.entries(ASSETS.spritesheet);

        spritesheetAssets.forEach(([name, asset]) => {
            it(`spritesheet asset "${name}" (${asset.key}) file should exist`, () => {
                const filePath = asset.args[0];

                expect(
                    assetExists(filePath),
                    `Spritesheet file not found: ${getAssetLocation(filePath)}`
                ).toBe(true);
            });
        });
    });

    describe('Tilemap Assets - File Existence', () => {
        const tilemapAssets = Object.entries(ASSETS.tilemapTiledJSON);

        tilemapAssets.forEach(([name, asset]) => {
            it(`tilemap asset "${name}" (${asset.key}) file should exist`, () => {
                const filePath = asset.args[0];

                expect(
                    assetExists(filePath),
                    `Tilemap file not found: ${getAssetLocation(filePath)}`
                ).toBe(true);
            });
        });
    });
});
