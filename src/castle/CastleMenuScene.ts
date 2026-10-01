import Phaser from 'phaser';
import {
  viewport,
  configureViewport,
  safeArea,
  getRenderDensity,
} from '../presentation/design/viewport';
import { ArenaBackground } from '../presentation/design/ArenaBackground';
import { gamePopup, popupButton } from '../presentation/design/GamePopup';
import { AudioSystem } from '../presentation/audio/AudioSystem';
import { castleArt } from './CastleArt';
import { castleManager } from './CastleManager';
import {
  UPGRADE_KEYS,
  UPGRADE_LIMIT,
  upgradeCost,
  upgradeValue,
  siegeDifficulty,
  type UpgradeKey,
} from './CastleDefense';

const LABELS: Record<UpgradeKey, string> = {
  walls: 'CASTLE WALLS',
  soldier: 'SOLDIERS',
  knight: 'KNIGHTS',
  magazine: 'TURRET MAGAZINE',
  mortar: 'MORTAR',
  laser: 'LASER CORE',
};
const values = (key: UpgradeKey, n: number) =>
  `${upgradeValue(key, n)} ${key === 'walls' ? 'HP' : key === 'magazine' ? 'rounds' : key === 'soldier' ? 'troops' : key === 'knight' ? 'HP / damage' : 'damage'}`;
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
      '1: soldier · 2: knight · 3: build / reload ONE turret\n4: mortar · 5: laser. Rewards stay banked until you DRAW from stock. Then all reached rewards deploy. Soldiers march: 1 HP / 1 damage.',
    ],
    [
      'THE ROAD IS REAL TIME',
      'Groups of 3–5 enemies march toward your castle. Every 20 regular invaders brings a supermonster. Pause or switch apps to stop time.',
    ],
    [
      'CARDS KEEP YOU ALIVE',
      'Hearts repair walls, clubs add armor, diamonds earn coins. Red joker heals; black joker boosts new defenders ×5. Their order matters.',
    ],
    [
      'FINISH TO WIN',
      'Clear all columns for the final world-clearing blast. Coins from kills and diamonds are banked even if your castle falls. Upgrade in the workshop. Each NEW siege raises enemy HP and pressure; continuing a save keeps its difficulty.',
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
    const arena = new ArenaBackground(this);
    arena.draw(w, 0, h, 'castle');
    this.add.rectangle(w / 2, h * 0.77, w, h * 0.46, 0x32206a).setStrokeStyle(3, 0x6748ae);
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
    const next = meta.siegesStarted + 1;
    const threat = siegeDifficulty(next);
    this.text(
      w / 2,
      safe.top + 140,
      `NEXT SIEGE #${next} · ENEMY HP +${Math.round((threat.hp - 1) * 100)}%`,
      13,
      '#ffda9a'
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
        if (saved?.run.phase === 'battle') manager.resume();
        else manager.start();
        this.scene.start('CastleScene');
      }
    );
    popupButton(this, buttons, 62, w - 48, 'WORKSHOP', () => this.workshop(), true);
    popupButton(
      this,
      buttons,
      124,
      (w - 60) / 2,
      'RULES',
      () => siegeRules(this, () => {}),
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
            this.scene.start('CastleScene');
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
      'Animated monsters · CraftPix\nFree Game Assets · CraftPix license\nCombat VFX · Kalponic Studio / Jony\nFree Stylized Sprite VFX · CC BY 4.0\nMusic · request / Heartfelt Battle · CC0\nCard sounds · Kenney · CC0\nFonts · Google Fonts · SIL OFL 1.1\nCastle art & defense · Golf Rogue';
    modal.content.add(
      this.add
        .text(0, modal.top + 110, content, {
          resolution: getRenderDensity(),
          fontFamily: 'Fredoka',
          fontSize: '13px',
          color: '#f4e9ff',
          align: 'center',
          lineSpacing: 6,
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
    const manager = castleManager(),
      meta = manager.service.readMeta();
    const modal = gamePopup(
      this,
      'WORKSHOP',
      `${meta.coins} coins · Siege #${meta.siegesStarted + 1} · Upgrades apply next run`,
      530
    );
    const cellW = (modal.width - 48) / 2,
      rowH = (modal.height - 180) / 3;
    UPGRADE_KEYS.forEach((key, i) => {
      const level = meta.upgrades[key],
        cost = upgradeCost(level),
        maxed = level >= UPGRADE_LIMIT;
      const x = ((i % 2 ? 1 : -1) * (cellW + 12)) / 2,
        y = modal.top + 112 + Math.floor(i / 2) * rowH;
      const tile = this.add.container(x, y);
      tile.add(
        this.add.rectangle(0, rowH / 2 - 6, cellW, rowH - 12, 0xfff0cf).setStrokeStyle(3, 0x1b1030)
      );
      tile.add(this.text(0, 13, LABELS[key], 12, '#35204d'));
      tile.add(this.text(0, 34, `LEVEL ${level} / ${UPGRADE_LIMIT}`, 11, '#77558b'));
      tile.add(
        this.text(
          0,
          55,
          maxed ? values(key, level) : `${values(key, level)}\n→ ${values(key, level + 1)}`,
          10,
          '#35204d'
        )
      );
      tile.add(
        this.text(
          0,
          rowH - 27,
          maxed ? 'MAXED' : `${cost} COINS`,
          13,
          meta.coins >= cost ? '#96600b' : '#927981'
        )
      );
      tile
        .setSize(cellW, rowH - 12)
        .setInteractive(
          new Phaser.Geom.Rectangle(-cellW / 2, 0, cellW, rowH - 12),
          Phaser.Geom.Rectangle.Contains
        )
        .on('pointerup', () => {
          AudioSystem.unlock();
          if (!manager.service.purchase(key)) {
            AudioSystem.play('invalid_tap');
            this.tweens.add({ targets: tile, x: x + 4, duration: 45, yoyo: true, repeat: 2 });
            return;
          }
          AudioSystem.play('reward_pick');
          modal.root.destroy();
          this.workshop();
        });
      modal.content.add(tile);
    });
    popupButton(
      this,
      modal.content,
      modal.height / 2 - 34,
      modal.width - 36,
      'BACK TO CASTLE',
      () => this.scene.restart(),
      true
    );
  }
}
