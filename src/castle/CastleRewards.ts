import Phaser from 'phaser';
import { gamePopup, popupTile } from '../presentation/design/GamePopup';
import { CastleManager } from './CastleManager';
import { UPGRADE_VALUES, type UpgradeKey } from './CastleDefense';

const rewards: Record<UpgradeKey, { title: string; description: string; icon: string }> = {
  walls: { title: 'REINFORCED WALLS', description: '+8 castle HP', icon: '+' },
  soldier: { title: 'REINFORCEMENTS', description: '+1 soldier per deployment', icon: '1' },
  knight: { title: 'SHARP ARROWS', description: '+1 archer damage', icon: '>' },
  magazine: { title: 'LARGER MAGAZINE', description: '+5 turret rounds per reload', icon: '5' },
  mortar: { title: 'EXPLOSIVE SHELLS', description: '+2 arc cannon damage', icon: '*' },
  laser: { title: 'FOCUSED LASER', description: '+10 laser damage', icon: '/' },
};
/** The offer is persisted before showing it, so reloads cannot reroll or duplicate it. */
export function showCastleRewards(scene: Phaser.Scene, manager: CastleManager, next: () => void) {
  const meta = manager.service.readMeta();
  if (!meta.pendingReward) {
    next();
    return;
  }
  const modal = gamePopup(
    scene,
    'CHOOSE ONE UPGRADE',
    'Siege complete! Pick 1 of 3.\nBonuses last until your castle falls.',
    470
  );
  modal.root.setDepth(3100);
  let chosen = false;
  meta.pendingReward.choices.forEach((key, i) => {
    const reward = rewards[key];
    popupTile(
      scene,
      modal.content,
      modal.top + 106 + i * 108,
      modal.width - 32,
      94,
      reward.icon,
      reward.title,
      reward.description,
      `RUN BONUS +${(meta.runUpgrades[key] + 1) * UPGRADE_VALUES[key].step}`,
      true,
      () => {
        if (chosen || !manager.service.chooseReward(key)) return;
        chosen = true;
        modal.root.destroy();
        next();
      }
    );
  });
  return modal.root;
}
