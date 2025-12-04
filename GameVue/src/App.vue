<script setup lang="ts">
//  Find out more information about the Game Config at:
//  https://docs.phaser.io/api-documentation/typedef/types-core#gameconfig
import { Game } from "phaser";
import { Boot } from "./scenes/Boot.ts";
import { Preloader } from "./scenes/Preloader.ts";
import { GameOver } from "./scenes/GameOver.ts";
import { Start } from "./scenes/Start.ts";
import { GameScene } from "./scenes/Game.ts";
import { Lobby } from "./scenes/Lobby.ts";
import { CharacterSelectScene } from "./scenes/CharacterSelect.ts";
import { onMounted } from "vue";

const config: Phaser.Types.Core.GameConfig = {
  dom: {
    createContainer: true
  },
  type: Phaser.AUTO,
  title: 'Shmup',
  parent: 'game-container',
  width: 1280,
  height: 720,
  backgroundColor: '#000000',
  pixelArt: false,
  antialias: true,
  roundPixels: true,
  physics: {
    default: 'arcade',
    arcade: {
      debug: false,
      gravity: {x: 0, y: 0}
    }
  },
  scene: [
    Boot,
    Preloader,
    Start,
    Lobby,
    CharacterSelectScene,
    GameScene,
    GameOver
  ],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
};


const StartGame = (parent: string) => {
  return new Game({...config, parent});
}

onMounted(() => {
  StartGame('game-container');
});
</script>
<template>
  <div id="game-container">
  </div>
</template>
<style scoped>
#game-container {
  width: 100%;
  height: 100vh;
  overflow: hidden;
}
</style>
