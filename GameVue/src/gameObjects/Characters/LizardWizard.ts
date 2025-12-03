import { PlayerController } from '../../../managers/PlayerController';
import { GameScene } from '../../scenes/Game';
import ASSETS from '../../assets';

export class LizardWizard extends PlayerController {
    constructor(scene: GameScene, x: number, y: number) {
        super(scene, x, y, 0);  // Frame 0 for LizardWizard

        // Override stats - fast and fragile
        this.characterSpeed = 800;
        this.velocityMax = 450;
        this.health = 1;
        this.ability1Rate = 10;   // Fast fire rate
        this.ability2Rate = 120;  // Special ability every 2 seconds
    }

    protected ability1(): void {
        if (!this.canUseAbility1()) return;

        // Fire projectile
        this.gameScene.fireBullet(
            {x: this.x, y: this.y},
            {x: this.gameScene.input.mousePointer.x, y: this.gameScene.input.mousePointer.y}
        );

        this.startAbility1Cooldown();
    }

    protected ability2(): void {
        if (!this.canUseAbility2()) return;

        // Wizard special: spread shot (stub for now)
        console.log('LizardWizard spread shot!');
        // TODO: Implement spread shot later
        // Could fire 3 projectiles in a spread pattern

        this.startAbility2Cooldown();
    }

    // Optional: AI behavior stub for future
    updateAI(): void {
        // For CPU-controlled characters
        // Not implemented in this phase
    }
}
