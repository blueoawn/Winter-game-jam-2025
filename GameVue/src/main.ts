//  Find out more information about the Game Config at:
//  https://docs.phaser.io/api-documentation/typedef/types-core#gameconfig
import { Game } from "phaser";
import { Boot } from "./scenes/Boot.ts";
import { Preloader } from "./scenes/Preloader.ts";
import { GameOver } from "./scenes/GameOver.ts";
import { Start } from "./scenes/Start.ts";
import { GameScene } from "./scenes/Game.ts";

const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    title: 'Shmup',
    parent: 'game-container',
    width: 1280,
    height: 720,
    backgroundColor: '#000000',
    pixelArt: false,
    physics: {
        default: 'arcade',
        arcade: {
            debug: false,
            gravity: { x: 0, y: 0 }
        }
    },
    scene: [
        Boot,
        Preloader,
        Start,
        GameScene,
        GameOver
    ],
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
};


const StartGame = (parent: string) => {
    return new Game({ ...config, parent });
}

document.addEventListener('DOMContentLoaded', () => {

    StartGame('game-container');

});
