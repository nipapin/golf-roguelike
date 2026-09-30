import Phaser from 'phaser';
import { getGameManager } from '../GameManager';
import { gamePopup, popupButton } from '../design/GamePopup';
import { AudioSystem } from '../audio/AudioSystem';
import { showBuildPanel } from '../design/BuildPanel';

export class EndScene extends Phaser.Scene {
  constructor() { super('EndScene'); }
  create(): void {
    const manager = getGameManager();
    const state = manager.getState();
    if (!state) { this.scene.start('StartScene'); return; }
    const won = state.phase === 'victory';
    AudioSystem.setMusicScene(won ? 'victory' : 'defeat');
    const modal = gamePopup(this, won ? 'RUN COMPLETE!' : 'RUN ENDED', won ? 'The Golf King is defeated. You did it!' : 'One more run. One stronger build.', 460);
    const { content, top, width } = modal;
    const emblem = this.add.text(0, top + 139, won ? '♛' : '♠', { fontFamily: 'Lilita One', fontSize: '66px', color: won ? '#ffe35a' : '#ff7d92' }).setOrigin(.5).setStroke('#1b1030', 5);
    content.add(emblem);
    this.tweens.add({ targets: emblem, angle: 5, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    content.add(this.add.text(0, top + 210, `FIGHT ${Math.min(state.currentFight + 1, manager.getTotalFights())} / ${manager.getTotalFights()}`, { fontFamily: 'Lilita One', fontSize: '24px', color: '#ffffff' }).setOrigin(.5).setStroke('#1b1030', 4));
    content.add(this.add.text(0, top + 246, `♦ ${state.player.gold} GOLD    ◆ ${state.player.relics.length} RELICS`, { fontFamily: 'Fredoka', fontSize: '16px', color: '#ffe0a1' }).setOrigin(.5));
    const build = this.add.text(0, top + 280, 'VIEW YOUR BUILD', { fontFamily: 'Lilita One', fontSize: '15px', color: '#b6d9ff' }).setOrigin(.5).setInteractive();
    build.on('pointerup', () => { const panel = showBuildPanel(this, state.player.relics, () => {}); panel.setDepth(3000); });
    content.add(build);
    popupButton(this, content, modal.height / 2 - 106, width - 44, 'NEW RUN', () => {
      manager.abandonRun(); manager.startNewRun(); this.scene.stop('BattleScene'); this.scene.start('RewardScene');
    });
    popupButton(this, content, modal.height / 2 - 44, width - 44, 'MAIN MENU', () => { this.scene.stop('BattleScene'); this.scene.start('StartScene'); }, true);
  }
}
