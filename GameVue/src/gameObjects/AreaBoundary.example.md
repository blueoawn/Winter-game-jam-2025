# AreaBoundary Usage Examples

## Overview
AreaBoundary creates static map zones that apply effects to players and enemies without requiring network synchronization. Effects are deterministic based on map configuration.

## Basic Examples

### 1. Mud Zone (Slow Movement)
```typescript
areaBoundaries: [
    {
        x: 800,
        y: 600,
        width: 200,
        height: 150,
        effectType: AreaEffectType.SpeedModifier,
        speedMultiplier: 0.5,  // 50% slower
        visible: true,
        fillColor: 0x8B4513,   // Brown
        fillAlpha: 0.3
    }
]
```

### 2. Conveyor Belt / Treadmill (Constant Push)
```typescript
{
    x: 400,
    y: 400,
    width: 300,
    height: 100,
    effectType: AreaEffectType.VelocityPush,
    pushVelocity: { x: 50, y: 0 },  // Push right at 50 px/s
    visible: true,
    fillColor: 0x808080,  // Gray
    fillAlpha: 0.4
}
```

### 3. Wind Zone (Diagonal Push)
```typescript
{
    x: 600,
    y: 300,
    width: 400,
    height: 400,
    effectType: AreaEffectType.VelocityPush,
    pushVelocity: { x: 30, y: -30 },  // Push up-right
    visible: false  // Invisible wind
}
```

### 4. Lava / Damage Zone
```typescript
{
    x: 1000,
    y: 800,
    width: 150,
    height: 150,
    effectType: AreaEffectType.DamageOverTime,
    damageRate: 2,        // 2 damage per tick
    tickInterval: 500,    // Every 0.5 seconds
    visible: true,
    fillColor: 0xFF4500,  // Red-orange
    fillAlpha: 0.5
}
```

### 5. Healing Zone / Fountain
```typescript
{
    x: 200,
    y: 200,
    width: 100,
    height: 100,
    effectType: AreaEffectType.HealOverTime,
    healRate: 1,          // Restore 1 HP per tick
    tickInterval: 1000,   // Every 1 second
    visible: true,
    fillColor: 0x00FF00,  // Green
    fillAlpha: 0.4
}
```

### 6. Ice (Speed Boost)
```typescript
{
    x: 500,
    y: 500,
    width: 250,
    height: 250,
    effectType: AreaEffectType.SpeedModifier,
    speedMultiplier: 1.5,  // 50% faster (slippery ice)
    visible: true,
    fillColor: 0x87CEEB,   // Sky blue
    fillAlpha: 0.3
}
```

## Complete Map Example

```typescript
export const ExampleMap: MapData = {
    id: 'example-map',
    name: 'Hazard Course',
    description: 'Map with various environmental zones',
    
    width: 1600,
    height: 1200,
    assetKey: 'example-map',
    
    spawnPoints: {
        default: { x: 800, y: 100 }
    },
    
    areaBoundaries: [
        // Mud pit near center
        {
            x: 800,
            y: 600,
            width: 200,
            height: 200,
            effectType: AreaEffectType.SpeedModifier,
            speedMultiplier: 0.4,
            visible: true,
            fillColor: 0x8B4513,
            fillAlpha: 0.4
        },
        
        // Moving platform (left to right)
        {
            x: 400,
            y: 800,
            width: 400,
            height: 80,
            effectType: AreaEffectType.VelocityPush,
            pushVelocity: { x: 60, y: 0 },
            visible: true,
            fillColor: 0x808080,
            fillAlpha: 0.5
        },
        
        // Lava pool
        {
            x: 1200,
            y: 900,
            width: 150,
            height: 150,
            effectType: AreaEffectType.DamageOverTime,
            damageRate: 3,
            tickInterval: 500,
            visible: true,
            fillColor: 0xFF4500,
            fillAlpha: 0.6
        },
        
        // Healing fountain
        {
            x: 200,
            y: 200,
            width: 120,
            height: 120,
            effectType: AreaEffectType.HealOverTime,
            healRate: 2,
            tickInterval: 1000,
            visible: true,
            fillColor: 0x00FF00,
            fillAlpha: 0.4
        }
    ]
};
```

## Notes

- **No Network Sync**: Area boundaries are static and identical on all clients
- **Deterministic**: Effects are applied based on overlap, same for all players
- **Performance**: Use `visible: false` for invisible effects (better performance)
- **Stacking**: Multiple zones can overlap - effects will stack
- **Exit Behavior**: Speed modifiers are automatically removed when leaving the zone
