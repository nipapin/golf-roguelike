import { configureViewport } from '../design/viewport';
import Phaser from 'phaser';
import { getGameManager } from '../GameManager';
import { AudioSystem } from '../audio/AudioSystem';
import { relicIcon } from '../design/relicInfo';
import { gamePopup, popupButton, popupTile } from '../design/GamePopup';
import { showRules, hasSeenRules } from '../design/RulesPopup';

export class RewardScene extends Phaser.Scene {
  private selected = false;
  constructor() { super('RewardScene'); }
  create(): void {
    configureViewport(this);
    AudioSystem.setMusicScene('menu');
    this.selected = false;
    const state = getGameManager().getState();
    if (!state || state.phase !== 'reward') { this.scene.start('StartScene'); return; }
    const starter = state.rewardKind === 'starter';
    const modal = gamePopup(this, starter ? 'CHOOSE YOUR POWER' : 'VICTORY! UPGRADE', starter ? 'Pick one relic to start your build.' : 'Pick one relic. It lasts for this run.', 510);
    const { content, width, top } = modal;
    state.availableRewards.forEach((relic, index) => {
      popupTile(this, content, top + 106 + index * 98, width - 28, 88, relicIcon(relic), relic.name, relic.description, 'CHOOSE', true, () => this.choose(relic.id));
    });
    popupButton(this, content, modal.height / 2 - 44, width - 44, 'SKIP UPGRADE', () => this.choose(), true);
    if (starter && !hasSeenRules()) showRules(this);
  }
  private choose(relicId?: string): void {
    if (this.selected) return;
    this.selected = true;
    AudioSystem.unlock(); AudioSystem.play('reward_pick');
    const manager = getGameManager();
    if (relicId) manager.selectRelic(relicId); else manager.skipReward();
    if (manager.getState()?.phase === 'battle') this.scene.stop('BattleScene');
    this.scene.start(manager.getState()?.phase === 'battle' ? 'BattleScene' : 'ShopScene');
  }
}
