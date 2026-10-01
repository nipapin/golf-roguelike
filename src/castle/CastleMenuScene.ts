import Phaser from 'phaser';
import {
  viewport,
  configureViewport,
  safeArea,
  getRenderDensity,
} from '../presentation/design/viewport';
import { gamePopup, popupButton } from '../presentation/design/GamePopup';
import { AudioSystem } from '../presentation/audio/AudioSystem';
import { castleArt } from './CastleArt';
import { showCastleWorkshop } from './CastleWorkshop';
import { castleManager } from './CastleManager';
import { trainingCompleted } from './CastleTutorial';
import { siegeDifficulty } from './CastleDefense';

export function siegeRules(scene: Phaser.Scene, close: () => void) {
  const modal = gamePopup(scene, 'DEFEND THE CASTLE', 'One solitaire. A whole siege.', 560);
  modal.root.setDepth(3000);
  const lines = [
    [
      'PLAY ±1',
      'Take an open card one rank above or below the active card. A ↔ K works. WILD accepts any card.',
    ],
    [
      'BUILD A CHAIN',
      '1: soldier · 2: archer · 3: build / reload ONE turret\n4: arc cannon · 5: laser. Rewards stay banked until you DRAW from stock. Then all reached rewards deploy. Soldiers march: 1 HP / 1 damage.',
    ],
    [
      'THE ROAD IS REAL TIME',
      'Groups of 3–5 enemies march toward your castle. Every 20 regular invaders brings a supermonster. Pause or switch apps to stop time.',
    ],
    [
      'CARDS KEEP YOU ALIVE',
      'Suits grant repairs, armor and coins. NEXT previews stock; UNDO returns your last card for 1 castle HP. Red joker heals; black joker boosts new defenders ×5. Their order matters.',
    ],
    [
      'FINISH TO WIN',
      'Clear all columns for the final world-clearing blast. Coins from kills and diamonds are banked even if your castle falls. Upgrade in the workshop. Winning advances siege difficulty. Losing resets it to siege 1. Your upgrades and best run stay.',
    ],
  ];
  const available = modal.height - 166,
    step = available / lines.length;
  lines.forEach(([title, body], i) => {
    modal.content.add(
      scene.add.text(-modal.width / 2 + 18, modal.top + 106 + i * step, title, {
        resolution: getRenderDensity(),
        fontFamily: 'Lilita One',
        fontSize: '16px',
        color: '#ffe35a',
      })
    );
    modal.content.add(
      scene.add.text(-modal.width / 2 + 18, modal.top + 127 + i * step, body, {
        resolution: getRenderDensity(),
        fontFamily: 'Fredoka',
        fontSize: '12px',
        color: '#f4e9ff',
        wordWrap: { width: modal.width - 36 },
      })
    );
  });
  popupButton(scene, modal.content, modal.height / 2 - 34, modal.width - 36, 'GOT IT', () => {
    modal.root.destroy();
    close();
  });
  return modal.root;
}
export class CastleMenuScene extends Phaser.Scene {
  constructor() {
    super('StartScene');
  }
  create(): void {
    configureViewport(this);
    AudioSystem.setMusicScene('menu');
    const { width: w, height: h } = viewport(this),
      safe = safeArea(this),
      manager = castleManager();
    this.cameras.main.setBackgroundColor('#213e48');
    this.add.image(w / 2, h * 0.32, 'battlefield-kenney').setDisplaySize(w, h * 0.64);
    this.add.rectangle(w / 2, h * 0.77, w, h * 0.46, 0x254650).setStrokeStyle(3, 0x6d989e);
    this.text(w / 2, safe.top + 38, 'CASTLE\nSOLITAIRE', 38, '#fff1b3')
      .setAlign('center')
      .setStroke('#1b1030', 7);
    this.text(w / 2, safe.top + 108, 'Build a chain. Hold the castle.', 16, '#fff8eb');
    castleArt(this, w * 0.68, safe.top + Math.min(335, safe.height * 0.49), 1.35);
    const enemy = this.add
      .sprite(w * 0.2, safe.top + Math.min(335, safe.height * 0.49), 'enemy-c_orc')
      .setOrigin(0.5, 1)
      .setDisplaySize(85, 85);
    enemy.play('c_orc-idle');
    this.tweens.add({
      targets: enemy,
      x: w * 0.27,
      duration: 1800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });
    const meta = manager.service.readMeta(),
      saved = manager.service.load();
    const next = meta.currentStreak + 1;
    const threat = siegeDifficulty(next);
    this.text(
      w / 2,
      safe.top + 140,
      `NEXT SIEGE #${next} · ENEMY HP +${Math.round((threat.hp - 1) * 100)}%`,
      13,
      '#ffda9a'
    );
    this.text(
      w / 2,
      safe.top + 162,
      `BEST RUN · SIEGE #${meta.bestSiege} · ${meta.bestKills} KILLS`,
      12,
      '#bfe1e3'
    );
    const buttons = this.add.container(w / 2, safe.bottom - 165);
    this.add.image(w / 2 - 39, safe.bottom - 223, 'coin').setDisplaySize(26, 26);
    this.text(w / 2 + 17, safe.bottom - 223, String(meta.coins), 24, '#ffe35a');
    popupButton(
      this,
      buttons,
      0,
      w - 48,
      saved?.run.phase === 'battle' ? 'CONTINUE SIEGE' : 'NEW SIEGE',
      () => {
        AudioSystem.unlock();
        if (!trainingCompleted()) {
          this.scene.start('CastleScene', {
            tutorial: true,
            finish: saved?.run.phase === 'battle' ? 'resume' : 'start',
          });
          return;
        }
        if (saved?.run.phase === 'battle') manager.resume();
        else manager.start();
        this.scene.start('CastleScene', { tutorial: false });
      }
    );
    popupButton(this, buttons, 62, w - 48, 'WORKSHOP', () => this.workshop(), true);
    popupButton(
      this,
      buttons,
      124,
      (w - 60) / 2,
      'TRAINING',
      () => this.scene.start('CastleScene', { tutorial: true, finish: 'menu' }),
      true
    ).setX(-(w - 36) / 4);
    popupButton(this, buttons, 124, (w - 60) / 2, 'CREDITS', () => this.credits(), true).setX(
      (w - 36) / 4
    );
    if (saved?.run.phase === 'battle') {
      const restart = this.text(w / 2, safe.bottom - 272, 'START A NEW SIEGE', 13, '#ffe3b2');
      restart
        .setPadding(12, 12)
        .setInteractive()
        .on('pointerup', () => {
          const modal = gamePopup(
            this,
            'START OVER?',
            'Your current siege will end. Earned coins will be banked.',
            270
          );
          popupButton(this, modal.content, 35, modal.width - 36, 'NEW SIEGE', () => {
            manager.resume();
            if (manager.state) {
              manager.state.run = { ...manager.state.run, phase: 'defeat' };
              manager.service.settle(manager.state);
            }
            manager.start();
            this.scene.start('CastleScene', { tutorial: false });
          });
          popupButton(
            this,
            modal.content,
            97,
            modal.width - 36,
            'KEEP PLAYING',
            () => modal.root.destroy(),
            true
          );
        });
    }
    const resize = () => this.scene.restart();
    this.scale.on('resize', resize);
    this.events.once('shutdown', () => this.scale.off('resize', resize));
  }
  private text(x: number, y: number, text: string, size: number, color = '#fff8eb') {
    return this.add
      .text(x, y, text, {
        resolution: getRenderDensity(),
        fontFamily: 'Lilita One',
        fontSize: `${size}px`,
        color,
      })
      .setOrigin(0.5);
  }
  private credits(): void {
    const modal = gamePopup(this, 'CREDITS', 'Artists, audio and licenses', 400);
    const content =
      'Models & animation · Kenney · CC0\nCombat VFX · Kalponic Studio / Jony\nFree Stylized Sprite VFX · CC BY 4.0\nMusic · MintoDog / Hope · CC0\nCard / combat audio · Kenney · CC0\nOrc voices · Tim Rockk · CC0\nWeapon recordings · kurt / OGA · CC0\nFonts · Google Fonts · SIL OFL 1.1\nDefense · Golf Rogue';
    modal.content.add(
      this.add
        .text(0, modal.top + 110, content, {
          resolution: getRenderDensity(),
          fontFamily: 'Fredoka',
          fontSize: '12px',
          color: '#f4e9ff',
          align: 'center',
          lineSpacing: 3,
        })
        .setOrigin(0.5, 0)
    );
    const link = this.text(0, modal.top + 310, 'VFX SOURCE & LICENSE', 13, '#ffe35a')
      .setPadding(10)
      .setInteractive();
    link.on('pointerup', () =>
      window.open('https://kalponic-studio.itch.io/free-stylized-sprite-vfx', '_blank', 'noopener')
    );
    modal.content.add(link);
    popupButton(
      this,
      modal.content,
      modal.height / 2 - 34,
      modal.width - 36,
      'BACK',
      () => modal.root.destroy(),
      true
    );
  }
  private workshop(): void {
    showCastleWorkshop(this, () => this.scene.restart());
  }
}
