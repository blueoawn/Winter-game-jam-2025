import { EnemyController } from './EnemyController';
import { GameScene } from '../../scenes/GameScene';
import { IBehavior } from '../../behaviorScripts/Behavior';
import { AggressiveBehavior } from '../../behaviorScripts/Aggressive';
import ASSETS from '../../assets';
import { audioManager } from '../../../managers/AudioManager';

export default class EnemyLizardWizard extends EnemyController {
    private behavior: IBehavior;
    public isBoss: boolean = false;

    constructor(scene: GameScene, x: number, y: number, behavior?: IBehavior, isBoss: boolean = false) {
        super(scene, x, y, 0, ASSETS.image.lizardWizard.key);

        this.enemyType = 'EnemyLizardWizard';
        this.isBoss = isBoss;

        if (this.isBoss) {
            this.setScale(0.75, 0.75);
            this.health = 500;
            this.maxHealth = 500;
            this.power = 12;
            this.setTint(0xff00ff);
        } else {
            this.setScale(0.5, 0.5);
            this.health = 50;
            this.maxHealth = 50;
            this.power = 8;
        }

        this.setBodySize(this.width, this.height);
        this.setCollideWorldBounds(true);

        // Create health bar AFTER scaling
        this.createHealthBar();

        this.behavior = behavior || new AggressiveBehavior();

        if (this.behavior.initialize) {
            this.behavior.initialize(this);
        }
    }

    protected updateAI(time: number, delta: number): void {
        this.behavior.update(this, time, delta);
    }

    setBehavior(newBehavior: IBehavior): void {
        // Cleanup old behavior
        if (this.behavior.cleanup) {
            this.behavior.cleanup(this);
        }

        // Set and initialize new behavior
        this.behavior = newBehavior;
        if (this.behavior.initialize) {
            this.behavior.initialize(this);
        }
    }

    getBehavior(): IBehavior {
        return this.behavior;
    }

    /**
     * Override die to add visual feedback and cleanup
     */
    die(): void {
        // Cleanup behavior
        if (this.behavior.cleanup) {
            this.behavior.cleanup(this);
        }

        // Boss death: Extra effects and character unlock
        if (this.isBoss) {
            console.log('[BOSS] Lizard Wizard boss defeated!');

            // Play boss death sound
            audioManager.play(ASSETS.audio.wizardBoss.key, { volume: 0.6 });

            // Multiple explosions for boss death
            this.gameScene.addExplosion(this.x, this.y);
            this.gameScene.time.delayedCall(200, () => {
                this.gameScene.addExplosion(this.x + 30, this.y + 30);
            });
            this.gameScene.time.delayedCall(400, () => {
                this.gameScene.addExplosion(this.x - 30, this.y - 30);
            });

            // Show boss defeat dialog first
            this.showBossDefeatDialog();

            // Then unlock character
            this.unlockLizardWizardCharacter();
        } else {
            // Normal death - play random lizard death sound
            const deathSounds = [
                ASSETS.audio.lizardDead1.key,
                ASSETS.audio.lizardDead2.key,
                ASSETS.audio.lizardDead3.key
            ];
            const randomSound = deathSounds[Math.floor(Math.random() * deathSounds.length)];
            audioManager.play(randomSound, { volume: 0.4 });

            this.gameScene.addExplosion(this.x, this.y);
        }

        // Remove from scene
        this.gameScene.removeEnemy(this);
    }

