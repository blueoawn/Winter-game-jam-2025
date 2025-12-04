// Depth layers for rendering order (higher = on top)
export enum Depth {
    BACKGROUND = 0,
    TILES = 10,
    GROUND_EFFECTS = 20,
    ENEMIES = 50,
    BULLETS = 60,
    PLAYER = 100,
    PLAYER_UI = 101,      // Health bar, skill bar
    ABILITIES = 99,       // Beams, shields, etc.
    UI_OVERLAY = 200,
    DEBUG = 999
}

