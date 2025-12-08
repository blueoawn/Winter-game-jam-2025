export default {
    audio: {
        cheeseEat: {
            key: 'cheese-eat',
            // Not sure if it's legal to use roblox sound effects, but it's funny
            args: ['assets/SoundEffects/Cheese-Touch-Heal-sound.m4a']
        },
        // Placeholder railgun fire sound. Add `assets/SoundEffects/railgun-fire.mp3` to the assets folder.
        railgunFire: {
            key: 'railgun-fire',
            args: ['assets/SoundEffects/Railgun-laser-sound.m4a']
        },
        ninjastar: {
            key: 'ninja-star',
            args: ['assets/SoundEffects/plasma-shot-sound.m4a']
        },
        characterSelectMusic: {
            key: 'character-select-music',
            args: ['assets/SoundEffects/Character-select-hsh.m4a']
        },
        battleTheme1: {
            key: 'battle-theme-1',
            args: ['assets/Music/Battle-Theme-1.m4a']
        },
    },
    tilemapTiledJSON: {
        dungeonCrawl: {
            key: 'dungeon-crawl-map',
            args: ['src/maps/dungeonCrawl.json']
        }
    },
    image: {
        summonersRift: {
            key: 'summoners-rift',
            args: ['assets/Backgrounds/summonersRift.png']
        },
        eggMap: {
            key: 'egg-map',
            args: ['assets/Backgrounds/Egg_map.png']
        },
        battleMap: {
            key: 'battle-map',
            args: ['assets/Backgrounds/BattleMap.png']
        },
        dungeonTileset: {
            key: 'dungeon-tilemap',
            args: ['assets/Sprites/MapSpriteSheets/spritesheet_dungeon.png']
        },
        cookieCutterWall: {
            key: 'cookie-cutter-wall',
            args: ['assets/Sprites/cookiecutterwall.png']
        },
        lizardWizard: {
            key: 'lizard-wizard',
            args: ['assets/Sprites/Wizard_Lizard_2.png']
        },
        lizardWizardBackgroundSmall: {
            key: 'lizard-wizard-bg',
            args: ['assets/Backgrounds/lizardWizardBackgroundSmall.png']
        },
        shield: {
            key: 'shield',
            args: ['assets/Sprites/shieldSpriteCropped.png']
        },
        railgunBeam: {
            key: 'railgun-beam',
            args: ['assets/Sprites/railgunBeamCropped.png']
        },
        shuriken: {
            key: 'shuriken',
            args: ['assets/Sprites/shurikenCropped.png']
        },
        sword: {
            key: 'sword',
            args: ['assets/Sprites/swordSpriteCropped.png']
        }
    },
    spritesheet: {
        ships: {
            key: 'ships',
            args: ['assets/ships.png', {
                frameWidth: 64,
                frameHeight: 64,
            }]
        },
        tiles: {
            key: 'tiles',
            args: ['assets/tiles.png', {
                frameWidth: 32,
                frameHeight: 32
            }]
        },
        slime: {
            key: 'slime',
            args: ['assets/Sprites/slime_F_Cleaned1Cropped.png', {
                frameWidth: 574,
                frameHeight: 588,
            }]
        },
        lizardWizardAttack: {
            key: 'lizard-wizard-attack',
            args: ['assets/Sprites/lizardWizardAttackSpriteSheetCropped.png', {
                frameWidth: 54,
                frameHeight: 53
            }]
        },
        cheeseTouchAttack: {
            key: 'cheese-touch-attack',
            args: ['assets/Sprites/cheeseTouchAttackSpriteSheetCropped.png', {
                frameWidth: 49,
                frameHeight: 44
            }]
        },
        playableCharacters: {
            key: 'playable-characters',
            args: ['assets/Sprites/playableCharacterSpriteSheetCropped.png', {
                frameWidth: 60,
                frameHeight: 77
            }]
        },
    }
};
