import { PlayerController } from './PlayerController';
import { GameScene } from '../../scenes/Game';
import { MagicMissile } from '../Projectile/MagicMissile';
import ASSETS from "../../assets.ts";

export class LizardWizard extends PlayerController {
    private missiles: Set<MagicMissile> = new Set();

    constructor(scene: GameScene, x: number, y: number) {
        super(scene, x, y, 0);  // Frame 0 for LizardWizard

        // Override stats - fast and fragile
        this.characterSpeed = 800;
        this.velocityMax = 450;
        this.maxHealth = 20;
        this.health = this.maxHealth;
        this.ability1Rate = 30;   // Fast fire rate
        this.ability2Rate = 60*2;  // Special ability every 2 seconds

        this.setAppearance(ASSETS.image.lizardWizard.key, 0);
        this.setScale(0.5, 0.5)
        this.setBodySize(this.width, this.height);

        // Cleanup missiles on destroy
        this.on('destroy', () => {
            this.missiles.forEach(missile => missile.destroy());
            this.missiles.clear();
        });
    }

    protected ability1(): void {
        if (!this.canUseAbility1()) {
            //console.log(`LizardWizard: ability1 blocked by cooldown (${this.ability1Cooldown} frames remaining)`);
            return;
        }

        //console.log(`LizardWizard: Firing Magic Missile`);

        // Create magic missile
        const missile = new MagicMissile(
            this.gameScene,
            this.x,
            this.y,
            this.currentAim.x,
            this.currentAim.y,
            1 // Base damage
        );

        this.missiles.add(missile);

        // Remove from set when destroyed
        missile.once('destroy', () => {
            this.missiles.delete(missile);
        });

        // Add to player bullet group for collision detection
        this.gameScene.playerBulletGroup.add(missile);

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

        // Fire spread of magic missiles
        for(let i = 0; i < amountOfProjectiles; i++) {
            const currentAngle = startAngle + (i * anglePerProjectile);
            const xLeftTo = this.x + (distance * Math.cos(currentAngle));
            const yLeftTo = this.y + (distance * Math.sin(currentAngle));

            const missile = new MagicMissile(
                this.gameScene,
                this.x,
                this.y,
                xLeftTo,
                yLeftTo,
                1 // Base damage
            );

            this.missiles.add(missile);

            missile.once('destroy', () => {
                this.missiles.delete(missile);
            });

            this.gameScene.playerBulletGroup.add(missile);
        }

        this.startAbility2Cooldown();
    }
    
    // TODO
    updateAI(): void {
        // For CPU-controlled characters
        // Not implemented in this phase
    }
}
