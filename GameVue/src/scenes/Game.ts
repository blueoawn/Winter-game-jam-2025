import { Scene } from 'phaser';
import { PlayerController } from "../../managers/PlayerController.ts";
import { LizardWizard } from "../gameObjects/Characters/LizardWizard.ts";
import { SwordAndBoard } from "../gameObjects/Characters/SwordAndBoard.ts";
import { ButtonMapper } from "../../managers/ButtonMapper.ts";
import Tilemap = Phaser.Tilemaps.Tilemap;
import Sprite = Phaser.GameObjects.Sprite;
import TilemapLayer = Phaser.Tilemaps.TilemapLayer;
import Text = Phaser.GameObjects.Text;
import Group = Phaser.GameObjects.Group;
import CursorKeys = Phaser.Types.Input.Keyboard.CursorKeys;

import ANIMATION from '../animation.ts';
import ASSETS from '../assets.ts';
import PlayerBullet from "../gameObjects/PlayerBullet.ts";
import EnemyBullet from "../gameObjects/EnemyBullet.ts";
import TimerEvent = Phaser.Time.TimerEvent;
import EnemyFlying from "../gameObjects/EnemyFlying.ts";
import Explosion from "../gameObjects/Explosion.ts";

import NetworkManager from '../../network/NetworkManager';
import { MessageTypes } from '../../network/MessageTypes';
import { StateSerializer } from '../../network/StateSerializer';
import { PlayerManager } from '../../managers/MultiplayerManager.ts';


export class GameScene extends Scene
{
    score: number;
    centreX: number;
    centreY: number;
    tiles: number[];
    gameStarted: boolean = false;
    player: Sprite;
    spawnEnemyCounter: number;
    tileSize: number;
    mapOffset: number;
    mapTop: number;
    mapHeight: number;
    mapWidth: number;
    scrollSpeed: number;
    scrollMovement: number;
    map: Tilemap
    groundLayer: TilemapLayer | null;
    tutorialText: Text;
    scoreText: Text;
    gameOverText: Text;
    enemyGroup: Group;
    enemyBulletGroup: Group;
    playerBulletGroup: Group;
    cursors?: CursorKeys;
    timedEvent: TimerEvent;

    // Network properties
    networkEnabled: boolean = false;
    isHost: boolean = false;
    players: string[] = [];
    playerManager: PlayerManager | null = null;
    buttonMapper: ButtonMapper | null = null;
    stateSyncRate: number;
    lastStateSyncTime: number;
    inputSendRate: number;
    lastInputSendTime: number;
    tick: number;

    constructor ()
    {
        super('GameScene');
    }

    init(data: any): void {
        // Receive data from Lobby scene
        this.networkEnabled = data?.networkEnabled || false;
        this.isHost = data?.isHost || false;
        this.players = data?.players || [];

        console.log('Game initialized:', { networkEnabled: this.networkEnabled, isHost: this.isHost, players: this.players });
    }

    create ()
    {
        this.initVariables();
        this.initGameUi();
        this.initAnimations();

        // Initialize ButtonMapper for input
        this.buttonMapper = new ButtonMapper(this);

        if (this.networkEnabled) {
            this.initMultiplayer();
        } else {
            this.initSinglePlayer();
        }

        this.initInput();
        this.initPhysics();
        this.initMap();

        // Auto-start for now
        this.startGame();
    }

    update() {
        // Feels good to have a nice background while testing
        // this.updateMap();

        if (!this.gameStarted) return;

        if (this.networkEnabled) {
            this.updateMultiplayer();
        } else {
            this.updateSinglePlayer();
        }

        if (this.spawnEnemyCounter > 0) this.spawnEnemyCounter--;
        else this.addFlyingGroup();
    }

