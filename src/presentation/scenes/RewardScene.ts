import Phaser from 'phaser';
import { getGameManager } from '../GameManager';
import { AudioSystem } from '../audio/AudioSystem';
import { relicIcon } from '../design/relicInfo';

export class RewardScene extends Phaser.Scene {
  private selected = false;
  constructor() { super('RewardScene'); }

  create(): void {
    this.selected = false;
    const state = getGameManager().getState();
    if (!state || state.phase !== 'reward') { this.scene.start('StartScene'); return; }
    const width = this.scale.width;
    const height = this.scale.height;
    const starter = state.rewardKind === 'starter';
    this.cameras.main.setBackgroundColor('#23163c');
    this.add.text(width / 2, 36, starter ? 'PICK YOUR FIRST RELIC' : 'VICTORY!', {
      fontFamily: 'Lilita One', fontSize: starter ? '24px' : '30px', color: '#ffe1a0',
    }).setOrigin(0.5);
    this.add.text(width / 2, 75, starter ? 'Start a build. Each victory adds a new power.' : 'Choose one upgrade for the rest of this run.', {
      fontFamily: 'Fredoka', fontSize: '13px', color: '#dccbe9', align: 'center', wordWrap: { width: width - 36 },
    }).setOrigin(0.5);
    const cardHeight = Math.min(110, (height - 210) / 3);
    state.availableRewards.forEach((relic, index) => {
      const y = 112 + index * (cardHeight + 12);
      const tile = this.add.container(16, y);
      const bg = this.add.rectangle((width - 32) / 2, cardHeight / 2, width - 32, cardHeight, 0xfff2dc).setStrokeStyle(2, 0xb68add).setInteractive();
      tile.add(bg);
      tile.add(this.add.rectangle(32, cardHeight / 2, 44, 46, 0x7048a4));
      tile.add(this.add.text(32, cardHeight / 2, relicIcon(relic), { fontFamily: 'Lilita One', fontSize: '26px', color: '#ffe09c' }).setOrigin(0.5));
      tile.add(this.add.text(66, 16, relic.name, { fontFamily: 'Lilita One', fontSize: '17px', color: '#322149', wordWrap: { width: width - 114 } }));
      tile.add(this.add.text(66, 44, relic.description, { fontFamily: 'Fredoka', fontSize: '14px', color: '#634d74', wordWrap: { width: width - 114 } }));
      tile.setAlpha(0);
      this.tweens.add({ targets: tile, alpha: 1, duration: 220, delay: index * 70 });
      bg.on('pointerup', () => this.choose(relic.id));
    });
    const skipY = Math.min(height - 80, 112 + state.availableRewards.length * (cardHeight + 12) + 18);
    const skip = this.add.rectangle(width / 2, skipY, 180, 38, 0x4e356b).setInteractive();
    this.add.text(width / 2, skipY, 'SKIP UPGRADE', { fontFamily: 'Fredoka', fontSize: '13px', color: '#cbb7df' }).setOrigin(0.5);
    skip.on('pointerup', () => this.choose());
    this.add.text(width / 2, height - 30, `♥ ${state.player.hp}/${state.player.maxHp}    ♦ ${state.player.gold}    RELICS ${state.player.relics.length}`, {
      fontFamily: 'Fredoka', fontSize: '13px', color: '#e4ceef',
    }).setOrigin(0.5);
  }

  private choose(relicId?: string): void {
    if (this.selected) return;
    this.selected = true;
    AudioSystem.unlock();
    AudioSystem.play('reward_pick');
    const manager = getGameManager();
    if (relicId) manager.selectRelic(relicId); else manager.skipReward();
    this.scene.start(manager.getState()?.phase === 'battle' ? 'BattleScene' : 'ShopScene');
  }
}
