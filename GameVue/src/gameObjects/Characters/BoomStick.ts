//TODO

// ABILITY 1 - Boomstick Blast
// Description: Fires a powerful blast from the boomstick 

    // // Higher the spread value the tighter the spread
    // protected ability2(spread = 6, amountOfProjectiles = 7): void {
    //     if (!this.canUseAbility2()) return;
    //     const yDifference = this.currentAim.y - this.y;
    //     const xDifference = this.currentAim.x - this.x;
    //     const distance = Math.sqrt(Math.pow(xDifference, 2) + Math.pow(yDifference, 2));
    //     const rotation = Math.atan2(yDifference, xDifference);

    //     const totalSpreadAngle = Math.PI / spread;
    //     const anglePerProjectile = totalSpreadAngle / (amountOfProjectiles - 1);
    //     const startAngle = rotation - (totalSpreadAngle / 2);

    //     const projectileTrajectories = [];
    //     for(let i = 0; i < amountOfProjectiles; i++) {
    //         const currentAngle = startAngle + (i * anglePerProjectile);
    //         const xLeftTo = this.x + (distance * Math.cos(currentAngle));
    //         const yLeftTo = this.y + (distance * Math.sin(currentAngle));
    //         projectileTrajectories.push({
    //             x: xLeftTo,
    //             y: yLeftTo
    //         })
    //     }

    //     projectileTrajectories.forEach((trajectory) => {
    //         this.gameScene.fireBullet(
    //             {x: this.x, y: this.y},
    //             {x: trajectory.x, y: trajectory.y}
    //         );
    //     })

    //     this.startAbility2Cooldown();
    // }

// TODO ABILITY 2 - Burst of movement, briefly exceed max velocity in the aimed direction