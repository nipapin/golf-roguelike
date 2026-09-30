import Phaser from 'phaser';
import { getGameManager } from '../GameManager';
import { gamePopup, popupButton, popupTile } from '../design/GamePopup';
import { relicIcon } from '../design/relicInfo';
import { AudioSystem } from '../audio/AudioSystem';

export class ShopScene extends Phaser.Scene {
  private busy = false;
  constructor() { super('ShopScene'); }
  create(): void {
    AudioSystem.setMusicScene('menu');
    this.busy = false;
    const manager = getGameManager();
    const state = manager.getState();
    if (!state || state.phase !== 'shop') { this.scene.start('StartScene'); return; }
    const config = manager.getConfig();
    const modal = gamePopup(this, 'TRAVELING MERCHANT', `♦ ${state.player.gold} GOLD     ♥ ${state.player.hp}/${state.player.maxHp}`, 510);
    const { content, width, top } = modal;
    const available = manager.getAllRelics().filter(r => !state.player.relics.some(owned => owned.id === r.id)).slice(0, 2);
    const purchase = (action: () => void) => {
      if (this.busy) return;
      this.busy = true; AudioSystem.unlock(); AudioSystem.play('reward_pick'); action(); this.scene.restart();
    };
    const canHeal = state.player.gold >= config.shop.healCost && state.player.hp < state.player.maxHp;
    popupTile(this, content, top + 106, width - 28, 88, '♥', `HEAL +${config.shop.healAmount} HP`, 'Restore health before the next fight.', state.player.hp === state.player.maxHp ? 'FULL HEALTH' : `♦ ${config.shop.healCost}${canHeal ? ' · BUY' : ' · NEED MORE GOLD'}`, canHeal, () => purchase(() => { manager.buyHealing(); }));
    available.forEach((relic, index) => {
      const canBuy = state.player.gold >= config.shop.relicBaseCost;
      popupTile(this, content, top + 204 + index * 98, width - 28, 88, relicIcon(relic), relic.name, relic.description, `♦ ${config.shop.relicBaseCost}${canBuy ? ' · BUY' : ' · NEED MORE GOLD'}`, canBuy, () => purchase(() => { manager.buyShopRelic(relic.id); }));
    });
    popupButton(this, content, modal.height / 2 - 44, width - 44, 'NEXT FIGHT', () => {
      if (this.busy) return;
      this.busy = true; manager.proceedFromShop(); this.scene.stop('BattleScene'); this.scene.start('BattleScene');
    });
  }
}
