// //TODO - helper class for network sync
// export class Consumable extends SyncableEntity {
//     // Override the state type for type safety
//     public state: ConsumableState;
//     // The view will be a Phaser Sprite with a physics body on the host/client
//     public view: Sprite | null = null;

//     constructor(initialState: ConsumableState) {
//         super(initialState);
//         this.state = initialState; // Assigning again for strong typing
//         this.state.type = 'Consumable';
//     }

//     /**
//      * Client/Host: Creates the visual sprite and physics body.
//      */
//     public createView(scene: Phaser.Scene): void {
//         // Create the Sprite. The frame is provided in the state.
//         // Health Pack example: (See sprite tiles.png row3,col1) - Assuming frame index 21 for a 7x4 sheet.
//         const sprite = scene.physics.add.sprite(
//             this.state.x, 
//             this.state.y, 
//             'tiles', // Assuming a tileset key named 'tiles'
//             this.state.frameIndex
//         );

//         // Make the consumable slightly smaller and static
//         sprite.body.setImmovable(true);
//         sprite.setCircle(sprite.width / 2); // Set circular hit area

//         this.view = sprite;
//         this.syncView();
//     }

//     /**
//      * Client/Host: Aligns the visual view with the synced state data.
//      */
//     public syncView(): void {
//         if (!this.view) return;

//         // Position sync (Important for non-host clients)
//         this.view.setPosition(this.state.x, this.state.y);

//         // Visibility sync (Ensures consumed entities disappear immediately)
//         this.view.setVisible(!this.state.isDead);

//         // Check for state changes like frame index if the item type could change
//         if (this.view.frame.index !== this.state.frameIndex) {
//             this.view.setFrame(this.state.frameIndex);
//         }
//     }

//     /**
//      * Host/Server: Update method for decay logic.
//      * Only runs on the host (source of truth) to modify state.
//      * @param delta Time since last update in ms.
//      */
//     public update(delta: number): void {
//         if (this.state.isDead) return;

//         // Optional Decay Logic
//         if (this.state.lifetime && this.state.lifetime > 0) {
//             this.state.lifetime -= delta;

//             if (this.state.lifetime <= 0) {
//                 console.log(`Consumable ${this.id} decayed.`);
//                 // Set isDead=true to flag for network sync and subsequent destruction
//                 this.state.isDead = true;
//             }
//         }
//     }

//     /**
//      * Host/Server: Applies the statistical effect to the player.
//      * This method is triggered by the **Game Scene/Manager** when an overlap is detected.
//      * @param playerController The PlayerController instance that consumed the item.
//      */
//     public applyEffect(playerController: any): void {
//         if (this.state.isDead) return;
        
//         console.log(`Applying effect: ${this.state.consumableType} for ${this.state.value}`);

//         switch (this.state.consumableType) {
//             case ConsumableType.HealthPack:
//                 // Example: Restore player to full health
//                 if (playerController.health !== playerController.maxHealth) {
//                     playerController.health = playerController.maxHealth;
//                     playerController.updateHealthBarValue(); // Assumes method exists
//                 }
//                 break;
//             case ConsumableType.SpeedBoost:
//                 // Example: Temporarily increase speed (requires timer management on the player)
//                 playerController.applyTemporarySpeedBoost(this.state.value, 5000); // 5 seconds
//                 break;
//             default:
//                 console.warn(`Unknown consumable type: ${this.state.consumableType}`);
//         }

//         // Mark as consumed for network synchronization
//         this.state.isDead = true;
//     }
// }