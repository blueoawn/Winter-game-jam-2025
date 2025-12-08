export default {
    audio: {
        cheeseEat: {
            key: 'cheese-eat',
            // Not sure if it's legal to use roblox sound effects, but it's funny
            args: ['SoundEffects/Cheese-Touch-Heal-sound.m4a']
        },
        // Placeholder railgun fire sound. Add `assets/SoundEffects/railgun-fire.mp3` to the assets folder.
        railgunFire: {
            key: 'railgun-fire',
            args: ['SoundEffects/Railgun-laser-sound.m4a']
        },
        ninjastar: {
            key: 'ninja-star',
            args: ['SoundEffects/plasma-shot-sound.m4a']
        },
        battleTheme1: {
            key: 'battle-theme-1',
            args: ['Music/Battle-Theme-1.m4a']
        },
        gameOverMusic: {
            key: 'game-over-music',
            args: ['assets/Music/Game-over.m4a']
        },
        shotgunFire: {
            key: 'shotgun-fire',
            args: ['assets/SoundEffects/Shotgun-fire-sound.m4a']
        },
        cheeseTouchDrain: {
            key: 'cheese-touch-drain',
            args: ['assets/SoundEffects/Cheese-touch-drain-Sound.m4a']
        },
        youDidIt: {
            key: 'you-did-it',
            args: ['assets/SoundEffects/You-did-it.m4a']
        },
        wizardLizardBlep: {
            key: 'wizard-lizard-blep',
            args: ['assets/SoundEffects/Wizard-lizard-blep.m4a']
        },
        swordSlash: {
            key: 'sword-slash',
            args: ['assets/SoundEffects/Sword-slash-sound.m4a']
        },
        wallShieldCollision: {
            key: 'wall-shield-collision',
            args: ['assets/SoundEffects/Wall_-shield-collision-sound.m4a']
        },
        lizardDeath1: {
            key: 'lizard-death-1',
            args: ['assets/SoundEffects/lizard-ded-1.m4a']
        },
        lizardDeath2: {
            key: 'lizard-death-2',
            args: ['assets/SoundEffects/lizard-ded-2.m4a']
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
            args: ['Backgrounds/summonersRift.png']
        },
        eggMap: {
            key: 'egg-map',
            args: ['Backgrounds/Egg_map.png']
        },
        battleMap: {
            key: 'battle-map',
            args: ['Backgrounds/BattleMap.png']
        },
        dungeonTileset: {
            key: 'dungeon-tilemap',
            args: ['Sprites/MapSpriteSheets/spritesheet_dungeon.png']
        },
        cookieCutterWall: {
            key: 'cookie-cutter-wall',
            args: ['Sprites/cookiecutterwall.png']
        },
        lizardWizard: {
            key: 'lizard-wizard',
            args: ['Sprites/Wizard_Lizard_2.png']
        },
        lizardWizardBackgroundSmall: {
            key: 'lizard-wizard-bg',
            args: ['Backgrounds/lizardWizardBackgroundSmall.png']
        },
        shield: {
            key: 'shield',
            args: ['Sprites/shieldSpriteCropped.png']
        },
        railgunBeam: {
            key: 'railgun-beam',
            args: ['Sprites/railgunBeamCropped.png']
        },
        shuriken: {
            key: 'shuriken',
            args: ['Sprites/shurikenCropped.png']
        },
        sword: {
            key: 'sword',
            args: ['Sprites/swordSpriteCropped.png']
        }
    },
    spritesheet: {
        ships: {
            key: 'ships',
            args: ['ships.png', {
                frameWidth: 64,
                frameHeight: 64,
            }]
        },
        tiles: {
            key: 'tiles',
            args: ['tiles.png', {
                frameWidth: 32,
                frameHeight: 32
            }]
        },
        slime: {
            key: 'slime',
            args: ['Sprites/slime_F_Cleaned1Cropped.png', {
                frameWidth: 574,
                frameHeight: 588,
            }]
        },
        lizardWizardAttack: {
            key: 'lizard-wizard-attack',
            args: ['Sprites/lizardWizardAttackSpriteSheetCropped.png', {
                frameWidth: 54,
                frameHeight: 53
            }]
        },
        cheeseTouchAttack: {
            key: 'cheese-touch-attack',
            args: ['Sprites/cheeseTouchAttackSpriteSheetCropped.png', {
                frameWidth: 49,
                frameHeight: 44
            }]
        },
        playableCharacters: {
            key: 'playable-characters',
            args: ['Sprites/playableCharacterSpriteSheetCropped.png', {
                frameWidth: 60,
                frameHeight: 77
            }]
        },
    }
};
