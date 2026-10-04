import Phaser from 'phaser';
import { gameDisplayStyle } from '../presentation/design/displayFont';
import { getRenderDensity } from '../presentation/design/viewport';
import { isShakeReduced } from '../presentation/juice/fxSettings';

export interface CastleCardAnnouncementPlacement {
  /** Center of the tableau, just above its top row, in scene coordinates. */
  x: number;
  y: number;
  width: number;
  desktop?: boolean;
}

/** Short, non-interactive announcements where the player is looking: above the cards. */
export class CastleCardAnnouncements {
  readonly root: Phaser.GameObjects.Container;
  private readonly combo: Phaser.GameObjects.Container;
  private readonly comboPlate: Phaser.GameObjects.Graphics;
  private readonly comboText: Phaser.GameObjects.Text;
  private readonly boss: Phaser.GameObjects.Container;
  private readonly bossPlate: Phaser.GameObjects.Graphics;
  private readonly bossText: Phaser.GameObjects.Text;
  private placement: CastleCardAnnouncementPlacement;
  private comboTimer?: Phaser.Time.TimerEvent;
  private bossTimer?: Phaser.Time.TimerEvent;
  private latestCombo = 0;
  private bossVisible = false;
  private seenBosses = new Set<string | number>();

  constructor(private readonly scene: Phaser.Scene, placement: CastleCardAnnouncementPlacement) {
    this.placement = { ...placement };
    this.root = scene.add.container(placement.x, placement.y).setDepth(180).setName('card-announcements');
    this.combo = scene.add.container(0, 0).setName('card-combo-announcement').setVisible(false);
    this.comboPlate = scene.add.graphics();
    this.comboText = scene.add.text(0, 0, '', {
      resolution: getRenderDensity(), ...gameDisplayStyle('×3'),
      fontSize: '46px', color: '#fff29e',
    }).setOrigin(.5).setStroke('#40234f', 5).setShadow(0, 4, '#16252e', 3, true, true)
      .setName('card-combo-value');
    this.combo.add([this.comboPlate, this.comboText]);
    this.boss = scene.add.container(0, 0).setName('card-boss-announcement').setVisible(false);
    this.bossPlate = scene.add.graphics();
    this.bossText = scene.add.text(0, -1, 'SUPERMONSTER!', {
      resolution: getRenderDensity(), ...gameDisplayStyle('SUPERMONSTER!'),
      fontSize: '18px', color: '#fff1b2',
    }).setOrigin(.5).setStroke('#55122c', 3).setName('card-boss-value');
    this.boss.add([this.bossPlate, this.bossText]);
    this.root.add([this.combo, this.boss]);
    this.layout();
  }

  setPosition(x: number, y: number, width = this.placement.width): void {
    this.placement = { ...this.placement, x, y, width };
    this.root.setPosition(x, y);
    this.layout();
  }

  /** Call only when the chain changes. Counts below three also cancel a queued combo. */
  showCombo(count: number): void {
    this.latestCombo = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
    this.cancelCombo();
    if (this.latestCombo < 3) return;
    this.comboText.setText(`×${this.latestCombo}`);
    this.layout();
    if (!this.bossVisible) this.playCombo();
  }

  /** A spawn ID suppresses repeated warnings for the same boss until reset(). */
  showBoss(bossId?: string | number): void {
    if (bossId !== undefined) {
      if (this.seenBosses.has(bossId)) return;
      this.seenBosses.add(bossId);
    }
    if (!this.bossVisible && !this.combo.visible) this.latestCombo = 0;
    this.cancelCombo();
    this.bossTimer?.remove(false);
    this.scene.tweens.killTweensOf(this.boss);
    this.bossVisible = true;
    const reduced = isShakeReduced();
    this.boss.setVisible(true).setAlpha(0).setY(0).setScale(reduced ? 1 : .9);
    this.scene.tweens.add({ targets: this.boss, alpha: 1, scale: 1, duration: reduced ? 100 : 140, ease: 'Cubic.out' });
    this.bossTimer = this.scene.time.delayedCall(1280, () => {
      this.bossTimer = undefined;
      this.scene.tweens.add({ targets: this.boss, alpha: 0, duration: 280, ease: 'Sine.in', onComplete: () => {
        this.boss.setVisible(false);
        this.bossVisible = false;
        if (this.latestCombo >= 3) this.playCombo();
      } });
    });
  }

  reset(): void {
    this.latestCombo = 0;
    this.cancelCombo();
    this.bossTimer?.remove(false);
    this.bossTimer = undefined;
    this.scene.tweens.killTweensOf(this.boss);
    this.boss.setVisible(false).setAlpha(0).setScale(1).setY(0);
    this.bossVisible = false;
    this.seenBosses.clear();
  }

  destroy(): void {
    this.reset();
    this.root.destroy();
  }

  private cancelCombo(): void {
    this.comboTimer?.remove(false);
    this.comboTimer = undefined;
    this.scene.tweens.killTweensOf(this.combo);
    this.combo.setVisible(false).setAlpha(0).setScale(1).setY(0);
  }

  private playCombo(): void {
    const reduced = isShakeReduced();
    this.combo.setVisible(true).setAlpha(0).setY(0).setScale(reduced ? 1 : .76);
    this.scene.tweens.add({ targets: this.combo, alpha: 1, scale: 1,
      duration: reduced ? 90 : 150, ease: reduced ? 'Sine.out' : 'Back.out' });
    this.comboTimer = this.scene.time.delayedCall(650, () => {
      this.comboTimer = undefined;
      this.scene.tweens.add({ targets: this.combo, alpha: 0, y: reduced ? 0 : -6,
        duration: 260, ease: 'Sine.in', onComplete: () => {
          this.combo.setVisible(false);
          this.latestCombo = 0;
        } });
    });
  }

  private layout(): void {
    const available = Math.max(64, this.placement.width - 16);
    const comboSize = this.placement.desktop ? 62 : 46;
    this.comboText.setFontSize(comboSize);
    if (this.comboText.width > available - 20) this.comboText.setFontSize(comboSize * (available - 20) / this.comboText.width);
    const comboWidth = Math.min(available, Math.max(88, this.comboText.width + 32));
    this.comboPlate.clear().fillStyle(0x222940, .72)
      .fillRoundedRect(-comboWidth / 2, -18, comboWidth, 38, 18)
      .lineStyle(2, 0xffc94f, .65).lineBetween(-comboWidth / 2 + 16, 18, comboWidth / 2 - 16, 18);
    const bossSize = this.placement.desktop ? 24 : 18;
    this.bossText.setFontSize(bossSize);
    if (this.bossText.width > available - 28) this.bossText.setFontSize(bossSize * (available - 28) / this.bossText.width);
    const bossWidth = Math.min(available, this.bossText.width + 28), bossHeight = this.placement.desktop ? 44 : 36;
    this.bossPlate.clear().fillStyle(0x152533, .85)
      .fillRoundedRect(-bossWidth / 2, -bossHeight / 2 + 4, bossWidth, bossHeight, 12)
      .fillGradientStyle(0xef6649, 0xd53747, 0x95213a, 0x63182f, 1)
      .fillRoundedRect(-bossWidth / 2, -bossHeight / 2, bossWidth, bossHeight, 12)
      .lineStyle(2, 0xffd074, 1).strokeRoundedRect(-bossWidth / 2, -bossHeight / 2, bossWidth, bossHeight, 12)
      .lineStyle(1, 0xffefba, .65).lineBetween(-bossWidth / 2 + 12, -bossHeight / 2 + 4, bossWidth / 2 - 12, -bossHeight / 2 + 4);
  }
}
