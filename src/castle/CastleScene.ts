import { cardboardActor, type siegeActors } from './CardboardArt';
import Phaser from 'phaser';
import { viewport, configureViewport, getRenderDensity } from '../presentation/design/viewport';
import { getCastleLayoutMetrics } from '../presentation/design/tokens';
import { isDesktopViewport } from '../presentation/design/desktopLayout';
import { coverImage } from '../presentation/design/coverImage';
import { GameFeel, gildedPanel, siegeBackdrop } from '../presentation/design/GameFeel';
import { CardVisual } from '../presentation/design/CardVisual';
import { canConnectInBattle, getPowerType } from '../core/GameState';
import { AudioSystem } from '../presentation/audio/AudioSystem';
import { SettingsModal } from '../presentation/design/SettingsModal';
import { tapFeedback, playFeedback, comboFeedback, impactFeedback, successFeedback, errorFeedback, deployFeedback } from '../presentation/haptics/haptics';
import { fadeIn, confettiBurst, celebrationBurst } from '../presentation/juice/transitions';
import { gamePopup, popupButton } from '../presentation/design/GamePopup';
import { playCombatVFX } from '../presentation/design/CombatVFX';
import { isShakeReduced } from '../presentation/juice/fxSettings';
import { castleArt, castleMount, weaponArt } from './CastleArt';
import { attackReleaseDelay, createSiegeProjectile, siegeArtConfig } from './ExportedArt';
import { CastleManager, castleManager } from './CastleManager';
import { createTraining, trainingSteps, completeTraining } from './CastleTutorial';
import { MagicCore, preloadMagicCore } from './MagicCore';
import { actorDeathDuration } from './GeneratedActors';
import { enemyPortal } from './EnemyPortal';
import { enemyGroundPlacement } from './battlefieldGeometry';
import { castleAbilityButton } from './CastleAbilityButton';
import { showCastleRoundResult } from './CastleRoundResult';
import { showRunWorkshop } from './CastleWorkshop';
import { showPerkChoice, showCurrentPerks } from './CastlePerkChoice';
import { siegeButton } from '../presentation/design/SiegeButton';
import { CastleRewardCard } from './CastleRewardCard';
import { CastleCardAnnouncements } from './CastleCardAnnouncements';
import { gameConfig } from '../data/gameConfig';
import {
  STEP,
  soldierIsMarching,
  DEFENDER_STATS,
  CASTLE_ABILITIES,
  type CastleAbility,
  CASTLE_RECYCLE_HP_COST,
  upgradeValue,
  CHAIN_REWARD_ORDER,
  chainRewardCounts,
  type Invader,
  type Defender,
  type SiegeEvent,
} from './CastleDefense';

interface EnemyView {
  root: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Sprite;
  hp: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
}
interface UnitView {
  root: Phaser.GameObjects.Container;
  body?: Phaser.GameObjects.Sprite;
  label: Phaser.GameObjects.Text;
  weapon?: Phaser.GameObjects.Container;
  magazine?: Phaser.GameObjects.Graphics;
}

