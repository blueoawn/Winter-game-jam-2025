//TODO

// Railgun ability 1 - ninja star attack, fast moving projectile that does moderate damage with distance falloff

// Should probably have a longer interval than the magic missle, but be more powerful, perhaps using the spreadshot logic from lizard wizard ability 2

// We could then give lizard wizard ability 2 something a little more unique


// Railgun ability 2 - long range beam that pierces (doesn't stop when it makes contact with collider)
// Width and damage have a set maximum, that builds up over time while charging between shots

// For example, if the player shoots immediately after the cooldown, the beam is thin and low damage

// But if the player waits a few seconds, the beam becomes wider and more powerful

// Holding down ability 1 button after expending the charge should lock the player's movement, and gradually restore charge

// ninja star projectile

 // TODO - MOVE this to railgun character, with spread logic of lizard wizard a2, longer cooldown

    // protected ability1(): void {
    //     if (!this.canUseAbility1()) return;

    //     const yDifference = this.currentAim.y - this.y;
    //     const xDifference = this.currentAim.x - this.x;
    //     const distance = Math.sqrt(Math.pow(xDifference, 2) + Math.pow(yDifference, 2));
    //     const rotation = Math.atan2(yDifference, xDifference);

    //     const totalSpreadAngle = Math.PI / spread;
    //     const anglePerProjectile = totalSpreadAngle / (amountOfProjectiles - 1);
    //     const startAngle = rotation - (totalSpreadAngle / 2);

    //     // Fire spread of ninja stars
    //     for(let i = 0; i < amountOfProjectiles; i++) {
    //         const currentAngle = startAngle + (i * anglePerProjectile);
    //         const xLeftTo = this.x + (distance * Math.cos(currentAngle));
    //         const yLeftTo = this.y + (distance * Math.sin(currentAngle));

    //         const star = new NinjaStar(
    //             this.gameScene,
    //             this.x,
    //             this.y,
    //             xLeftTo,
    //             yLeftTo,
    //             1 // Base damage
    //         );

    //         this.missiles.add(missile);

    //         missile.once('destroy', () => {
    //             this.missiles.delete(missile);
    //         });

    //         this.gameScene.playerBulletGroup.add(missile);
    //     }

    //     this.slashes.add(slash);

    //     // Remove from set when destroyed
    //     slash.once('destroy', () => {
    //         this.slashes.delete(slash);
    //     });

    //     // Add to player bullet group for collision detection
    //     this.gameScene.playerBulletGroup.add(slash);

    //     this.startAbility1Cooldown();
    // }