    private showBossDefeatDialog(): void {
        const centerX = this.gameScene.scale.width / 2;
        const centerY = this.gameScene.scale.height / 2;

        // Create dialog background
        const dialogBg = this.gameScene.add.rectangle(
            centerX,
            centerY,
            600,
            250,
            0x000000,
            0.9
        ).setScrollFactor(0).setDepth(2000);

        const dialogBorder = this.gameScene.add.rectangle(
            centerX,
            centerY,
            600,
            250
        ).setStrokeStyle(4, 0xFFD700).setScrollFactor(0).setDepth(2000);

        // Add portrait from character select
        const portrait = this.gameScene.add.image(
            centerX - 200,
            centerY,
            'WizardLizard_Portrait'
        ).setScrollFactor(0).setDepth(2001).setDisplaySize(150, 150);

        // Add boss name
        const nameText = this.gameScene.add.text(
            centerX - 50,
            centerY - 80,
            'LIZARD WIZARD',
            {
                fontFamily: 'Arial Black',
                fontSize: '24px',
                color: '#FFD700',
                stroke: '#000000',
                strokeThickness: 4
            }
        ).setOrigin(0, 0.5).setScrollFactor(0).setDepth(2001);

        // Add dialog text with typewriter effect
        const dialogText = this.gameScene.add.text(
            centerX - 50,
            centerY - 20,
            '',
            {
                fontFamily: 'Arial',
                fontSize: '18px',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 3,
                wordWrap: { width: 320 }
            }
        ).setOrigin(0, 0).setScrollFactor(0).setDepth(2001);

        const fullText = "You have bested me, brave warrior.\nYour skills are impressive...\nI shall join your ranks and fight\nby your side!";

        let charIndex = 0;
        const typewriterSpeed = 30;

        const typewriterTimer = this.gameScene.time.addEvent({
            delay: typewriterSpeed,
            callback: () => {
                if (charIndex < fullText.length) {
                    dialogText.text += fullText[charIndex];
                    charIndex++;
                } else {
                    typewriterTimer.destroy();

                    // Add "Press any key" text after typewriter finishes
                    const continueText = this.gameScene.add.text(
                        centerX,
                        centerY + 90,
                        'Press any key to continue...',
                        {
                            fontFamily: 'Arial',
                            fontSize: '14px',
                            color: '#888888'
                        }
                    ).setOrigin(0.5).setScrollFactor(0).setDepth(2001);

                    // Blinking effect
                    this.gameScene.tweens.add({
                        targets: continueText,
                        alpha: 0.3,
                        duration: 500,
                        yoyo: true,
                        repeat: -1
                    });

                    // Close dialog on any key press and trigger level complete
                    const closeDialog = () => {
                        dialogBg.destroy();
                        dialogBorder.destroy();
                        portrait.destroy();
                        nameText.destroy();
                        dialogText.destroy();
                        continueText.destroy();
                        this.gameScene.input.keyboard?.off('keydown', closeDialog);
                        this.gameScene.input.off('pointerdown', closeDialog);

                        // Trigger level complete after short delay
                        this.gameScene.time.delayedCall(500, () => {
                            this.gameScene.showLevelCompleteMessage();
                        });
                    };

                    this.gameScene.input.keyboard?.once('keydown', closeDialog);
                    this.gameScene.input.once('pointerdown', closeDialog);
                }
            },
            loop: true
        });
    }

    private unlockLizardWizardCharacter(): void {
        const unlocked = localStorage.getItem('unlockedCharacters');
        let unlockedSet: Set<string>;

        if (unlocked) {
            unlockedSet = new Set(JSON.parse(unlocked));
        } else {
            unlockedSet = new Set(['sword-and-board']);
        }

        if (!unlockedSet.has('lizard-wizard')) {
            unlockedSet.add('lizard-wizard');
            localStorage.setItem('unlockedCharacters', JSON.stringify([...unlockedSet]));
            console.log('[UNLOCK] Lizard Wizard character unlocked!');

            // Show unlock message
            const text = this.gameScene.add.text(
                this.gameScene.scale.width / 2,
                this.gameScene.scale.height / 2 - 100,
                'LIZARD WIZARD UNLOCKED!',
                {
                    fontFamily: 'Arial Black',
                    fontSize: '48px',
                    color: '#FFD700',
                    stroke: '#000000',
                    strokeThickness: 8,
                    align: 'center'
                }
            ).setOrigin(0.5).setScrollFactor(0).setDepth(1000);

            this.gameScene.tweens.add({
                targets: text,
                alpha: 0,
                y: text.y - 50,
                duration: 3000,
                ease: 'Power2',
                onComplete: () => text.destroy()
            });
        }
    }
}
