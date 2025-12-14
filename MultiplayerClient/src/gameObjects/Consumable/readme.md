A consumable is an object that that modifies player statistics in some way. They will need to be multiplayer synced so that everyone sees when they spawn (this can be done through a host update into server storage) and when they are consumed (so that the player getting the effect is also properly in sync)

An example consumable would be a health pack that restores the player to full health. (See sprite tiles.png row3,col1)
A player moving over this sprite should remove it from the game and storage.

Optionally, we can also make these consumables dissappear on their own after a set duration.