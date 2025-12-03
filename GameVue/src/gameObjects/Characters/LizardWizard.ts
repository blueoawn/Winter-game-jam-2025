import { PlayerController } from '../../../managers/PlayerController';
import { GameScene } from '../../scenes/Game';

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

        // Fire projectile using stored aim position (works for both local and network input)
        this.gameScene.fireBullet(
            {x: this.x, y: this.y},
            {x: this.currentAim.x, y: this.currentAim.y}
        );

        this.startAbility1Cooldown();
    }

    // Higher the spread value the tighter the spread
    protected ability2(spread = 6, amountOfProjectiles = 3): void {
        if (!this.canUseAbility2()) return;
        const yDifference = this.currentAim.y - this.y;
        const xDifference = this.currentAim.x - this.x;
        const distance = Math.sqrt(Math.pow(xDifference, 2) + Math.pow(yDifference, 2));
        const rotation = Math.atan2(yDifference, xDifference);

        const totalSpreadAngle = Math.PI / spread;
        const anglePerProjectile = totalSpreadAngle / (amountOfProjectiles - 1);
        const startAngle = rotation - (totalSpreadAngle / 2);

        const projectileTrajectories = [];
        for(let i = 0; i < amountOfProjectiles; i++) {
            const currentAngle = startAngle + (i * anglePerProjectile);
            const xLeftTo = this.x + (distance * Math.cos(currentAngle));
            const yLeftTo = this.y + (distance * Math.sin(currentAngle));
            projectileTrajectories.push({
                x: xLeftTo,
                y: yLeftTo
            })
        }

        projectileTrajectories.forEach((trajectory) => {
            this.gameScene.fireBullet(
                {x: this.x, y: this.y},
                {x: trajectory.x, y: trajectory.y}
            );
        })

        this.startAbility2Cooldown();
    }

    // Optional: AI behavior stub for future
    updateAI(): void {
        // For CPU-controlled characters
        // Not implemented in this phase
    }
}
