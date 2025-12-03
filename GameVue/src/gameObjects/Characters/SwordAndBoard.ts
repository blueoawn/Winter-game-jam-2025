import { PlayerController } from '../../../managers/PlayerController';
import { GameScene } from '../../scenes/Game';
import ASSETS from '../../assets';

export class SwordAndBoard extends PlayerController {
    constructor(scene: GameScene, x: number, y: number) {
        super(scene, x, y, 1);  // Frame 1 for SwordAndBoard

        // Override stats - slow but tanky
        this.characterSpeed = 600;
        this.velocityMax = 350;
        this.health = 3;  // More health
        this.ability1Rate = 20;   // Slower attack
        this.ability2Rate = 180;  // Shield every 3 seconds
    }

    protected ability1(): void {
        if (!this.canUseAbility1()) return;

        // Melee attack (fires short-range projectile for now)
        // Uses stored aim position (works for both local and network input)
        this.gameScene.fireBullet(
            {x: this.x, y: this.y},
            {x: this.currentAim.x, y: this.currentAim.y}
        );

        this.startAbility1Cooldown();
    }

    protected ability2(): void {
        if (!this.canUseAbility2()) return;

        // Shield ability (stub for now)
        console.log('SwordAndBoard shield up!');
        // TODO: Implement shield that blocks damage
        // Might be easier set a temporary invulnerability flag

        this.startAbility2Cooldown();
    }

    // Optional: Override to be tankier
    protected getMaxSpeed(): number {
        return this.velocityMax;
    }

    // Optional: AI behavior stub for future
    updateAI(): void {
        // For CPU-controlled characters
        // Not implemented in this phase
    }
}