    initVariables() {
        this.score = 0;
        this.centreX = this.scale.width * 0.5;
        this.centreY = this.scale.height * 0.5;

        // list of tile ids in tiles.png
        // items nearer to the beginning of the array have a higher chance of being randomly chosen when using weighted()
        this.tiles = [50, 50, 50, 50, 50, 50, 50, 50, 50, 110, 110, 110, 110, 110, 50, 50, 50, 50, 50, 50, 50, 50, 50, 110, 110, 110, 110, 110, 36, 48, 60, 72, 84];
        this.tileSize = 32; // width and height of a tile in pixels

        this.mapOffset = 10; // offset (in tiles) to move the map above the top of the screen
        this.mapTop = -this.mapOffset * this.tileSize; // offset (in pixels) to move the map above the top of the screen
        this.mapHeight = Math.ceil(this.scale.height / this.tileSize) + this.mapOffset + 1; // height of the tile map (in tiles)
        this.mapWidth = Math.ceil(this.scale.width / this.tileSize); // width of the tile map (in tiles)
        //this.scrollSpeed = 1; // background scrolling speed (in pixels) DISABLED FOR NOW
        // this.scrollMovement = 0; // current scroll amount DISABLED FOR NOW
        this.spawnEnemyCounter = 0; // timer before spawning next group of enemies

        // Network variables
        this.stateSyncRate = 1000 / 15;  // 15 times per second
        this.lastStateSyncTime = 0;
        this.inputSendRate = 1000 / 60;  // 60 times per second
        this.lastInputSendTime = 0;
        this.tick = 0;
    }

    initSinglePlayer() {
        // Create single player with LizardWizard character
        this.player = new LizardWizard(this, this.centreX, this.scale.height - 100);
        (this.player as any).isLocal = true;
        this.playerManager = null;
    }

    initMultiplayer() {
        // Create PlayerManager
        this.playerManager = new PlayerManager(this);

        // Create all players with character assignments
        const localPlayerId = NetworkManager.getStats().playerId;
        this.players.forEach((playerId, index) => {
            const isLocal = (playerId === localPlayerId);
            // Player 0 = LizardWizard, Player 1 = SwordAndBoard
            const characterType = (index === 0) ? 'LizardWizard' : 'SwordAndBoard';
            this.playerManager!.createPlayer(playerId, isLocal, characterType, index);
        });

        // Set up network message handlers
        this.setupNetworkHandlers();

        console.log(`Multiplayer initialized - Host: ${this.isHost}, Players: ${this.players.length}`);
    }

    setupNetworkHandlers() {
        if (this.isHost) {
            // Host receives inputs from clients
            NetworkManager.onMessage(MessageTypes.INPUT, (fromPeerId, payload) => {
                this.playerManager?.applyInput(fromPeerId, payload.inputs);
            });
        } else {
            // Client receives state from host
            NetworkManager.onMessage(MessageTypes.STATE_SYNC, (fromPeerId, payload) => {
                this.applyNetworkState(payload);
            });
        }
    }

    updateSinglePlayer() {
        if (!this.player || !this.buttonMapper) return;

        // Get input from ButtonMapper
        const input = this.buttonMapper.getInput();

        // Process input
        (this.player as PlayerController).processInput(input);

        // Store for potential network serialization
        (this.player as PlayerController).storeInputForNetwork(input);

        if ((this.player as any).update) {
            (this.player as any).update();
        }
    }

    updateMultiplayer() {
        this.tick++;

        if (this.isHost) {
            this.updateHost();
        } else {
            this.updateClient();
        }
    }

    updateHost() {
        // Update all players
        this.playerManager?.update();

        // Broadcast state to clients
        const now = Date.now();
        if (now - this.lastStateSyncTime >= this.stateSyncRate) {
            this.broadcastState();
            this.lastStateSyncTime = now;
        }
    }

    updateClient() {
        // Update all players (interpolation happens in player update)
        this.playerManager?.update();

        // Send local input to host
        const now = Date.now();
        if (now - this.lastInputSendTime >= this.inputSendRate) {
            this.sendInputToHost();
            this.lastInputSendTime = now;
        }
    }

    broadcastState() {
        if (!this.playerManager) return;

        const state = StateSerializer.serialize({
            tick: this.tick,
            players: this.playerManager.getAllPlayers() as any,
            enemies: this.enemyGroup.getChildren() as any,
            bullets: this.playerBulletGroup.getChildren() as any,
            score: this.score,
            scrollMovement: this.scrollMovement,
            spawnEnemyCounter: this.spawnEnemyCounter,
            gameStarted: this.gameStarted
        });

        NetworkManager.broadcast(MessageTypes.STATE_SYNC, state);
    }

