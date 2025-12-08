/**
 * Team definitions for PvP gameplay
 */
export enum Team {
    Neutral = 'neutral',
    Red = 'red',
    Blue = 'blue'
}

/**
 * Check if two entities are on opposing teams
 * Neutral entities are hostile to everyone
 */
export function areEnemies(team1: Team, team2: Team): boolean {
    // Neutral is hostile to everyone
    if (team1 === Team.Neutral || team2 === Team.Neutral) {
        return true;
    }
    // Same team = not enemies
    return team1 !== team2;
}

/**
 * Check if two entities are on the same team (excluding neutral)
 */
export function areAllies(team1: Team, team2: Team): boolean {
    if (team1 === Team.Neutral || team2 === Team.Neutral) {
        return false;
    }
    return team1 === team2;
}
