/** Feet stay below the grass horizon; depth controls both size and draw order. */
export function enemyGroundPlacement(id: number, arenaTop: number, arenaHeight: number) {
  const lane = (id % 6) / 5;
  const near = arenaTop + arenaHeight - 14;
  const far = Math.min(near, arenaTop + arenaHeight * .78);
  return { y: near - (near - far) * lane, scale: 1 - lane * .5, depth: 39 - lane * 5 };
}
