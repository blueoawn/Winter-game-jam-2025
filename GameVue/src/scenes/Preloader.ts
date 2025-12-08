import { Scene } from 'phaser';
import ASSETS from '../assets'

export class Preloader extends Scene
{
    constructor() {
        super('Preloader');
    }

    init() {
        const centreX = this.scale.width * 0.5;
        const centreY = this.scale.height * 0.5;

        const barWidth = 468;
        const barHeight = 32;
        const barMargin = 4;

        // TODO Add a background image/logo here?
        // TODO Play a sound effect when loading finishes?

        //  We loaded this image in our Boot Scene, so we can display it here

        //  A simple progress bar. This is the outline of the bar.
        this.add.rectangle(centreX, centreY, barWidth, barHeight).setStrokeStyle(1, 0xffffff);

        //  This is the progress bar itself. It will increase in size from the left based on the % of progress.
        const bar = this.add.rectangle(centreX - (barWidth * 0.5) + barMargin, centreY, barMargin, barHeight - barMargin, 0xffffff);

        //  Use the 'progress' event emitted by the LoaderPlugin to update the loading bar
        this.load.on('progress', (progress: number) => {

            //  Update the progress bar (our bar is 464px wide, so 100% = 464px)
            bar.width = barMargin + ((barWidth - (barMargin * 2)) * progress);

        });
    }

    preload() {
        //  Load the assets for the game - see ./src/assets.js

        // Track failed audio files
        const failedAudio = new Set<string>();

        // Handle audio loading errors gracefully
        this.load.on('loaderror', (file: any) => {
            console.warn(`Failed to load: ${file.type} "${file.key}" from ${file.url}`);
            if (file.type === 'audio') {
                failedAudio.add(file.key);
            }
        });

        // Handle file decode errors (e.g., unsupported audio formats)
        this.load.on('fileerror', (file: any) => {
            console.warn(`Error decoding file: ${file.type} "${file.key}"`);
            if (file.type === 'audio') {
                failedAudio.add(file.key);
            }
        });

        // Continue even if some files fail
        this.load.on('complete', () => {
            if (failedAudio.size > 0) {
                console.warn(`Failed to load ${failedAudio.size} audio file(s). Game will continue without these sounds.`);
            }
        });

        for (let type in ASSETS) {
            for (let key in ASSETS[type] as any) {
                let args = ASSETS[type][key].args.slice();
                args.unshift(ASSETS[type][key].key);

                try {
                    this.load[type].apply(this.load, args);
                } catch (error) {
                    console.warn(`Failed to queue asset: ${type} "${ASSETS[type][key].key}"`, error);
                }
            }
        }
    }

    create() {
        //  When all the assets have loaded, it's often worth creating global objects here that the rest of the game can use.
        //  For example, you can define global animations here, so we can use them in other scenes.

        //  Move to the MainMenu. You could also swap this for a Scene Transition, such as a camera fade.
        this.scene.start('Start');
    }
}
