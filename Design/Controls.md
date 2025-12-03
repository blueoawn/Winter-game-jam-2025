The general flow of the inputs controls is as follows:

ButtonMapper (handles local inputs and auto detects control scheme)
↓
PlayerController (Parent class for character, tells the game what the player is trying to do at any moment, has default overridable functions and data for movement and abilities)
↓ 
Characters/<Character>.ts (Defines sprite, health, ability1, ability2, cooldowns, restrictions, boons, cpu behavior)
↓ 
MultiplayerManager (Collects information about the active game state for serialization and synchronization between peers)