    sendInputToHost() {
        if (!this.playerManager || !this.buttonMapper) return;

        const localPlayer = this.playerManager.getLocalPlayer();
        if (!localPlayer) return;

        // Get abstract input from ButtonMapper
        const abstractInput = this.buttonMapper.getInput();

        // Convert to network InputState
        const inputState = {
            movementSpeed: (localPlayer as any).characterSpeed,
            velocity: abstractInput.movement,
            rotation: localPlayer.rotation,
            ability1: abstractInput.ability1,
            ability2: abstractInput.ability2
        };

        NetworkManager.sendToHost(MessageTypes.INPUT, {
            inputs: inputState
        });
    }

    applyNetworkState(state: any) {
        // Apply player states
        if (state.players && this.playerManager) {
            this.playerManager.applyPlayerState(state.players);
        }

        // Apply game state
        if (state.gameState) {
            this.score = state.gameState.score;
            this.scrollMovement = state.gameState.scrollMovement;
            this.spawnEnemyCounter = state.gameState.spawnEnemyCounter;
            this.gameStarted = state.gameState.gameStarted;

            this.scoreText.setText(`Score: ${this.score}`);
        }

        // TODO: Sync enemies and bullets
    }

    initGameUi() {
        // Create tutorial text
        this.tutorialText = this.add.text(this.centreX, this.centreY, 'Tap to shoot!', {
            fontFamily: 'Arial Black', fontSize: 42, color: '#ffffff',
            stroke: '#000000', strokeThickness: 8,
            align: 'center'
        })
            .setOrigin(0.5)
            .setDepth(100);

        // Create score text
        this.scoreText = this.add.text(20, 20, 'Score: 0', {
            fontFamily: 'Arial Black', fontSize: 28, color: '#ffffff',
            stroke: '#000000', strokeThickness: 8,
        })
            .setDepth(100);

        // Create game over text
        this.gameOverText = this.add.text(this.scale.width * 0.5, this.scale.height * 0.5, 'Game Over', {
            fontFamily: 'Arial Black', fontSize: 64, color: '#ffffff',
            stroke: '#000000', strokeThickness: 8,
            align: 'center'
        })
            .setOrigin(0.5)
            .setDepth(100)
            .setVisible(false);
    }

    initAnimations() {
        this.anims.create({
            key: ANIMATION.explosion.key,
            frames: this.anims.generateFrameNumbers(ANIMATION.explosion.texture, ANIMATION.explosion.config),
            frameRate: ANIMATION.explosion.frameRate,
            repeat: ANIMATION.explosion.repeat
        });
    }

    initPhysics() {
        this.enemyGroup = this.add.group();
        this.enemyBulletGroup = this.add.group();
        this.playerBulletGroup = this.add.group();

        // Only set up collisions for single player mode
        if (!this.networkEnabled && this.player) {
            this.physics.add.overlap(this.player, this.enemyBulletGroup, this.hitPlayer as () => void, undefined, this);
            this.physics.add.overlap(this.playerBulletGroup, this.enemyGroup, this.hitEnemy as () => void, undefined, this);
            this.physics.add.overlap(this.player, this.enemyGroup, this.hitPlayer as () => void, undefined, this);
        }
        // TODO: Set up collisions for multiplayer mode with all players
    }

    // initPlayer() removed - now using initSinglePlayer() and initMultiplayer() with character classes

    initInput() {
        this.cursors = this.input.keyboard?.createCursorKeys();

        // check for spacebar press only once
        this.cursors?.space.once('down', () => {
            this.startGame();
        });
    }

    // create tile map data
    initMap() {
        const mapData = [];
        for (let y = 0; y < this.mapHeight; y++) {
            const row = [];

            for (let x = 0; x < this.mapWidth; x++) {
                // randomly choose a tile id from this.tiles
                // weightedPick favours items earlier in the array
                const tileIndex = Phaser.Math.RND.weightedPick(this.tiles);

                row.push(tileIndex);
            }

            mapData.push(row);
        }

        this.map = this.make.tilemap({ data: mapData, tileWidth: this.tileSize, tileHeight: this.tileSize });
        const tileset = this.map.addTilesetImage(ASSETS.spritesheet.tiles.key);
        if (tileset) {
            this.groundLayer = this.map.createLayer(0, tileset, 0, this.mapTop);
        }
    }

