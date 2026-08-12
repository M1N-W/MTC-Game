# Map design and barrel lifecycle change summary

## Implemented delta

- Reduced repeated server racks, archive shelves, courtyard trees, lecture-hall desks, and barrel placements to establish ordered campus sectors and clear traversal lanes.
- Added `MapSystem.removeObjectsByFlag(flagName)` as the single owner of object-collection cache invalidation. It compacts the authoritative array in place, rebuilds the static collision grid, and marks the sorted draw buffer dirty.
- Replaced `game.js` direct mutation of private draw-cache fields with the map-owned removal operation after barrel explosions.
- Added a smoke regression that proves an exploded barrel is removed while remaining props stay in the object list, the render cache is marked dirty, and the spatial grid no longer returns that barrel.

## Verification target

The update path remains free of render calls. The draw path remains free of state mutation. Cache rebuilding occurs only after a barrel is actually removed, preserving the 60 FPS static-map path.