export class CastleScene extends Phaser.Scene {
  private layout!: ReturnType<typeof getCastleLayoutMetrics>;
  private cards = new Map<string, CardVisual>();
  private active: CardVisual | null = null;
  private stockPile!: Phaser.GameObjects.Container;
  private stockPileBacks: Phaser.GameObjects.Container[] = [];
  private stockHalo!: Phaser.GameObjects.Graphics;
  private stockPlaceholder!: Phaser.GameObjects.Graphics;
  private recyclePrice!: Phaser.GameObjects.Container;
  private stockHintPulse?: Phaser.Tweens.Tween;
  private undoButton!: Phaser.GameObjects.Container;
  private manager!: CastleManager;
  private training?: ReturnType<typeof createTraining>;
  private lesson = 0;
  private demoTime = 0;
  private lessonUI?: Phaser.GameObjects.Container;
  private tutorialFinish: 'start' | 'resume' | 'menu' = 'menu';
  private nextFootstep = 0;
  private nextVoice = 0;
  private invaders = new Map<number, EnemyView>();
  private damageLabels = new Map<number, { amount: number; until: number; text: Phaser.GameObjects.Text }>();
  private defenders = new Map<number, UnitView>();
  private castle!: Phaser.GameObjects.Container;
  private core!: MagicCore;
  private jokerLabels: Phaser.GameObjects.Text[] = [];
  private timerText!: Phaser.GameObjects.Text;
  private armorText!: Phaser.GameObjects.Text;
  private armorBar = { x: 0, y: 0, width: 0, height: 14 };
  private abilityButtons = new Map<CastleAbility, Phaser.GameObjects.Container>();
  private coinFlights = 0;
  private hp!: Phaser.GameObjects.Graphics;
  private hpBar = { x: 0, y: 0, width: 0, height: 18 };
  private hpText!: Phaser.GameObjects.Text;
  private coins!: Phaser.GameObjects.Text;
  private perkBar?: Phaser.GameObjects.Container;
  private chainText!: Phaser.GameObjects.Text;
  private status!: Phaser.GameObjects.Text;
  private steps: CastleRewardCard[] = [];
  private settings!: SettingsModal;
  private paused = false;
  private locked = false;
  private ended = false;
  private accumulator = 0;
  private saveTimer = 0;
  private nextHealEffect = 0;
  private feel!: GameFeel;
  private lastChain = 0;
  private dangerShown = false;
  private lastGold = 0;
  private calloutUI?: Phaser.GameObjects.Container;
  private announcements?: CastleCardAnnouncements;
  constructor() {
    super('CastleScene');
  }
  preload(): void {
    preloadMagicCore(this);
  }
  create(data: { tutorial?: boolean; finish?: 'start' | 'resume' | 'menu' } = {}): void {
    configureViewport(this);
    if (data.tutorial) {
      if (!this.training) {
        this.training = createTraining();
        this.lesson = 0;
      }
      this.tutorialFinish = data.finish ?? 'menu';
      this.manager = this.training.manager;
    } else {
      this.training = undefined;
      this.manager = castleManager();
    }
    const manager = this.manager;
    if (!manager.state && !manager.resume()) manager.start();
    this.cards = new Map();
    this.invaders = new Map();
    this.damageLabels = new Map();
    this.defenders = new Map();
    this.steps = [];
    this.accumulator = 0;
    this.saveTimer = 0;
    this.paused = false;
    this.locked = false;
    this.ended = false;
    this.active = null;
    this.stockPileBacks = [];
    this.stockHintPulse = undefined;
    this.nextFootstep = 0;
    this.nextVoice = 0;
    this.nextHealEffect = 0;
    this.calloutUI = undefined;
    this.lastChain = 0;
    this.dangerShown = false;
    this.lastGold = manager.state!.siege.coins + manager.state!.run.player.gold;
    this.feel = new GameFeel(this);
    const { width: w, height: h } = viewport(this);
    const tableauRows = Math.max(4, ...manager.state!.run.battle!.tableau.map(column => column.cards.length));
    this.layout = getCastleLayoutMetrics(w, h, undefined, tableauRows);
    const { arenaTop, arenaHeight, tableTop, hudTop } = this.layout;
    coverImage(this, 'ae-background', 0, arenaTop, w, arenaHeight);
    this.feel.motes(0, arenaTop + arenaHeight * 0.35, w, arenaHeight * 0.6, this.layout.desktop ? 12 : 7);
    this.cameras.main.setBackgroundColor('#142638');
    siegeBackdrop(this, w, h);
    this.add.graphics().lineStyle(1, 0xe9c987, .65).lineBetween(0, tableTop, w, tableTop);
    if (this.layout.desktop) {
      gildedPanel(this, this.layout.controlsX, this.layout.controlsTop, this.layout.controlsWidth, this.layout.controlsHeight);
    }
    const ground = this.groundY();
    this.castle = castleArt(this, w * 0.87, ground,
      Math.min(1.15, (arenaHeight - 20) / 158)).setDepth(22);
    this.coinFlights = 0;
    this.jokerLabels = [];
    if (!this.layout.desktop) {
      const bounds = this.castle.getBounds();
      this.castle.setScale(this.castle.scaleX * Math.min(1, w * 0.46 / bounds.width));
    }
    this.castle.x -= Math.max(0, this.castle.getBounds().right - (w - 8));
    const coreSize = Math.max(46, Math.min(116, arenaHeight * 0.35));
    this.core = new MagicCore(this, this.castle.x,
      this.castle.getBounds().top + coreSize * 0.2, coreSize);
    const desktop = this.layout.desktop;
    const hudWidth = Math.min(780, w - 16), hudX = (w - hudWidth) / 2;
    gildedPanel(this, hudX, hudTop, hudWidth, 32, true).setName('siege-hud');
    this.text(desktop ? hudX + 65 : hudX + 51, hudTop + 15,
      'ROUND ' + manager.state!.siegeNumber, desktop ? 17 : 12);
    this.timerText = this.text(desktop ? hudX + 148 : hudX + 122, hudTop + 15, '00:00', 13, '#a2cbdc');
    const coinX = desktop ? hudX + 603 : w - 95;
    this.add.image(coinX, hudTop + 15, 'coin').setDisplaySize(18, 18);
    this.coins = this.text(coinX + 27, hudTop + 15, '0', 16, '#ffe39c');
    const perkBarX = desktop ? hudX + 260 : hudX + 180;
    const perkBarWidth = desktop ? 300 : coinX - perkBarX - 30;
    if (manager.state!.perks?.length) {
      this.perkBar = showCurrentPerks(this, manager.state!.perks, perkBarX + perkBarWidth / 2, hudTop + 15, perkBarWidth);
    }
    const pause = siegeButton(this, null, desktop ? hudX + 751 : w - 30,
      hudTop + 15, 30, 28, '', () => {
        if (this.ended || this.locked || this.training) return;
        this.paused = true; manager.save(); AudioSystem.setMusicScene('menu'); this.settings.show();
      }, 'pause').setName('pause-button');
    pause.setVisible(!this.training);
    this.text(this.layout.comboX, this.layout.comboY, 'COMBO', 15, '#b9d0dc')
      .setOrigin(0, .5).setName('combo-label');
    this.chainText = this.text(this.layout.comboValueX, this.layout.comboY, '×0', 25, '#ffe09a')
      .setOrigin(1, .5).setStroke('#3f244f', 2).setDepth(150).setName('combo-value');
    this.announcements = new CastleCardAnnouncements(this, {
      x: this.layout.boardX + this.layout.boardWidth / 2,
      y: this.layout.tableauTop - (desktop ? 40 : 32),
      width: this.layout.boardWidth,
      desktop,
    });
    this.jokerLabels = [];
    this.abilityButtons.clear();
    const abilityWidth = (this.layout.rewardWidth - 16) / 3;
    (Object.keys(CASTLE_ABILITIES) as CastleAbility[]).forEach((ability, i) => {
      const button = castleAbilityButton(this, null, this.layout.rewardX + (i + .5) * (this.layout.rewardWidth / 3),
        this.layout.jokerY, abilityWidth, 40, ability, () => {
          if (this.paused || this.locked || this.ended || this.training) return;
          const before = manager.state, result = manager.useAbility(ability);
          if (!result || result.state === before) { AudioSystem.play('invalid_tap'); return; }
          this.handleEvents(result.events); this.renderCards(); this.refreshHUD(); this.syncActors();
        }).setName('ability-' + ability.toLowerCase()).setVisible(!this.training);
      this.abilityButtons.set(ability, button);
    });
    this.hp = this.add.graphics().setName('castle-vitals');
    this.hpBar = { x: this.layout.barsX, y: this.layout.barsY,
      width: this.layout.barsWidth, height: 18 };
    this.armorBar = { ...this.hpBar, y: this.layout.barsY + 24, height: 12 };
    this.hpText = this.text(this.hpBar.x + this.hpBar.width / 2, this.hpBar.y + 9, '', 13);
    this.armorText = this.text(this.armorBar.x + this.armorBar.width / 2, this.armorBar.y + 6, '', 10, '#def2ff');
    this.text(this.hpBar.x - 20, this.hpBar.y + 9, '♥', 23, '#ff6b89');
    const shield = this.add.graphics().fillStyle(0x73bbf5);
    const sx = this.armorBar.x - 20, sy = this.armorBar.y + 6;
    shield.fillPoints([{x:sx-7,y:sy-6},{x:sx+7,y:sy-6},{x:sx+6,y:sy+2},{x:sx,y:sy+8},{x:sx-6,y:sy+2}], true);
    this.status = this.text(0, 0, '', 1).setVisible(false);
    CHAIN_REWARD_ORDER.forEach((_kind, i) => {
      this.steps.push(new CastleRewardCard(this, i,
        this.layout.rewardX + (i + .5) * this.layout.rewardWidth / 5, this.layout.rewardY,
        this.layout.rewardWidth / 5, 40, true, () => this.rewardInfo(i)));
    });
    this.stockPile = this.add.container(this.layout.stockPileX, this.layout.stockPileY)
      .setDepth(78).setName('stock-pile').setData('role', 'draw');
    const pileWidth = this.layout.cw * this.layout.stockPileScale, pileHeight = this.layout.ch * this.layout.stockPileScale;
    this.stockHalo = this.add.graphics().setName('stock-hint').setAlpha(0);
    this.stockHalo.fillStyle(0xffd76c, .12).fillRoundedRect(-6, -6, pileWidth + 16, pileHeight + 16, 9);
    this.stockHalo.lineStyle(2, 0xffdc77, .75).strokeRoundedRect(-4, -4, pileWidth + 12, pileHeight + 12, 8);
    this.stockPlaceholder = this.add.graphics().setName('empty-stock')
      .fillStyle(0x152a40, .85).fillRoundedRect(0, 0, pileWidth, pileHeight, 7)
      .lineStyle(1.2, 0x96afc3, .5).strokeRoundedRect(0, 0, pileWidth, pileHeight, 7);
    const centerX = pileWidth / 2, centerY = pileHeight * .37;
    const radius = Math.min(16, pileWidth * .22);
    this.stockPlaceholder.lineStyle(2.5, 0xe7cf95).beginPath()
      .arc(centerX, centerY, radius, -.8, 4.15).strokePath();
    this.stockPlaceholder.fillStyle(0xe7cf95).fillTriangle(centerX-radius-2, centerY-radius-2,
      centerX-radius-2, centerY, centerX-2, centerY-radius);
    this.recyclePrice = this.add.container(centerX - 5, pileHeight * .69)
      .setVisible(false).setName('stock-recycle-price').setData('cost', CASTLE_RECYCLE_HP_COST);
    const priceHeart = this.add.graphics().fillStyle(0xf35d81);
    priceHeart.fillCircle(-4, -3, 4).fillCircle(2, -3, 4).fillTriangle(-8, -2, 6, -2, -1, 7);
    this.recyclePrice.add([priceHeart, this.text(12, -1, String(CASTLE_RECYCLE_HP_COST), 14)]);
    this.stockPile.add([this.stockHalo, this.stockPlaceholder, this.recyclePrice]);
    for (let layer = 2; layer >= 0; layer--) {
      const back = this.makeStockBack(layer * 2, layer * 2).setScale(this.layout.stockPileScale)
        .setData('layer', layer);
      this.stockPile.add(back); this.stockPileBacks.push(back);
    }
    const hitWidth = pileWidth + 4, hitHeight = pileHeight + 4;
    // Phaser adds the container's half-size origin before testing the hit area.
    // The artwork starts at local (0, 0), so shift the area by that same origin.
    this.stockPile.setSize(hitWidth, hitHeight)
      .setInteractive(new Phaser.Geom.Rectangle(hitWidth / 2, hitHeight / 2, hitWidth, hitHeight), Phaser.Geom.Rectangle.Contains);
    if (this.stockPile.input) this.stockPile.input.cursor = 'pointer';
    this.stockPile.on('pointerup', () => this.drawFromStock());
    const undoRoot = this.add.container(this.layout.undoX, this.layout.undoY).setDepth(90);
    this.undoButton = siegeButton(this, undoRoot, 0, 0, this.layout.undoWidth, this.layout.undoHeight, '', () => {
      if (this.paused || this.locked || this.ended || !this.allowTraining('undo')) return;
      const result = manager.undo();
      if (!result.success) { AudioSystem.play('invalid_tap'); return; }
      AudioSystem.play('card_draw'); this.accumulator = 0;
      if (result.damage > 0) {
        this.showUndoDamage(result.damage);
      }
      this.renderCards(); this.syncActors(); this.refreshHUD(); this.advanceTraining();
    }, 'undo').setName('undo-button');
    this.settings = new SettingsModal(this, {
      onResume: () => {
        this.paused = false;
        AudioSystem.setMusicScene('battle');
      },
      onRestart: () => {
        this.bankAbandoned();
        manager.start();
        this.scene.restart({ tutorial: false });
      },
      onMainMenu: () => {
        manager.save();
        this.scene.start('StartScene');
      },
    });
    this.renderCards();
    this.syncActors();
    this.refreshHUD();
    AudioSystem.setMusicScene('battle');
    fadeIn(this, { duration: 400 });
    if (manager.state!.run.phase !== 'battle') this.endPopup();
    const skipTraining = () => this.finishTraining();
    if (this.training) {
      this.showTraining();
      this.input.keyboard?.on('keydown-ESC', skipTraining);
    }
    const visibility = () => {
      this.accumulator = 0;
      manager.save();
      if (document.hidden) {
        AudioSystem.stopSound('turret_shot');
        AudioSystem.setMusicScene('menu');
      }
      else if (!this.paused && !this.ended) AudioSystem.setMusicScene('battle');
    };
    const resize = () => {
      manager.save();
      this.scene.restart({ tutorial: !!this.training, finish: this.tutorialFinish });
    };
    const pagehide = () => manager.save();
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', pagehide);
    this.scale.on('resize', resize);
    this.events.once('shutdown', () => {
      AudioSystem.stopSound('turret_shot');
      this.announcements?.destroy();
      this.announcements = undefined;
      manager.save();
      this.settings.destroy();
      this.cards.clear();
      this.invaders.clear();
      this.damageLabels.clear();
      this.defenders.clear();
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pagehide', pagehide);
      this.scale.off('resize', resize);
      this.input.keyboard?.off('keydown-ESC', skipTraining);
    });
  }
  update(_time: number, delta: number): void {
    if (this.paused || this.ended || document.hidden) {
      AudioSystem.stopSound('turret_shot');
      this.accumulator = 0;
      return;
    }
    if (this.training) {
      if (this.lesson !== 6) {
        this.accumulator = 0;
        return;
      }
      this.demoTime += Math.min(delta / 1000, 0.1);
      if (this.demoTime >= 4) {
        this.advanceTraining();
        this.accumulator = 0;
        return;
      }
    }
    // A delayed frame never fast-forwards an inactive siege.
    this.accumulator += Math.min(delta / 1000, 0.5);
    this.saveTimer += delta / 1000;
    while (this.accumulator >= STEP) {
      this.accumulator -= STEP;
      const result = this.manager.step();
      if (!result) break;
      this.handleEvents(result.events);
      this.syncActors();
      this.refreshHUD();
      if (this.ended) break;
    }
    if (this.saveTimer >= 2) {
      this.manager.save();
      this.saveTimer = 0;
    }
    if (
      this.time.now >= this.nextFootstep &&
      (this.manager.state!.siege.enemies.some((e) => e.progress < 0.94) ||
        this.manager.state!.siege.units.some((unit) => soldierIsMarching(unit, this.manager.state!.siege.enemies)))
    ) {
      AudioSystem.play(Math.random() > 0.5 ? 'footstep_1' : 'footstep_2', {
        volume: 0.18,
        pitchShift: Math.random() * 0.1,
      });
      this.nextFootstep = this.time.now + 430;
    }
    for (const unit of this.manager.state?.siege.units ?? []) {
      const view = this.defenders.get(unit.id);
      if (!view) continue;
      if (view.body && unit.kind === 'soldier') {
        const walking = view.root.getData('leavingGate') === true ||
          soldierIsMarching(unit, this.manager.state!.siege.enemies);
        this.soldierAnimation(view.body, walking);
      }
      if (view.root.getData('leavingGate') === true) continue;
      const target = this.unitPosition(unit);
      view.root.x += (target.x - view.root.x) * Math.min(1, delta / 90);
      view.root.y = target.y;
    }
    for (const enemy of this.manager.state?.siege.enemies ?? []) {
      const view = this.invaders.get(enemy.id);
      if (!view) continue;
      if (enemy.progress < 0.94) this.walkAnimation(view.body, enemy.sprite);
      const target = this.enemyPosition(enemy);
      view.root.x += (target.x - view.root.x) * Math.min(1, delta / 90);
      view.root.y = target.y;
    }
  }
  private text(x: number, y: number, text: string, size: number, color = '#fff8e5') {
    return this.add
      .text(x, y, text, {
        resolution: getRenderDensity(),
        fontFamily: 'Lilita One',
        fontSize: `${size}px`,
        color,
        align: 'center',
      })
      .setOrigin(0.5);
  }
  private groundY() {
    return this.layout.arenaTop + this.layout.arenaHeight - 14;
  }
  private castleEmotionY() {
    return Math.max(this.layout.arenaTop + 22, this.castle.getBounds().top - 14);
  }
  private enemyPosition(enemy: Invader) {
    const vp = viewport(this);
    const narrow = !isDesktopViewport(vp.width, vp.height);
    const leftOffset = narrow ? -vp.width * 0.12 : 0;
    return {
      x: leftOffset + enemy.progress * vp.width * 0.78,
      y: enemyGroundPlacement(enemy.id, this.layout.arenaTop, this.layout.arenaHeight).y,
    };
  }
  private walkAnimation(body: Phaser.GameObjects.Sprite, sprite: string): void {
    const key = body.anims.currentAnim?.key ?? '';
    if (body.anims.isPlaying && (key.endsWith('-attack') || key.endsWith('-hurt'))) return;
    body.play(`${sprite}-walk`, true);
    body.setAngle(0);
  }
  private soldierAnimation(body: Phaser.GameObjects.Sprite, walking: boolean): void {
    const key = body.anims.currentAnim?.key ?? '';
    if (body.anims.isPlaying && (key.endsWith('-attack') || key.endsWith('-hurt'))) return;
    body.play(walking ? 'c_angel1-walk' : 'c_angel1-idle', true).setAngle(0);
  }
  /** The back is clipped in its own canvas, so the stock has no out-of-card hatch lines. */
  private makeStockBack(x: number, y: number): Phaser.GameObjects.Container {
    const { cw, ch } = this.layout;
    const key = `siege-stock-back-${Math.round(cw * 100)}-${Math.round(ch * 100)}`;
    if (!this.textures.exists(key)) {
      const texture = this.textures.createCanvas(key, Math.ceil(cw * 2), Math.ceil(ch * 2))!;
      const ctx = texture.context;
      ctx.scale(2, 2); ctx.beginPath(); ctx.roundRect(1, 1, cw - 2, ch - 2, 7); ctx.clip();
      const gradient = ctx.createLinearGradient(0, 0, cw, ch);
      gradient.addColorStop(0, '#575781'); gradient.addColorStop(.5, '#302a57'); gradient.addColorStop(1, '#171e38');
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, cw, ch);
      ctx.strokeStyle = '#ffe7ae18'; ctx.lineWidth = .7;
      for (let line = -ch; line < cw + ch; line += 10) {
        ctx.beginPath(); ctx.moveTo(line, 0); ctx.lineTo(line + ch, ch); ctx.stroke();
      }
      ctx.strokeStyle = '#e5c47a'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.roundRect(4, 4, cw - 8, ch - 8, 4); ctx.stroke();
      ctx.fillStyle = '#e5c47a'; ctx.beginPath();
      ctx.moveTo(cw / 2, ch / 2 - cw * .19); ctx.lineTo(cw / 2 + cw * .19, ch / 2);
      ctx.lineTo(cw / 2, ch / 2 + cw * .19); ctx.lineTo(cw / 2 - cw * .19, ch / 2); ctx.closePath(); ctx.fill();
      texture.refresh();
    }
    return this.add.container(x, y, [this.add.image(0, 0, key).setOrigin(0).setDisplaySize(cw, ch)]).setSize(cw, ch);
  }
  private drawFromStock(): void {
    if (this.paused || this.locked || this.ended || !this.allowTraining('draw')) return;
    AudioSystem.unlock();
    tapFeedback();
    const before = this.manager.state, oldActive = before!.run.battle!.activeCard?.id;
    const result = this.manager.draw();
    if (!result || result.state === before || !result.events.some(event => event.type === 'draw')) return;
    const finish = () => {
      this.renderCards(); this.refreshHUD(); this.handleEvents(result.events); this.syncActors();
      if (!this.ended && this.active?.getCard().id !== oldActive) this.animateStockDraw(() => this.advanceTraining());
      else this.advanceTraining();
    };
    if (result.events.some(event => event.type === 'draw' && event.recycled)) this.animateReshuffle(finish);
    else finish();
  }
  private animateStockDraw(done: () => void): void {
    const visual = this.active;
    if (!visual) { done(); return; }
    const root = visual.getContainer(), to = this.activePosition();
    const from = { x: this.layout.stockPileX, y: this.layout.stockPileY }, motion = { t: 0 };
    const scale = this.layout.stockPileScale, reduced = isShakeReduced();
    const arcHeight = Math.min(16, Math.max(0, from.y - (this.armorBar.y + this.armorBar.height) - 3));
    this.locked = true;
    root.setPosition(from.x, from.y).setScale(scale).setDepth(300).setName('stock-draw-flight')
      .setData('from', from).setData('to', to);
    this.tweens.add({ targets: motion, t: 1, duration: reduced ? 100 : this.layout.desktop ? 270 : 210,
      ease: 'Sine.inOut', onUpdate: () => {
        const lift = reduced ? 0 : Math.sin(motion.t * Math.PI);
        root.setPosition(from.x + (to.x - from.x) * motion.t,
          from.y + (to.y - from.y) * motion.t - lift * arcHeight)
          .setScale(scale + (1 - scale) * motion.t).setAngle(lift * 4);
      }, onComplete: () => {
        if (root.active) root.setPosition(to.x, to.y).setScale(1).setAngle(0).setDepth(80).setName('active-card');
        this.locked = false; done();
      } });
  }
  private animateReshuffle(done: () => void): void {
    this.locked = true;
    this.paused = true;
    this.accumulator = 0;
    AudioSystem.play('card_shuffle', { volume: 0.85 });
    this.stockPileBacks.forEach(back => back.setVisible(false));
    const p = this.activePosition(),
      cards: Phaser.GameObjects.Container[] = [];
    const reduced = isShakeReduced(), count = reduced ? 3 : 7;
    const to = { x: this.layout.stockPileX, y: this.layout.stockPileY };
    for (let i = 0; i < count; i++) {
      const back = this.makeStockBack(p.x, p.y).setDepth(300 + i).setScale(.75)
        .setName('stock-recycle-flight').setData('from', { ...p }).setData('to', { ...to });
      cards.push(back);
      this.tweens.add({
        targets: back,
        x: to.x + (reduced ? 0 : (i - 3) * 3),
        y: to.y + (reduced ? 0 : i % 2 ? 3 : -3),
        scale: this.layout.stockPileScale,
        angle: reduced ? 0 : (i - 3) * 3,
        delay: reduced ? i * 20 : i * 35,
        duration: reduced ? 110 : 260,
        ease: 'Cubic.inOut',
        onComplete: () => {
          this.tweens.add({
            targets: back,
            x: to.x,
            y: to.y,
            angle: 0,
            duration: reduced ? 60 : 130,
          });
        },
      });
    }
    this.time.delayedCall(reduced ? 230 : 620, () => {
      cards.forEach((c) => c.destroy());
      this.locked = false;
      this.paused = false;
      done();
    });
  }
  private activePosition() {
    return { x: this.layout.activeX, y: this.layout.activeY };
  }
  /** Pivots are separate from world simulation coordinates so replacement art retains mounts. */
  private castleAnchor(kind: 'gate' | 'archer' | 'turret' | 'mortar') {
    if (this.textures.exists('ae-castle')) return castleMount(this.castle, kind);
    const bounds = this.castle.getBounds();
    const points = { gate: [0, -0.07], archer: [0, -0.58], turret: [-0.3, -0.86], mortar: [0.3, -0.85] };
    const [x, y] = points[kind];
    return { x: this.castle.x + x * bounds.width, y: this.castle.y + y * bounds.height };
  }
  private unitPosition(unit: Defender) {
    if (unit.kind !== 'soldier') {
      const p = this.castleAnchor(unit.kind);
      if (unit.kind === 'archer') p.x += ((unit.id % 3) - 1) * 12 * this.castle.scaleX;
      return p;
    }
    return { x: unit.progress * viewport(this).width * 0.78 + ((unit.id % 3) - 1) * 4,
      y: this.groundY() - (unit.id % 2) * 9 };
  }
  private renderCards(): void {
    const battle = this.manager.state!.run.battle!;
    const next = new Set<string>(),
      { side, cw, ch, gap, tableauTop, strip } = this.layout;
    const isInitialDeal = this.cards.size === 0;
    const reduced = isShakeReduced();
    let newCardIndex = 0;
    
    battle.tableau.forEach((column, col) =>
      column.cards.forEach((card, row) => {
        next.add(card.id);
        let visual = this.cards.get(card.id);
        const power = getPowerType(
          battle.powerCards.filter((p) => !this.manager.state!.usedPowers?.includes(p.cardId)),
          card.id
        );
        if (visual && visual.getPowerType() !== power) {
          visual.destroy();
          this.cards.delete(card.id);
          visual = undefined;
        }
        const x = side + col * (cw + gap),
          y = tableauTop + row * strip;
        if (!visual) {
          visual = new CardVisual(
            this,
            x,
            y,
            card,
            power
          );
          this.cards.set(card.id, visual);
          visual.setInteractive(() => this.play(card.id));
          
          // Animate card deal for initial layout
          if (isInitialDeal && !this.training) {
            const container = visual.getContainer();
            const delay = reduced ? newCardIndex * 15 : newCardIndex * 35;
            const startY = -ch - 20;
            container.setY(startY).setAlpha(0).setAngle(reduced ? 0 : -5 + Math.random() * 10);
            this.tweens.add({
              targets: container,
              y,
              alpha: 1,
              angle: 0,
              delay,
              duration: reduced ? 120 : 280,
              ease: 'Back.out',
            });
            newCardIndex++;
          }
        }
        visual.setPosition(x, y);
        visual.setDepth(60 + row);
        const exposed = row === column.cards.length - 1;
        visual.setState(
          !exposed
            ? 'covered'
            : battle.activeCard && canConnectInBattle(card, battle)
              ? 'playable'
              : 'normal'
        );
      })
    );
    for (const [id, visual] of this.cards)
      if (!next.has(id)) {
        visual.destroy();
        this.cards.delete(id);
      }
    if (this.active?.getCard().id !== battle.activeCard?.id ||
      this.active?.getPowerType() !== (battle.activeCard ? getPowerType(battle.powerCards, battle.activeCard.id) : null)) {
      this.active?.destroy();
      this.active = null;
      if (battle.activeCard) {
        const p = this.activePosition();
        this.active = new CardVisual(
          this,
          p.x,
          p.y,
          battle.activeCard,
          getPowerType(battle.powerCards, battle.activeCard.id)
        );
        this.active.setDepth(80);
        this.active.setState('active');
      }
    }
  }
  private play(id: string): void {
    if (this.paused || this.locked || this.ended) return;
    if (!this.allowTraining('card', id)) return;
    AudioSystem.unlock();
    const manager = this.manager,
      before = manager.state;
    const result = manager.play(id);
    if (!result || result.state === before) {
      AudioSystem.play('invalid_tap', { volume: 0.45 });
      errorFeedback();
      const container = this.cards.get(id)?.getContainer();
      if (container) {
        const x = container.x;
        this.tweens.add({
          targets: container,
          x: x + 4,
          duration: 40,
          yoyo: true,
          repeat: 2,
          onComplete: () => container.setX(x),
        });
      }
      return;
    }
    playFeedback();
    const visual = this.cards.get(id);
    this.cards.delete(id);
    if (visual) {
      visual.disableInteractive();
      visual.setDepth(250);
      const p = this.activePosition();
      const root = visual.getContainer(), from = { x: root.x, y: root.y }, flight = { t: 0 };
      this.feel.burst(root.x + this.layout.cw / 2, root.y + this.layout.ch / 2, 0xffe5a4, 4);
      this.tweens.add({
        targets: flight, t: 1,
        onUpdate: () => {
          const lift = Math.sin(flight.t * Math.PI);
          root.setPosition(from.x + (p.x - from.x) * flight.t,
            from.y + (p.y - from.y) * flight.t - lift * Math.min(65, Math.abs(p.x - from.x) * 0.06 + 24));
          root.setAngle(lift * 5).setScale(1 + lift * 0.07);
        },
        duration: this.layout.desktop ? 280 : 210,
        ease: 'Sine.inOut',
        onComplete: () => visual.destroy(),
      });
    }
    this.locked = true;
    this.time.delayedCall(120, () => {
      this.locked = false;
    });
    this.renderCards();
    this.handleEvents(result.events);
    this.syncActors();
    this.refreshHUD();
    this.advanceTraining();
  }
  private trainingAction(): { action: string; id?: string } {
    const ids = this.training!.ids;
    const cards: Record<number, string> = {
      0: ids[0],
      1: ids[1],
      3: ids[1],
      4: ids[2],
      7: ids[7],
      8: ids[3],
      9: ids[4],
      10: ids[5],
      11: ids[6],
    };
    return this.lesson === 2
      ? { action: 'undo' }
      : [5, 12].includes(this.lesson)
        ? { action: 'draw' }
        : { action: 'card', id: cards[this.lesson] };
  }
  private allowTraining(action: string, id?: string): boolean {
    if (!this.training) return true;
    const expected = this.trainingAction();
    const allowed = expected.action === action && (action !== 'card' || expected.id === id);
    if (!allowed) AudioSystem.play('invalid_tap', { volume: 0.3 });
    return allowed;
  }
  private advanceTraining(): void {
    if (!this.training) return;
    this.lesson++;
    if (this.lesson === 6) {
      this.demoTime = 0;
      const siege = this.manager.state!.siege;
      siege.enemies.push(
        ...Array.from({ length: 3 }, (_, i) => ({
          id: siege.nextId++,
          sprite: 'c_orc',
          boss: false,
          hp: 12,
          maxHp: 12,
          progress: 0.35 + i * 0.1,
          speed: 0.02,
          damage: 1,
          cooldown: 0,
        }))
      );
      this.syncActors();
    }
    this.showTraining();
  }
  private finishTraining(): void {
    if (!this.training || this.locked) return;
    this.locked = true;
    completeTraining();
    // Phaser retains previous scene data when start/restart receives no data.
    // Clear it immediately so a queued resize or later menu launch cannot revive training.
    this.sys.settings.data = { tutorial: false };
    this.lessonUI?.destroy();
    this.training = undefined;
    if (this.tutorialFinish === 'menu') {
      this.scene.start('StartScene');
      return;
    }
    const manager = castleManager();
    if (this.tutorialFinish === 'resume') manager.resume();
    else manager.start();
    this.scene.restart({ tutorial: false });
  }
  private showTraining(): void {
    this.lessonUI?.destroy();
    const { width: w } = viewport(this);
    const root = this.add.container(0, 0).setDepth(2000);
    this.lessonUI = root;
    const y = this.layout.arenaTop + 4;
    const lessonWidth = Math.min(w - 16, 640), lessonX = (w - lessonWidth) / 2;
    const [title, body] = trainingSteps[this.lesson];
    const lessonBody = this.add.text(lessonX + 12, y + 36, body, {
      resolution: getRenderDensity(), fontFamily: 'Fredoka, Rubik, sans-serif', fontSize: '14px', color: '#ffffff',
      wordWrap: { width: lessonWidth - 24 },
    });
    const panelHeight = Math.max(98, lessonBody.height + 48);
    root.add(this.add.rectangle(w / 2, y + panelHeight / 2, lessonWidth, panelHeight, 0x18323d, 0.96)
      .setStrokeStyle(2, 0xffdc63));
    root.add(
      this.text(
        w / 2,
        y + 17,
        `${this.lesson + 1}/${trainingSteps.length} · ${title}`,
        17,
        '#ffe35a'
      )
    );
    root.add(lessonBody);
    const skipY = this.layout.relicTop + 14;
    const skip = this.add.rectangle(w / 2, skipY, Math.min(w - 32, 260), 30, 0x875d2c)
      .setStrokeStyle(1.5, 0xe7c87b)
      .setInteractive({ useHandCursor: true });
    skip.on('pointerover', () => skip.setFillStyle(0xa17638));
    skip.on('pointerout', () => skip.setFillStyle(0x875d2c));
    skip.on('pointerdown', () => skip.setFillStyle(0x684524));
    skip.on('pointerup', () => this.finishTraining());
    const skipLabel = this.add.text(w / 2, skipY,
      this.layout.desktop ? 'ПРОПУСТИТЬ ДЕМО  ·  Esc' : 'ПРОПУСТИТЬ ДЕМО', {
        resolution: getRenderDensity(), fontFamily: 'Rubik', fontSize: '12px',
        fontStyle: 'bold', color: '#fff3ca',
      }).setOrigin(0.5);
    root.add([skip, skipLabel]);
    const expected = this.trainingAction();
    const target = expected.id ? this.cards.get(expected.id)?.getContainer() : undefined;
    let rect: Phaser.Geom.Rectangle | undefined;
    if (target)
      rect = new Phaser.Geom.Rectangle(
        target.x - 3,
        target.y - 3,
        this.layout.cw + 6,
        this.layout.ch + 6
      );
    if (expected.action === 'draw')
      rect = new Phaser.Geom.Rectangle(
        this.layout.stockPileX - 3,
        this.layout.stockPileY - 3,
        this.layout.cw + 10,
        this.layout.ch + 10
      );
    if (expected.action === 'undo')
      rect = new Phaser.Geom.Rectangle(
        this.layout.undoX - this.layout.undoWidth / 2 - 4,
        this.layout.undoY - this.layout.undoHeight / 2 - 4,
        this.layout.undoWidth + 8,
        this.layout.undoHeight + 8
      );
    if (rect) {
      const glow = this.add
        .graphics()
        .lineStyle(4, 0xffe35a)
        .strokeRoundedRect(rect.x, rect.y, rect.width, rect.height, 8);
      root.add(glow);
      this.tweens.add({ targets: glow, alpha: 0.35, duration: 500, yoyo: true, repeat: -1 });
    }
    if (this.lesson === 13) {
      const buttons = this.add.container(w / 2, y + panelHeight + 29);
      root.add(buttons);
      popupButton(
        this,
        buttons,
        0,
        Math.min(w - 48, 420),
        this.tutorialFinish === 'menu' ? 'BACK TO MENU' : 'START SIEGE',
        () => this.finishTraining()
      );
    }
  }
  private refreshHUD(): void {
    const state = this.manager.state!,
      player = state.run.player,
      chain = state.run.battle!.chain.length;
    const { x, y, width, height } = this.hpBar;
    this.hp
      .clear()
      .fillStyle(0x3b153d)
      .fillRoundedRect(x, y, width, height, height / 2);
    if (player.hp > 0) this.hp
      .fillStyle(player.hp / player.maxHp < 0.3 ? 0xff4f61 : 0xec4667)
      .fillRoundedRect(x + 2, y + 2, Math.max(0, ((width - 4) * player.hp) / player.maxHp), height - 4, (height - 4) / 2);
    this.hp.setData('hpRatio', player.hp / player.maxHp).setData('armorRatio', Math.min(1, player.armor / player.maxHp));
    this.hpText.setText(`${Math.ceil(player.hp)} / ${player.maxHp}`);
    this.coins.setText(String(state.siege.coins));
    this.timerText.setText(Math.floor(state.siege.elapsed / 60).toString().padStart(2, '0') + ':' +
      Math.floor(state.siege.elapsed % 60).toString().padStart(2, '0'));
    this.core.setCharge(chain, true);
    this.hp.fillStyle(0x142b48).fillRoundedRect(this.armorBar.x, this.armorBar.y, this.armorBar.width, this.armorBar.height, 6);
    if (player.armor > 0) this.hp.fillStyle(0x4d9de9).fillRoundedRect(this.armorBar.x + 1, this.armorBar.y + 1,
      (this.armorBar.width - 2) * Math.min(1, player.armor / player.maxHp), this.armorBar.height - 2, 5);
    this.armorText.setText(String(player.armor));
    for (const [ability, button] of this.abilityButtons) {
      const used = (state.abilitiesUsed ?? []).includes(ability);
      button.setAlpha(used ? .28 : state.siege.coins < CASTLE_ABILITIES[ability].cost ? .5 : 1);
    }
    const gold = state.siege.coins + player.gold;
    if (gold > this.lastGold) {
      this.tweens.killTweensOf(this.coins);
      this.coins.setScale(1.12);
      this.tweens.add({ targets: this.coins, scale: 1, duration: 220, ease: 'Sine.out' });
    }
    this.lastGold = gold;
    this.status.setText(`ARMOR ${player.armor}${this.layout.desktop ? '   ·   ' : '\n'}ENEMIES ${state.siege.enemies.length}`);
    const danger = state.siege.enemies.some((e) => e.progress >= 0.72);
    if (danger && !this.dangerShown) this.feel.emotion(this.castle.x, this.castleEmotionY(), 'worried', 'castle-danger');
    this.dangerShown = danger;
    this.status.setColor(danger ? '#ff6b84' : '#bff5ff');
    this.chainText.setText(`×${chain}`);
    const rewards = chainRewardCounts(chain);
    this.steps.forEach((card, i) => {
      const count = rewards[CHAIN_REWARD_ORDER[i]];
      const unlocked = true;
      card.setState(unlocked, count);
    });
    if (chain > this.lastChain) {
      this.tweens.killTweensOf(this.chainText);
      this.chainText.setScale(isShakeReduced() ? 1 : 1.22);
      this.tweens.add({ targets: this.chainText, scale: 1, duration: 260, ease: 'Back.out' });
      const card = this.steps[(chain - 1) % CHAIN_REWARD_ORDER.length];
      this.feel.burst(card.root.x, card.root.y, 0xffd979, 6);
      card.pulse();
    }
    if (chain !== this.lastChain) this.announcements?.showCombo(chain);
    this.lastChain = chain;
    this.refreshStock();
    this.undoButton.setAlpha(this.manager.canUndo ? 1 : 0.5);
  }
  private refreshStock(): void {
    const battle = this.manager.state!.run.battle!, count = battle.deck.length;
    const noLegalMoves = !battle.tableau.some(column => {
      const card = column.cards.at(-1); return card && canConnectInBattle(card, battle);
    });
    const hint = !this.ended && noLegalMoves, empty = count === 0;
    this.stockPile.setData('cards', count).setData('noLegalMoves', noLegalMoves);
    this.stockPile.setData('action', empty ? 'shuffle' : 'draw');
    this.stockPileBacks.forEach(back => back.setVisible(count > back.getData('layer')));
    this.stockPlaceholder.setVisible(empty);
    this.recyclePrice.setVisible(empty);
    const available = !empty || battle.discard.length > 0;
    if (this.stockPile.input) {
      this.stockPile.input.enabled = available;
      this.stockPile.input.cursor = available ? 'pointer' : '';
    }
    this.stockPile.setAlpha(available ? 1 : .4);
    if (this.stockHintPulse && (!hint || isShakeReduced())) {
      this.stockHintPulse.stop(); this.stockHintPulse = undefined;
    }
    if (!hint) this.stockHalo.setAlpha(0);
    else if (!this.stockHintPulse) {
      this.stockHalo.setAlpha(1);
      if (!isShakeReduced()) this.stockHintPulse = this.tweens.add({
        targets: this.stockHalo, alpha: .45, duration: 650,
        yoyo: true, repeat: -1, ease: 'Sine.inOut',
      });
    }
  }
  private syncActors(): void {
    const state = this.manager.state!;
    const enemyIds = new Set(state.siege.enemies.map(e => e.id));
    for (const [id, view] of this.invaders) {
      if (!enemyIds.has(id)) {
        this.tweens.killTweensOf(view.root);
        view.root.destroy();
        this.invaders.delete(id);
      }
    }
    for (const enemy of state.siege.enemies) {
      let view = this.invaders.get(enemy.id);
      if (!view) {
        const p = this.enemyPosition(enemy),
          root = this.add.container(p.x, p.y).setDepth(enemyGroundPlacement(enemy.id, this.layout.arenaTop, this.layout.arenaHeight).depth);
        const size = Math.min(enemy.boss ? 92 : 58, this.layout.arenaHeight * 0.6) *
          enemyGroundPlacement(enemy.id, this.layout.arenaTop, this.layout.arenaHeight).scale;
        const body = cardboardActor(this, enemy.sprite as keyof typeof siegeActors, 0, 0, size);
        body.play(`${enemy.sprite}-idle`);
        const hp = this.add.graphics(),
          label = this.text(0, -size - 9, enemy.boss ? 'BOSS' : '', 10, '#ffe1a0');
        root.add([this.add.ellipse(0, -2, size * 0.55, 9, 0x17313a, 0.24), body, hp, label]);
        view = { root, body, hp, label };
        this.invaders.set(enemy.id, view);
        if (enemy.boss) this.feel.emotion(p.x, p.y - size - 22, 'angry', `enemy-${enemy.id}`);
      }
      const size = (view.body.getData('actorHeight') as number | undefined) ?? view.body.displayHeight,
        width = enemy.boss ? 46 : 28;
      const showHealth = enemy.boss || enemy.hp < enemy.maxHp;
      view.hp.setVisible(showHealth);
      if (showHealth) {
        view.hp.clear().fillStyle(0x211631)
          .fillRoundedRect(-width / 2 - 1, -size - 2, width + 2, 6, 3);
        view.hp.fillStyle(enemy.boss ? 0xffab4d : 0xee536a)
          .fillRect(-width / 2, -size, (width * enemy.hp) / enemy.maxHp, 3);
      }
      view.label.setText(enemy.boss ? 'BOSS' : state.siege.enemies.length > 40 ? ''
        : enemy.burning ? 'FIRE' : enemy.progress >= 0.72 ? '!' : '');
      if (this.time.now < (view.body.getData('hitUntil') ?? 0)) view.body.setTintFill(0xffffff);
      else if (enemy.burning) view.body.setTint(0xffa15c);
      else if (enemy.progress >= 0.72) view.body.setTint(0xff9f9f);
      else if (enemy.hp / enemy.maxHp < 0.3) view.body.setTint(enemy.boss ? 0xffbba0 : 0xd2b8ff);
      else view.body.clearTint();
    }
    const ids = new Set(state.siege.units.map((u) => u.id));
    for (const [id, view] of this.defenders)
      if (!ids.has(id)) {
        this.tweens.killTweensOf(view.root);
        view.root.destroy();
        this.defenders.delete(id);
      }
    for (const unit of state.siege.units) {
      let view = this.defenders.get(unit.id);
      if (!view) {
        const p = this.unitPosition(unit),
          root = this.add.container(p.x, p.y).setDepth(unit.kind === 'soldier'
            ? siegeArtConfig.castle.depths.fieldSoldiers : siegeArtConfig.castle.depths.mounts);
        let body: Phaser.GameObjects.Sprite | undefined;
        let weapon: Phaser.GameObjects.Container | undefined;
        let magazine: Phaser.GameObjects.Graphics | undefined;
        if (unit.kind === 'soldier' || unit.kind === 'archer') {
          const sprite = unit.kind === 'archer' ? 'c_angel2' : 'c_angel1';
          body = cardboardActor(this, sprite, 0, 0, unit.kind === 'archer' ? Math.max(26, 52 * this.castle.scaleX) : 58);
          body.play(`${sprite}-idle`);
          root.add([this.add.ellipse(0, -2, 28, 8, 0x17313a, 0.24), body]);
        } else {
          weapon = weaponArt(this, unit.kind === 'mortar').setScale(Math.max(0.5, this.castle.scaleX));
          body = weapon.getData('body') as Phaser.GameObjects.Sprite | undefined;
          root.add(weapon);
          if (unit.kind === 'turret') {
            magazine = this.add.graphics();
            root.add(magazine);
          }
        }
        const label = this.text(0, 9, '', 9, '#bff5ff');
        root.add(label);
        root.setAlpha(0).setScale(0.45);
        this.tweens.add({ targets: root, alpha: 1, scale: 1, duration: 260, ease: 'Back.out' });
        view = { root, body, label, weapon, magazine };
        this.defenders.set(unit.id, view);
        if (unit.kind === 'soldier') {
          const gate = this.castleAnchor('gate');
          root.setPosition(gate.x, gate.y).setDepth(siegeArtConfig.castle.depths.gateSoldiers)
            .setData('leavingGate', true);
          this.tweens.add({ targets: root, x: p.x, y: p.y, delay: isShakeReduced() ? 0 : 120,
            duration: isShakeReduced() ? 80 : 420, ease: 'Sine.out',
            onComplete: () => root.setData('leavingGate', false)
              .setDepth(siegeArtConfig.castle.depths.fieldSoldiers) });
        }
        if (unit.kind === 'soldier' || unit.kind === 'archer') this.feel.emotion(p.x, p.y - 83, 'happy', `unit-${unit.id}`);
      }
      if (unit.kind === 'soldier' && state.progression.modules.includes('shieldSoldiers') && !view.root.getData('shield')) {
        view.root.add(this.add.rectangle(-14, -21, 13, 23, 0x638bab).setStrokeStyle(2, 0xd9e9ec));
        view.root.setData('shield', true);
      }
      if (view.magazine) {
        const capacity = upgradeValue('magazine', state.upgrades.magazine);
        const barY = -44 * Math.max(0.5, this.castle.scaleX);
        view.magazine.clear().fillStyle(0x211631).fillRoundedRect(-23, barY, 46, 7, 3);
        view.magazine
          .fillStyle(unit.ammo ? 0x63e6ef : 0xff5a73)
          .fillRect(-21, barY + 2, 42 * Math.min(1, unit.ammo / capacity), 3);
        view.label.setColor(unit.ammo ? '#bff5ff' : '#ff6b84');
      }
      view.label.setText(
        unit.kind === 'turret'
          ? unit.ammo
            ? `${unit.ammo} · ${Math.ceil(unit.ammo / upgradeValue('magazine', state.upgrades.magazine))} MAG`
            : 'EMPTY · CHAIN 3'
          : unit.kind === 'mortar'
            ? String(unit.ammo)
            : `${unit.hp}/${unit.maxHp} HP`
      );
    }
  }
  private handleEvents(events: SiegeEvent[]): void {
    const artillery = new Map<number, Extract<SiegeEvent, { type: 'shot' }>[]>();
    for (const event of events) if (event.type === 'shot' && event.kind === 'mortar') {
      const hits = artillery.get(event.unit) ?? [];
      hits.push(event);
      artillery.set(event.unit, hits);
    }
    for (const event of events)
      switch (event.type) {
        case 'level_up':
          // All mounts are available through chains; XP remains internal legacy progression.
          AudioSystem.play('reward_pick');
          break;
        case 'ability':
          AudioSystem.playPower(event.ability);
          this.callout(event.ability === 'ECHO' ? '+2 CHAIN' : event.ability, '#d3c2ff');
          if (event.ability === 'BOMB') {
            for (const view of [...this.invaders.values()].slice(0, 12)) {
              playCombatVFX(this, 'magic', view.root.x, view.root.y - 22, 90, 0xff9964);
              this.number(view.root.x, view.root.y - 45, `−${gameConfig.powerCards.BOMB.flatDamage}`, '#ffb985');
            }
          }
          break;
        case 'melee':
          this.actorAnimation(event.enemy, 'attack');
          break;
        case 'joker':
          AudioSystem.playPower(event.color === 'red' ? 'RED_JOKER' : 'BLACK_JOKER');
          break;
        case 'detonation': {
          const target = this.invaders.get(event.enemy);
          if (target) { playCombatVFX(this, 'magic', target.root.x, target.root.y - 22, 85, 0xff9955);
            this.number(target.root.x, target.root.y - 45, `BLAST ${event.damage}`, '#ffb985'); }
          break;
        }
        case 'card':
          AudioSystem.playCardSound(event.chain);
          comboFeedback(event.chain);
          for (const e of event.events) {
            if (e.type === 'power_activated') {
              AudioSystem.playPower(e.powerType);
              if (e.powerType === 'CRIT')
                this.callout(
                  `CRIT BANKED · NEXT DEPLOY ×${gameConfig.powerCards.CRIT.damageMultiplier}`,
                  '#ffd789'
                );
              if (e.powerType === 'WILD') this.callout('WILD · ANY NEXT CARD', '#a8ffff');
              if (e.powerType === 'BOMB') {
                this.callout(`BOMB · ${gameConfig.powerCards.BOMB.flatDamage} DAMAGE`, '#ffb196');
                for (const view of [...this.invaders.values()].slice(0, 8))
                  playCombatVFX(this, 'magic', view.root.x, view.root.y - 22, 90, 0xff9964);
              }
              const p = this.activePosition();
              playCombatVFX(
                this,
                e.powerType === 'HEAL' ? 'heal' : e.powerType === 'GUARD' ? 'shield' : 'magic',
                p.x + 25,
                p.y + 40,
                80
              );
            }
            if (e.type === 'joker_activated') {
              AudioSystem.playPower(e.color === 'red' ? 'RED_JOKER' : 'BLACK_JOKER');
              this.callout(
                e.color === 'red' ? 'LIFESTEAL BANKED · 30%' : 'CRITICAL BANKED · ×5',
                e.color === 'red' ? '#ff9fba' : '#d0b6ff'
              );
            }
          }
          this.tweens.add({ targets: this.chainText, scale: 1.12, duration: 90, yoyo: true });
          break;
        case 'draw':
          AudioSystem.play('card_draw');
          if (events.some((e) => e.type === 'deploy')) {
            const troops = events.filter(
              (e) => e.type === 'deploy' && (e.kind === 'soldier' || e.kind === 'archer')
            ).length;
            if (troops) this.callout(`${troops} TROOPS DEPLOYED`, '#c6ffd1');
          }
          if (event.recycled) {
            this.callout(`RESHUFFLE · −${CASTLE_RECYCLE_HP_COST} HP`, '#ffc28f');
            this.number(this.castle.x, this.castle.y - 70, `−${CASTLE_RECYCLE_HP_COST} HP`, '#ff6b84');
          }
          break;
        case 'spawn':
          {
            const p = this.enemyPosition(event.enemy);
            enemyPortal(this, p.x, p.y, 60 * enemyGroundPlacement(event.enemy.id, this.layout.arenaTop, this.layout.arenaHeight).scale);
          }
          if (this.time.now >= this.nextVoice) {
            AudioSystem.play('orc_growl', { volume: 0.32 });
            this.nextVoice = this.time.now + 6000;
          }
          if (event.enemy.boss) this.announcements?.showBoss(event.enemy.id);
          break;
        case 'deploy': {
          deployFeedback();
          const unit = this.manager.state!.siege.units.find((u) => u.id === event.id);
          if (unit) {
            const p = this.unitPosition(unit);
            this.releaseEffect(
              p.x,
              p.y - 18,
              event.kind === 'soldier' ? 0x73e6ad : event.kind === 'archer' ? 0xffd56b : 0x7ceaff
            );
            if (event.kind === 'turret')
              this.number(p.x, p.y - 65, `READY · ${unit.ammo}`, '#7ceaff');
            else if (event.kind === 'mortar')
              this.number(p.x, p.y - 65, `MORTAR · ${unit.damage} DMG`, '#d8b0ff');
          }
          if (event.kind === 'soldier') {
            AudioSystem.play(Math.random() > 0.5 ? 'footstep_1' : 'footstep_2', { volume: 0.18 });
            this.nextFootstep = this.time.now + 430;
          } else {
            AudioSystem.play('unit_deploy', { volume: 0.35 });
          }
          break;
        }
        case 'reload': {
          const turret = this.manager.state!.siege.units.find((u) => u.id === event.id);
          if (turret) {
            const p = this.unitPosition(turret);
            this.releaseEffect(p.x, p.y - 18, 0x7ceaff);
            this.number(p.x, p.y - 65, `RELOAD ${event.ammo}/${event.ammo}`, '#7ceaff');
          }
          AudioSystem.play('turret_reload', { volume: 0.4 });
          break;
        }
        case 'boost': {
          if (event.effect === 'heal' && this.time.now < this.nextHealEffect) break;
          if (event.effect === 'heal') this.nextHealEffect = this.time.now + 400;
          const color =
            event.effect === 'heal' ? '#83ffc4' : event.effect === 'armor' ? '#8ceaff' : '#ffe35a';
          const p =
            event.effect === 'gold'
              ? { x: this.coins.x, y: this.coins.y }
              : { x: this.castle.x, y: this.castle.y - 65 };
          playCombatVFX(
            this,
            event.effect === 'heal' ? 'heal' : event.effect === 'armor' ? 'shield' : 'reward',
            p.x,
            p.y,
            95
          );
          this.number(
            p.x,
            p.y - 30,
            `+${Math.round(event.amount * 10) / 10} ${event.effect === 'heal' ? 'HP' : event.effect === 'armor' ? 'ARMOR' : 'COINS'}`,
            color
          );
          break;
        }
        case 'shot':
          if (event.kind !== 'mortar' || artillery.get(event.unit)?.[0] === event)
            this.shot(event, artillery.get(event.unit)?.slice(1) ?? []);
          break;
        case 'unit_killed': {
          const view = this.defenders.get(event.unit.id);
          if (!view) break;
          this.defenders.delete(event.unit.id);
          this.tweens.killTweensOf(view.root);
          const actor = event.unit.kind === 'archer' ? 'c_angel2' : 'c_angel1';
          view.body?.setAngle(0).play(`${actor}-dead`);
          this.tweens.add({
            targets: view.root,
            alpha: 0,
            delay: actorDeathDuration(actor),
            duration: 180,
            onComplete: () => view.root.destroy(),
          });
          break;
        }
        case 'killed': {
          if (this.time.now >= this.nextVoice || event.enemy.boss) {
            AudioSystem.play('orc_death', { volume: 0.3 });
            this.nextVoice = this.time.now + 1400;
          }
          const view = this.invaders.get(event.enemy.id);
          const p = view ? { x: view.root.x, y: view.root.y } : this.enemyPosition(event.enemy);
          this.coinDrop(p.x, p.y - 20, event.coins, event.enemy.boss);
          if (!view) break;
          this.invaders.delete(event.enemy.id);
          view.hp.destroy();
          view.label.destroy();
          this.tweens.killTweensOf(view.root);
          view.body.setAngle(0);
          view.body.play(`${event.enemy.sprite}-dead`);
          this.tweens.add({
            targets: view.root,
            alpha: 0,
            y: view.root.y + 8,
            delay: actorDeathDuration(event.enemy.sprite),
            duration: 180,
            onComplete: () => view.root.destroy(),
          });
          playCombatVFX(this, 'reward', view.root.x, view.root.y - 24, 48);
          this.number(view.root.x, view.root.y - 40, `+${event.coins}`, '#ffe35a');
          break;
        }
        case 'castle_hit':
          this.actorAnimation(event.enemy, 'attack');
          if (event.damage > 0) {
            AudioSystem.play('player_hit', { volume: 0.85 });
            impactFeedback();
            this.number(this.castle.x, this.castle.y - 70, `−${event.damage}`, '#ff6b84');
            this.tweens.add({ targets: this.castle, angle: -1.3, duration: 100, yoyo: true, ease: 'Sine.out' });
            this.feel.emotion(this.castle.x, this.castleEmotionY(), 'worried', 'castle-hit');
            if (!isShakeReduced()) this.cameras.main.shake(90, 0.001);
          } else {
            AudioSystem.play('shield', { volume: 0.35 });
            playCombatVFX(this, 'shield', this.castle.x - 25, this.castle.y - 40, 65);
          }
          break;
        case 'laser':
          this.laserEffect(event.final);
          break;
        case 'ended':
          this.endPopup();
          break;
      }
  }
  private showUndoDamage(damage: number): void {
    AudioSystem.play('player_hit', { volume: 0.6 });
    impactFeedback();
    this.number(this.castle.x, this.castle.y - 70, `−${damage}`, '#ff6b84');
    this.tweens.add({ targets: this.castle, angle: -1.3, duration: 80, yoyo: true, ease: 'Sine.out' });
    if (!isShakeReduced()) this.cameras.main.shake(60, 0.0008);
  }
  private shot(event: Extract<SiegeEvent, { type: 'shot' }>,
    splash: Extract<SiegeEvent, { type: 'shot' }>[] = []): void {
    const unit = this.defenders.get(event.unit),
      enemy = this.invaders.get(event.target);
    if (!unit || !enemy) return;
    const tx = enemy.root.x,
      ty = enemy.root.y - 23;
    const targets = [event, ...splash].map(hit => {
      const view = this.invaders.get(hit.target);
      return { hit, x: view?.root.x ?? tx, y: (view?.root.y ?? enemy.root.y) - 23 };
    });
    const id = event.kind === 'mortar' ? 'cannon' : event.kind;
    const prefix = event.kind === 'soldier' ? 'c_angel1'
      : event.kind === 'archer' ? 'c_angel2' : `ae-${id}`;
    unit.body?.play(`${prefix}-attack`, true);
    const impact = () => {
      for (const target of targets) {
        this.actorAnimation(target.hit.target, 'hurt');
        this.showEnemyDamage(target.hit.target, target.x, target.y - 8, target.hit.damage,
          event.kind === 'turret' ? '#a8f5ff' : '#fff4d2');
        this.feel.burst(target.x, target.y, event.kind === 'mortar' ? 0xe9cb95 : 0xe4e7c8,
          event.kind === 'mortar' ? 8 : event.kind === 'turret' ? 2 : 3);
        playCombatVFX(this, event.kind === 'mortar' ? 'smoke' : 'slash', target.x, target.y,
          event.kind === 'mortar' ? 60 : event.kind === 'turret' ? 18 : 30);
        if (event.fire) playCombatVFX(this, 'magic', target.x, target.y, 38, 0xff8833);
      }
    };
    const sound = () => AudioSystem.play(event.kind === 'turret' ? 'turret_shot'
      : event.kind === 'mortar' ? 'mortar_shot'
      : event.kind === 'archer' ? 'archer_shot' : 'soldier_shot',
    { volume: event.kind === 'turret' ? 0.44 : event.kind === 'mortar' ? 0.5 : 0.38,
      duration: event.kind === 'turret' ? DEFENDER_STATS.turret.interval : undefined });
    if (event.kind === 'soldier' || event.kind === 'turret') {
      // Turret fire is already drawn in its attack frames. No flying bullet.
      impact();
      sound();
      return;
    }
    const projectileName = event.kind === 'mortar' ? 'cannonball' : event.fire ? 'fireArrow' : 'arrow';
    const style = siegeArtConfig.projectiles[projectileName];
    const launch = () => {
      if (!unit.root.active) return;
      const attack = siegeArtConfig.attacks[event.kind === 'mortar' ? 'cannon' : 'archer'];
      const start = unit.body ? unit.body.getWorldTransformMatrix().transformPoint(...attack.muzzle as [number, number])
        : { x: unit.root.x, y: unit.root.y - 20 };
      const projectile = createSiegeProjectile(this, projectileName, start.x, start.y);
      const flight = { t: 0 };
      const position = () => {
        const t = flight.t;
        projectile.setPosition(start.x + (tx - start.x) * t,
          start.y + (ty - start.y) * t - Math.sin(Math.PI * t) * style.arc);
        projectile.setRotation(Math.atan2(ty - start.y - Math.PI * style.arc * Math.cos(Math.PI * t),
          tx - start.x) + style.angleOffset * Math.PI / 180);
      };
      position();
      sound();
      this.tweens.add({ targets: flight, t: 1, duration: style.duration, onUpdate: position,
        onComplete: () => { projectile.destroy(); impact(); } });
    };
    this.time.delayedCall(attackReleaseDelay(event.kind === 'mortar' ? 'cannon' : 'archer'), launch);
  }
  private showEnemyDamage(id: number, x: number, y: number, amount: number, color: string): void {
    if (amount <= 0) return;
    const previous = this.damageLabels.get(id);
    if (previous?.text.active && this.time.now <= previous.until) {
      previous.amount += amount;
      previous.text.setText(String(Math.round(previous.amount * 10) / 10));
      return;
    }
    const text = this.number(x, y, String(Math.round(amount * 10) / 10), color);
    this.damageLabels.set(id, { amount, until: this.time.now + 300, text });
    text.once('destroy', () => {
      if (this.damageLabels.get(id)?.text === text) this.damageLabels.delete(id);
    });
  }
  private releaseEffect(x: number, y: number, color: number): void {
    const active = this.activePosition();
    const spark = this.add
      .circle(active.x + this.layout.cw / 2, active.y + 20, 6, color)
      .setDepth(180);
    this.tweens.add({
      targets: spark,
      x,
      y,
      duration: 320,
      ease: 'Cubic.out',
      onComplete: () => {
        spark.destroy();
        playCombatVFX(this, 'magic', x, y, 54, color);
        this.feel.burst(x, y, color, 6);
        const ring = this.add.circle(x, y, 12).setStrokeStyle(1.5, color, 0.6).setDepth(180);
        this.tweens.add({
          targets: ring,
          scale: 2.5,
          alpha: 0,
          duration: 380,
          onComplete: () => ring.destroy(),
        });
      },
    });
  }
  private openWorkshop(): void {
    if (this.paused || this.locked || this.ended || this.training) return;
    this.paused = true;
    this.manager.save();
    AudioSystem.setMusicScene('menu');
    showRunWorkshop(this, this.manager, () => {
      this.refreshHUD();
      this.syncActors();
      this.paused = false;
      this.accumulator = 0;
      AudioSystem.setMusicScene('battle');
    });
  }
  /** Visual confirmation only: the simulation already committed this loot. */
  private coinDrop(x: number, y: number, value: number, boss: boolean): void {
    const reduced = isShakeReduced();
    const count = Math.min(reduced ? 2 : boss ? 12 : 5, value, Math.max(0, 32 - this.coinFlights));
    for (let i = 0; i < count; i++) {
      this.coinFlights++;
      const coin = this.add.image(x, y, 'coin').setDisplaySize(boss ? 17 : 13, boss ? 17 : 13).setDepth(220);
      const spread = reduced ? 0 : (i - (count - 1) / 2) * 14;
      const flight = { t: 0 };
      this.tweens.add({ targets: flight, t: 1, duration: reduced ? 120 : 330,
        onUpdate: () => coin.setPosition(x + spread * flight.t,
          y + 15 * flight.t - (reduced ? 0 : Math.sin(flight.t * Math.PI) * (30 + i * 3))),
        onComplete: () => {
          this.tweens.add({ targets: coin, y: coin.y - (reduced ? 0 : 9),
            duration: reduced ? 0 : 110, yoyo: true,
            onComplete: () => this.tweens.add({ targets: coin,
              x: this.coins.x - 22, y: this.coins.y, alpha: 0.35, scaleX: coin.scaleX * 0.65,
              scaleY: coin.scaleY * 0.65, duration: reduced ? 180 : 400, delay: reduced ? 0 : i * 35,
              ease: 'Cubic.in', onComplete: () => {
                coin.destroy();
                this.coinFlights = Math.max(0, this.coinFlights - 1);
                if (i === 0 && this.coins.active) {
                  this.tweens.killTweensOf(this.coins);
                  this.coins.setScale(reduced ? 1 : 1.15).setColor('#ffffff');
                  this.tweens.add({ targets: this.coins, scale: 1, duration: 180,
                    onComplete: () => this.coins.setColor('#ffe35a') });
                  AudioSystem.play('power_gold', { volume: 0.24 });
                }
              },
            }),
          });
        },
      });
    }
  }
  private rewardInfo(index: number): void {
    if (this.training) return;
    if (this.paused || this.ended) return;
    this.paused = true;
    AudioSystem.setMusicScene('menu');
    const state = this.manager.state!;
    const descriptions = [
      'Chains 1, 6, 11... bank another soldier. Soldiers march from the gates. Shield soldiers hold enemies in melee.',
      `Chains 2, 7, 12... each bank another archer on the wall: ${upgradeValue('knight', state.upgrades.knight)} damage per arrow. Mounted archers are protected by the walls. Fire arrows ignite enemies.`,
      `Chains 3, 8, 13... each bank a ${upgradeValue('magazine', state.upgrades.magazine)}-round magazine for one turret. Tap the stock to load all banked magazines together. It fires 4 bullets per second for 2 base damage each.`,
      `Chains 4, 9, 14... bank ×1, ×2, ×3... damage for one arc cannon. It fires 12 shells for ${upgradeValue('mortar', state.upgrades.mortar)} base damage to up to three enemies.`,
      `Chains 5, 10, 15... bank ×1, ×2, ×3... damage for one laser blast. Base damage is ${upgradeValue('laser', state.upgrades.laser)} to every enemy. Strong enemies can survive.`,
    ];
    const modal = gamePopup(
      this,
      ['SOLDIERS', 'ARCHER', 'TURRET & RELOAD', 'ARC CANNON', 'LASER'][index],
      'Bank the chain, then tap the stock to release it.',
      420
    );
    modal.root.setDepth(3000);
    modal.content.add(
      this.text(0, modal.top + 108, descriptions[index], 15, '#fff8e5')
        .setOrigin(0.5, 0)
        .setWordWrapWidth(modal.width - 44)
    );
    popupButton(this, modal.content, modal.height / 2 - 43, modal.width - 36, 'GOT IT', () => {
      modal.root.destroy();
      this.paused = false;
      this.accumulator = 0;
      AudioSystem.setMusicScene('battle');
    });
  }
  private actorAnimation(id: number, action: 'attack' | 'hurt') {
    const view = this.invaders.get(id),
      enemy = this.manager.state!.siege.enemies.find((e) => e.id === id);
    if (view && action === 'hurt') {
      view.body.setData('hitUntil', this.time.now + 90).setTintFill(0xffffff);
      this.time.delayedCall(90, () => {
        if (view.body.active && this.time.now >= view.body.getData('hitUntil')) view.body.clearTint();
      });
    }
    if (!view || !enemy || view.body.anims.currentAnim?.key === `${enemy.sprite}-${action}`) return;
    if (action === 'hurt') this.feel.emotion(view.root.x, view.root.y - ((view.body.getData('actorHeight') as number | undefined) ?? view.body.displayHeight) - 22, 'worried', `hurt-${id}`);
    this.tweens.add({
      targets: view.body,
      angle: action === 'attack' ? 12 : -8,
      duration: 90,
      yoyo: true,
    });
    view.body.play(`${enemy.sprite}-${action}`);
    view.body.once('animationcomplete', () => {
      if (this.invaders.get(id) === view) view.body.play(`${enemy.sprite}-idle`);
    });
  }
  private laserEffect(final: boolean): void {
    const { width: w } = viewport(this);
    const { x, y } = this.core.root;
    this.core.fire();
    const charge = this.add.circle(x, y, 8, 0xe4a0ff, 0.45).setDepth(180);
    this.tweens.add({ targets: charge, scale: 1.8, alpha: 0, duration: 360,
      ease: 'Sine.out', onComplete: () => charge.destroy() });
    const beam = this.add.graphics().setDepth(180), sweep = { t: 0 };
    this.tweens.add({ targets: sweep, t: 1, duration: 620, ease: 'Sine.out',
      onUpdate: () => {
        const intensity = Math.sin(sweep.t * Math.PI);
        const end = x - w * Math.min(1, sweep.t * 3);
        beam.clear().lineStyle(18, 0xb451f0, intensity * 0.12).lineBetween(x, y, end, y)
          .lineStyle(6, 0xe5b6ff, intensity * 0.6).lineBetween(x, y, end, y)
          .lineStyle(1.7, 0xf2fff6, intensity * 0.85).lineBetween(x, y, end, y);
      }, onComplete: () => beam.destroy() });
    this.feel.burst(x, y, 0xe5b6ff, 10);
    playCombatVFX(this, 'magic', x, y, 58, 0xe5b6ff);
    AudioSystem.play('laser_blast', { volume: 0.58 });
    if (final && !isShakeReduced()) this.cameras.main.shake(120, 0.0012);
    this.callout(final ? 'SOLITAIRE COMPLETE!' : 'LASER RELEASED', '#c6fff3');
  }
  private number(x: number, y: number, value: string, color: string) {
    const text = this.text(x, y, value, 15, color).setStroke('#211631', 3).setDepth(190);
    this.tweens.add({
      targets: text,
      y: y - 22,
      alpha: 0,
      duration: 720,
      ease: 'Sine.out',
      onComplete: () => text.destroy(),
    });
    return text;
  }
  private callout(value: string, color: string) {
    this.calloutUI?.destroy();
    const root = this.add.container(viewport(this).width / 2, 0).setDepth(190);
    this.calloutUI = root;
    const text = this.text(0, 0, value, 18, color).setStroke('#233b40', 2);
    const width = Math.min(viewport(this).width - 24, text.width + 32);
    text.setWordWrapWidth(width - 20).setAlign('center');
    const height = Math.max(36, text.height + 16);
    root.setY(this.layout.arenaTop + 24 + height / 2);
    const plate = this.add.graphics().fillStyle(0x1a3540, 0.93)
      .fillRoundedRect(-width / 2, -height / 2, width, height, 12)
      .lineStyle(1, 0xd3c597, 0.6).strokeRoundedRect(-width / 2, -height / 2, width, height, 12);
    root.add([plate, text]); root.setScale(0.94).setAlpha(0);
    this.tweens.add({ targets: root, scale: 1, alpha: 1, duration: 180, ease: 'Sine.out' });
    this.tweens.add({
      targets: root,
      alpha: 0,
      y: root.y - 8,
      delay: 800,
      duration: 350,
      onComplete: () => root.destroy(),
    });
  }
  private bankAbandoned(): void {
    const manager = this.manager;
    if (!manager.state) return;
    manager.state.run = { ...manager.state.run, phase: 'defeat' };
    manager.save();
    manager.service.settle(manager.state);
  }
  private endPopup(): void {
    if (this.ended) return;
    this.ended = true;
    this.announcements?.reset();
    this.paused = true;
    AudioSystem.stopSound('turret_shot');
    const manager = this.manager, state = manager.state!;
    manager.service.settle(state);
    manager.save();
    const won = state.run.phase === 'victory';
    AudioSystem.setMusicScene(won ? 'victory' : 'defeat');
    AudioSystem.play(won ? 'victory' : 'defeat');
    if (won) {
      successFeedback();
      const { width, height } = viewport(this);
      celebrationBurst(this, width / 2, height * 0.4, 32);
      this.time.delayedCall(200, () => confettiBurst(this));
      this.time.delayedCall(400, () => celebrationBurst(this, width * 0.3, height * 0.5, 16));
      this.time.delayedCall(500, () => celebrationBurst(this, width * 0.7, height * 0.5, 16));
      this.time.delayedCall(800, () => {
        showPerkChoice(this, manager, () => {
          this.showResultScreen(manager, state);
        });
      });
    } else {
      impactFeedback();
      this.showResultScreen(manager, state);
    }
  }
  private showResultScreen(manager: CastleManager, state: typeof manager.state): void {
    showCastleRoundResult(this, state!, {
      next: () => {
        if (!manager.start()) return false;
        this.scene.restart({ tutorial: false });
      },
      menu: () => { this.scene.start('StartScene'); },
    });
  }
}