    // scroll the tile map
    updateMap() {
        this.scrollMovement += this.scrollSpeed;

        if (this.scrollMovement >= this.tileSize) {
            //  Create new row on top
            let tile;
            let prev;

            // loop through map from bottom to top row
            for (let y = this.mapHeight - 2; y > 0; y--) {
                // loop through map from left to right column
                for (let x = 0; x < this.mapWidth; x++) {
                    tile = this.map.getTileAt(x, y - 1);
                    prev = this.map.getTileAt(x, y);

                    if (prev && tile) {
                        prev.index = tile.index;
                    }

                    if (y === 1 && tile) { // if top row
                        // randomly choose a tile id from this.tiles
                        // weightedPick favours items earlier in the array
                        tile.index = Phaser.Math.RND.weightedPick(this.tiles);
                    }
                }
            }

            this.scrollMovement -= this.tileSize; // reset to 0
        }

        if (this.groundLayer) {
            this.groundLayer.y = this.mapTop + this.scrollMovement; // move one tile up
        }
    }

    startGame() {
        this.gameStarted = true;
        this.tutorialText.setVisible(false);
        this.addFlyingGroup();
    }

    fireBullet(from: {x: number, y: number}, to: {x: number, y: number}) {
        const bullet = new PlayerBullet(this, from, to, 1);
        this.playerBulletGroup.add(bullet);
    }

    removeBullet(bullet: PlayerBullet) {
        this.playerBulletGroup.remove(bullet, true, true);
    }

    fireEnemyBullet(x: number, y: number, power: number) {
        const bullet = new EnemyBullet(this, x, y, power);
        this.enemyBulletGroup.add(bullet);
    }

    removeEnemyBullet(bullet: EnemyBullet) {
        this.playerBulletGroup.remove(bullet, true, true);
    }

    // add a group of flying enemies
    addFlyingGroup() {
        this.spawnEnemyCounter = Phaser.Math.RND.between(5, 8) * 60; // spawn next group after x seconds
        const randomId = Phaser.Math.RND.between(0, 11); // id to choose image in tiles.png
        const randomCount = Phaser.Math.RND.between(5, 15); // number of enemies to spawn
        const randomInterval = Phaser.Math.RND.between(8, 12) * 100; // delay between spawning of each enemy
        const randomPath = Phaser.Math.RND.between(0, 3); // choose a path, a group follows the same path
        const randomPower = Phaser.Math.RND.between(1, 4); // strength of the enemy to determine damage to inflict and selecting bullet image
        const randomSpeed = Phaser.Math.RND.realInRange(0.0001, 0.001); // increment of pathSpeed in enemy

        this.timedEvent = this.time.addEvent(
            {
                delay: randomInterval,
                callback: this.addEnemy,
                args: [randomId, randomPath, randomSpeed, randomPower], // parameters passed to addEnemy()
                callbackScope: this,
                repeat: randomCount
            }
        );
    }

    addEnemy(shipId: number, pathId: number, speed: number, power: number) {
        const enemy = new EnemyFlying(this, shipId, pathId, speed, power);
        this.enemyGroup.add(enemy);
    }

    removeEnemy(enemy: EnemyFlying) {
        this.enemyGroup.remove(enemy, true, true);
    }

    addExplosion(x: number, y: number) {
        new Explosion(this, x, y);
    }

    hitPlayer(player: PlayerController, obstacle: any) {
        this.addExplosion(player.x, player.y);
        player.hit(obstacle.getPower());
        //obstacle.die(); disabled

        this.GameOver();
    }

    hitEnemy(bullet: PlayerBullet, enemy: EnemyFlying) {
        this.updateScore(10);
        bullet.remove();
        enemy.hit(bullet.getPower());
    }

    updateScore(points: number) {
        this.score += points;
        this.scoreText.setText(`Score: ${this.score}`);
    }

    GameOver() {
        this.gameStarted = false;
        this.gameOverText.setVisible(true);
    }
}
