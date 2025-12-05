export default {
    audio: {
        cheeseEat: {
            key: 'cheese-eat',
            // Not sure if it's legal to use roblox sound effects, but it's funny
            args: ['assets/SoundEffects/roblox-eating-sound-effect-nom-nom-nom.mp3']
        },
    },
    image: {
        summonersRift: {
            key: 'summoners-rift',
            args: ['assets/Backgrounds/summonersRift.png']
        },
        cookieCutterWall: {
            key: 'cookie-cutter-wall',
            args: ['assets/Sprites/cookiecutterwall.png']
        },
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
    }
};
