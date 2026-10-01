import { playCombatVFX } from '../design/CombatVFX';
import { viewport, configureViewport, getRenderDensity } from '../design/viewport';
import Phaser from 'phaser';
import { getGameManager, setTestHook } from '../GameManager';
import { colors, getLayoutMetrics, getCardMetrics } from '../design/tokens';
import { ArenaBackground, getEncounterForEnemy, type EncounterType } from '../design/ArenaBackground';
import type { ActDef } from '../../core/GameState';
import { getEmotion, type Emotion } from './enemyEmotion';
import { HPBar, ComboBanner, createIntentBubble } from '../design/HudComponents';
import { CardVisual, createCardBack } from '../design/CardVisual';
import { showBuildPanel } from '../design/BuildPanel';
import { SettingsModal } from '../design/SettingsModal';
import { showRules, hasSeenRules } from '../design/RulesPopup';
import { isPlayable, MIN_ATTACK_CHAIN } from '../../core/GameRules';
import { AudioSystem } from '../audio/AudioSystem';
import { Juice } from '../juice/Juice';
import { JUICE, classifyHit, hitStopMs, shakeIntensity } from '../juice/juiceConfig';
import type { RunState, Card, BattleState, PowerType } from '../../core/types';

const parseHex = (value: string): number => parseInt(value.replace('#', ''), 16);

const POWER_TINTS: Record<PowerType, number> = {
  CRIT: 0xff6633, HEAL: 0x3aef98, GUARD: 0x50bfff, GOLD: 0xffd34a, BOMB: 0xff9a30, WILD: 0x80eaff, ECHO: 0xc58aff,
};

export class BattleScene extends Phaser.Scene {
  private layout!: ReturnType<typeof getLayoutMetrics>;
  private cardMetrics!: ReturnType<typeof getCardMetrics>;

  // Visual components
  private arenaBackground!: ArenaBackground;
  private enemySprite: Phaser.GameObjects.Sprite | null = null;
  private enemyShadow: Phaser.GameObjects.Ellipse | null = null;
  private crownSprite: Phaser.GameObjects.Image | null = null;
  private enemyNameText!: Phaser.GameObjects.Text;
  private enemyHPBar!: HPBar;
  private intentBubble: Phaser.GameObjects.Container | null = null;
  private comboBanner!: ComboBanner;
  private playerHPBar!: HPBar;
  private goldText!: Phaser.GameObjects.Text;
  private armorText!: Phaser.GameObjects.Text;
  private buildText!: Phaser.GameObjects.Text;
  private stockLabel!: Phaser.GameObjects.Text;
  private stockBadge!: Phaser.GameObjects.Text;
  private stockBadgeBg!: Phaser.GameObjects.Arc;
  private stockBacks: Phaser.GameObjects.Container[] = [];
  private stockEmpty!: Phaser.GameObjects.Container;
  private stockHit = { x: 0, y: 0, width: 0, height: 0 };
  private undoButton: Phaser.GameObjects.Container | null = null;
  private undoEnabled = false;
  /** True once a pointerdown happened inside this scene (rejects ghost pointerups from the previous scene). */
  private pointerArmed = false;
  /** Resting rect of each exposed tableau card (cards may still be flying in during the deal). */
  private exposedSlots = new Map<string, { x: number; y: number; width: number; height: number; onTap: () => void }>();
  private buildPanel: Phaser.GameObjects.Container | null = null;
  private topHUD: Phaser.GameObjects.Container | null = null;
  private activeLabel: Phaser.GameObjects.Text | null = null;

  // Table elements
  private tableBackground!: Phaser.GameObjects.Graphics;
  private cardVisuals: CardVisual[] = [];
  private activeCardVisual: CardVisual | null = null;
  private drawPile: Phaser.GameObjects.Container | null = null;

  // State
  private currentState: RunState | null = null;
  private renderedEnemyId: string | null = null;
  private renderedIntentKey: string | null = null;
  
  // UI
  private settingsModal: SettingsModal | null = null;
  private inputPaused: boolean = false;
  private enemyScale = 1;
  private enemyBaseY = 0;
  private enemyKey = 'goblin';
  private enemyDying = false;
  private dealt = false;
  private lastShake = 0;
  private juice!: Juice;
  private lastEnemyMaxHp = 1;
  /** While an enemy attack animates, the player HP bar keeps showing the pre-hit value until contact. */
  private heldPlayerHp: number | null = null;
  private chainHadCrit = false;
  private enemyBaseTint: number | null = null;
  private enemyAura: Phaser.GameObjects.Image | null = null;
  private emotion: Emotion = 'calm';
  private enemyHeadTop = 0.9;
  private emoteMark: Phaser.GameObjects.Graphics | null = null;
  private emoteTimer: number | null = null;

  constructor() {
    super('BattleScene');
  }

  create(): void {
    configureViewport(this);
    const width = viewport(this).width;
    const height = viewport(this).height;

    this.layout = getLayoutMetrics(width, height);
    this.cardMetrics = getCardMetrics(width);

    // Arena background
    this.arenaBackground = new ArenaBackground(this);
    this.arenaBackground.setDepth(0);

    // Top HUD bar
    this.createTopHUD();

    // Table background (felt)
    this.createTableBackground();

    // Combo banner
    this.comboBanner = new ComboBanner(
      this,
      width / 2,
      this.layout.bannerTop,
      width - 32,
      this.layout.bannerHeight
    );
    this.comboBanner.setDepth(50);

    // Player HUD at bottom
    this.createPlayerHUD();

    // Stock pile (tap to draw / end turn) and undo
    this.createStockPile();
    this.createUndoButton();

    // Juice toolkit (pooled particles/numbers, hit-stop, shake)
    this.juice = new Juice(this);
    // Crown / emote marks follow the bobbing enemy sprite.
    const follow = () => this.positionEmote();
    this.events.on(Phaser.Scenes.Events.UPDATE, follow);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.events.off(Phaser.Scenes.Events.UPDATE, follow));

    // Initial render
    this.dealt = false;
    this.enemyDying = false;
    AudioSystem.setMusicScene('battle');
    this.refreshState();

    // No timed input lock at battle start: a game-clock delayedCall stretched to
    // 1-3s whenever the first frames were slow (Phaser clamps delta after a long
    // frame), silently eating the first tap. Instead, only reject pointerups whose
    // pointerdown happened before this scene existed (the tap that started it).
    this.pointerArmed = false;
    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.armPointer, this);
    this.input.on(Phaser.Input.Events.POINTER_UP, this.onScenePointerUp, this);
    if (!hasSeenRules()) { this.inputPaused = true; showRules(this, () => { this.inputPaused = false; }); }

    // Create settings modal
    this.settingsModal = new SettingsModal(this, {
      onResume: () => {
        this.inputPaused = false;
      },
      onRestart: () => {
        this.inputPaused = false;
        const manager = getGameManager();
        manager.abandonRun();
        manager.startNewRun();
        this.scene.start('RewardScene');
      },
      onMainMenu: () => {
        this.inputPaused = false;
        this.scene.start('StartScene');
      },
    });

    // Listen for resize
    this.scale.on('resize', this.handleResize, this);

    // Set up test hook for automated testing
    this.setupTestHook();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
  }

  private armPointer(): void {
    this.pointerArmed = true;
  }

  /**
   * Fallback for taps that land on a card's resting slot while the card is still
   * animating (deal / layout tween): hit zones travel with the card, the finger doesn't.
   */
  private onScenePointerUp(pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]): void {
    if (over.length || this.inputPaused || !this.pointerArmed) return;
    const x = pointer.worldX;
    const y = pointer.worldY;
    for (const slot of this.exposedSlots.values()) {
      if (x >= slot.x && x <= slot.x + slot.width && y >= slot.y && y <= slot.y + slot.height) { slot.onTap(); return; }
    }
  }

  private setupTestHook(): void {
    setTestHook({
      isActive: true,
      getPlayableCards: () => {
        // Resting bounds (not mid-animation positions), so automation taps where a player would.
        return this.cardVisuals
          .filter((cv) => cv.getState() === 'playable')
          .map((cv) => {
            const slot = this.exposedSlots.get(cv.getCard().id);
            return { cardId: cv.getCard().id, bounds: slot ? { x: slot.x, y: slot.y, width: slot.width, height: slot.height } : cv.getWorldBounds() };
          });
      },
      getDrawPileBounds: () => {
        if (!this.drawPile) return { x: 0, y: 0, width: 0, height: 0 };
        return { ...this.stockHit };
      },
      getUndoBounds: () => {
        if (!this.undoButton) return { x: 0, y: 0, width: 0, height: 0 };
        return { x: this.undoButton.x - 24, y: this.undoButton.y - 24, width: 48, height: 48 };
      },
      canUndo: () => getGameManager().canUndo(),
      getTableauCount: () => {
        const state = getGameManager().getState();
        if (!state?.battle) return 0;
        return state.battle.tableau.reduce((sum, col) => sum + col.cards.length, 0);
      },
      getDeckCount: () => {
        const state = getGameManager().getState();
        return state?.battle?.deck.length || 0;
      },
      getActiveCardId: () => {
        const state = getGameManager().getState();
        return state?.battle?.activeCard?.id || null;
      },
    });
  }

  private createTopHUD(): void {
    const width = viewport(this).width;
    const { hudTop, hudHeight, relicTop } = this.layout;
    const manager = getGameManager();
    // HUD band is painted edge to edge from y=0 (under the notch); content stays below safeTop.
    const band = this.add.graphics().setDepth(99);
    band.fillStyle(0x1a1030, 1).fillRect(0, 0, width, hudTop + hudHeight + 4);
    band.fillStyle(0x654581, 1).fillRect(0, hudTop + hudHeight + 3, width, 1);
    this.topHUD = this.add.container(0, hudTop).setDepth(100);
    const bg = this.add.rectangle(width / 2, hudHeight / 2, width - 16, hudHeight, 0x21163a).setStrokeStyle(1, 0x654581);
    const progress = this.add.text(16, hudHeight / 2, manager.isBossFight() ? 'BOSS FIGHT' : `LEVEL ${manager.getCurrentFightNumber()}`, {
      resolution: getRenderDensity(), fontFamily: 'Fredoka', fontSize: '14px', fontStyle: 'bold', color: '#fff3d1',
    }).setOrigin(0, 0.5);
    const coin = this.add.image(width * 0.58 - 20, hudHeight / 2, 'coin').setDisplaySize(24, 24);
    this.goldText = this.add.text(width * 0.58 + 6, hudHeight / 2, '0', {
      resolution: getRenderDensity(), fontFamily: 'Fredoka', fontSize: '16px', color: '#ffd267',
    }).setOrigin(0.5);
    const settings = this.add.rectangle(width - 32, hudHeight / 2, 44, 44, 0x3d2c66).setInteractive();
    settings.on('pointerup', () => { AudioSystem.unlock(); this.openSettings(); });
    const gear = this.add.text(width - 32, hudHeight / 2, '⚙', { resolution: getRenderDensity(), fontSize: '22px', color: '#fff' }).setOrigin(0.5);
    this.topHUD.add([bg, progress, coin, this.goldText, settings, gear]);
    // Visual strip is 26px tall; the touch target is 44px.
    const build = this.add.rectangle(width / 2, relicTop + 14, width - 24, 26, 0x352353).setDepth(100)
      .setInteractive(new Phaser.Geom.Rectangle(0, -9, width - 24, 44), Phaser.Geom.Rectangle.Contains);
    this.buildText = this.add.text(width / 2, build.y, 'BUILD · CHOOSE A RELIC', {
      resolution: getRenderDensity(), fontFamily: 'Fredoka', fontSize: '12px', color: '#dac6ff',
    }).setOrigin(0.5).setDepth(101);
    build.on('pointerup', () => {
      if (this.inputPaused) return;
      this.inputPaused = true;
      this.buildPanel = showBuildPanel(this, manager.getState()?.player.relics ?? [], () => {
        this.inputPaused = false;
        this.buildPanel = null;
      });
    });
  }

  private openSettings(): void {
    if (this.inputPaused) return;
    if (this.settingsModal) {
      this.inputPaused = true;
      this.settingsModal.show();
    }
  }

  private createTableBackground(): void {
    const { tableTop } = this.layout;
    const width = viewport(this).width;
    const height = viewport(this).height;

    this.tableBackground = this.add.graphics();
    this.tableBackground.setDepth(10);

    // Felt gradient - painted to the very bottom edge (under the home indicator)
    this.tableBackground.fillStyle(colors.feltHi, 1);
    this.tableBackground.fillGradientStyle(colors.feltHi,
      colors.feltHi,
      colors.feltLo,
      colors.feltLo,
      1
    );
    this.tableBackground.fillRoundedRect(
      0,
      tableTop,
      width,
      height - tableTop,
      { tl: 22, tr: 22, bl: 0, br: 0 }
    );

    // Wood rim at top
    this.tableBackground.fillStyle(colors.rim, 1);
    this.tableBackground.fillRect(0, tableTop, width, 6);
    this.tableBackground.fillStyle(colors.rimHi, 1);
    this.tableBackground.fillRect(0, tableTop, width, 2);
  }

  private createPlayerHUD(): void {
    const width = viewport(this).width;
    const y = this.layout.playerHudTop + 15;
    this.playerHPBar = new HPBar(this, 76, y, 126, 20, 30, true);
    this.playerHPBar.setDepth(100);
    this.armorText = this.add.text(width - 16, y, 'ARMOR 0', {
      resolution: getRenderDensity(), fontFamily: 'Fredoka', fontSize: '13px', color: '#9ccfff',
    }).setOrigin(1, 0.5).setDepth(100);
  }

  /** Stock pile layout: card backs at the left of the tray, label to its right. */
  private stockGeometry() {
    const { trayTop, activeW, activeH } = this.layout;
    const left = 14;
    const top = trayTop + 12;
    return { left, top, w: activeW, h: activeH, cx: left + activeW / 2, cy: top + activeH / 2 };
  }

  private createStockPile(): void {
    const { trayTop, trayHeight, activeScale } = this.layout;
    const g = this.stockGeometry();
    this.drawPile = this.add.container(0, 0).setDepth(55);
    // Empty state: dashed slot with a recycle glyph.
    const empty = this.add.graphics();
    empty.lineStyle(2, 0x9a8aba, 0.8);
    const dash = 6;
    for (let x = g.left; x < g.left + g.w; x += dash * 2) { empty.lineBetween(x, g.top, Math.min(x + dash, g.left + g.w), g.top); empty.lineBetween(x, g.top + g.h, Math.min(x + dash, g.left + g.w), g.top + g.h); }
    for (let y = g.top; y < g.top + g.h; y += dash * 2) { empty.lineBetween(g.left, y, g.left, Math.min(y + dash, g.top + g.h)); empty.lineBetween(g.left + g.w, y, g.left + g.w, Math.min(y + dash, g.top + g.h)); }
    const emptyGlyph = this.add.text(g.cx, g.cy, '↻', { resolution: getRenderDensity(), fontFamily: 'Fredoka', fontSize: '22px', color: '#9a8aba' }).setOrigin(0.5);
    this.stockEmpty = this.add.container(0, 0, [empty, emptyGlyph]).setVisible(false);
    this.drawPile.add(this.stockEmpty);
    // Up to 3 stacked backs (offset up-left) suggest depth.
    this.stockBacks = [];
    for (let i = 2; i >= 0; i--) {
      const back = createCardBack(this, g.left - i * 2, g.top - i * 2);
      back.setScale(activeScale);
      this.stockBacks.push(back);
      this.drawPile.add(back);
    }
    // Remaining-count badge.
    this.stockBadgeBg = this.add.circle(g.left + g.w - 2, g.top + 2, 12, 0xff3b4e).setStrokeStyle(2.5, 0x1b1030);
    this.stockBadge = this.add.text(this.stockBadgeBg.x, this.stockBadgeBg.y, '0', { resolution: getRenderDensity(), fontFamily: 'Lilita One', fontSize: '13px', color: '#ffffff' }).setOrigin(0.5);
    this.drawPile.add([this.stockBadgeBg, this.stockBadge]);
    // Info label (chain progress / enemy hit) next to the pile.
    this.stockLabel = this.add.text(g.left + g.w + 12, trayTop + trayHeight / 2 - 4, '', {
      resolution: getRenderDensity(), fontFamily: 'Fredoka', fontSize: '11px', color: '#e1e6ff', lineSpacing: 1,
    }).setOrigin(0, 0.5).setDepth(55);
    // Touch target: whole pile plus padding, at least 44×44.
    const hitW = Math.max(44, g.w + 16);
    const hitH = Math.max(44, Math.min(trayHeight - 4, g.h + 16));
    this.stockHit = { x: g.cx - hitW / 2, y: g.cy - hitH / 2, width: hitW, height: hitH };
    const zone = this.add.zone(g.cx, g.cy, hitW, hitH).setInteractive().setDepth(56);
    zone.on('pointerdown', () => { if (!this.inputPaused) this.setStockPressed(true); });
    zone.on('pointerout', () => this.setStockPressed(false));
    zone.on('pointerup', () => { this.setStockPressed(false); if (this.pointerArmed) this.onDrawClick(); });
  }

  private setStockPressed(pressed: boolean): void {
    if (!this.drawPile) return;
    const g = this.stockGeometry();
    // Scale around the pile centre.
    const scale = pressed ? 0.94 : 1;
    this.drawPile.setScale(scale).setPosition(g.cx * (1 - scale), g.cy * (1 - scale));
  }

  private createUndoButton(): void {
    const { trayTop, trayHeight, activeW } = this.layout;
    const width = viewport(this).width;
    const activeLeft = width * 0.76 - activeW / 2;
    const x = activeLeft - 14 - 24;
    const y = trayTop + trayHeight / 2 - 2;
    const button = this.add.container(x, y).setDepth(56);
    const bg = this.add.graphics();
    bg.fillStyle(0x1b1030, 1).fillRoundedRect(-22, -20, 44, 44, 12);
    bg.fillStyle(0x4b3a7a, 1).fillRoundedRect(-22, -22, 44, 42, 12);
    bg.lineStyle(2.5, 0x1b1030, 1).strokeRoundedRect(-22, -22, 44, 42, 12);
    const glyph = this.add.text(0, -6, '↶', { resolution: getRenderDensity(), fontFamily: 'Fredoka', fontSize: '22px', color: '#ffffff' }).setOrigin(0.5);
    const label = this.add.text(0, 11, 'UNDO', { resolution: getRenderDensity(), fontFamily: 'Fredoka', fontSize: '9px', fontStyle: 'bold', color: '#dcd0ff' }).setOrigin(0.5);
    button.add([bg, glyph, label]);
    button.setInteractive(new Phaser.Geom.Rectangle(-24, -24, 48, 48), Phaser.Geom.Rectangle.Contains);
    button.on('pointerdown', () => { if (this.undoEnabled && !this.inputPaused) button.setScale(0.92); });
    button.on('pointerout', () => button.setScale(1));
    button.on('pointerup', () => { button.setScale(1); if (this.pointerArmed) this.onUndoClick(); });
    this.undoButton = button;
    this.setUndoEnabled(false);
  }

  private setUndoEnabled(enabled: boolean): void {
    this.undoEnabled = enabled;
    this.undoButton?.setAlpha(enabled ? 1 : 0.38);
  }

  private refreshState(): void {
    const manager = getGameManager();
    const state = manager.getState();
    if (!state) return;

    const previousState = this.currentState;
    this.currentState = state;

    // Update arena background based on enemy
    if (state.battle) {
      const actDef = this.getActDef(state.battle.enemy.act);
      const encounter = (actDef?.encounter as EncounterType | undefined) ?? getEncounterForEnemy(state.battle.enemy.sprite || 'goblin');
      if (!previousState?.battle || previousState.battle.enemy.id !== state.battle.enemy.id) this.arenaBackground.draw(
        viewport(this).width,
        this.layout.arenaTop,
        this.layout.arenaHeight,
        encounter
      );

      this.renderEnemy(state.battle);
      this.renderTableau(state.battle);
      this.renderActiveCard(state.battle);
      this.updateComboBanner(state.battle);
      this.updateDrawPile(state.battle);
    }

    this.updatePlayerHUD(state);
  }

  private renderEnemy(battle: BattleState): void {
    const width = viewport(this).width;
    const { arenaTop, arenaHeight } = this.layout;

    const enemy = battle.enemy;
    const intent = enemy.intents[enemy.currentIntentIndex];
    const intentKey = `${intent?.type}:${intent?.value}`;
    if (this.renderedEnemyId === enemy.id) {
      this.lastEnemyMaxHp = enemy.maxHp;
      this.enemyHPBar.setHp(enemy.hp, enemy.maxHp);
      this.enemyHPBar.setPendingDamage(battle.accumulatedDamage);
      this.updateEmotion(battle);
      if (this.renderedIntentKey !== intentKey) {
        this.updateIntent(battle);
      }
      return;
    }
    this.renderedEnemyId = enemy.id;
    this.lastEnemyMaxHp = enemy.maxHp;
    this.emotion = 'calm';
    this.clearEmote();
    if (!enemy.crown) { this.crownSprite?.destroy(); this.crownSprite = null; }
    const enemyX = width / 2;
    const enemyY = arenaTop + arenaHeight - 70;

    // Target enemy height: ~26% of screen height per STYLE.md
    const targetEnemyHeight = this.layout.enemyHeight;

    // Enemy shadow (dark oval under feet)
    if (this.enemyShadow) {
      this.enemyShadow.destroy();
    }
    this.enemyShadow = this.add.ellipse(enemyX, enemyY + 5, 120, 24, 0x1b1030, 0.4);
    this.enemyShadow.setDepth(15);

    // Enemy sprite
    if (this.enemySprite) {
      this.enemySprite.destroy();
    }

    const atlasKey = `enemy-${enemy.sprite || 'goblin'}`;
    if (this.textures.exists(atlasKey)) {
      this.enemySprite = this.add.sprite(enemyX, enemyY, atlasKey);
      this.enemySprite.setOrigin(0.5, 1);

      // Calculate scale to achieve target height
      const frame = this.textures.getFrame(atlasKey);
      const baseHeight = frame ? frame.height : 180;
      const baseScale = targetEnemyHeight / baseHeight;
      const actDef = this.getActDef(enemy.act);
      const scale = baseScale * (enemy.scale || 1) * (actDef?.scale ?? 1);
      const spriteDef = getGameManager().getEnemiesData().sprites?.[enemy.sprite];
      this.enemySprite.setFlipX(!!spriteDef?.facesRight);
      this.enemyHeadTop = spriteDef?.headTop ?? 0.9;
      
      // Never taller than ~82% of the arena (big bosses at high act scale).
      const maxScale = (this.layout.arenaHeight * 0.82) / baseHeight;
      this.enemySprite.setScale(Math.min(scale, maxScale));
      this.enemySprite.setDepth(20);
      this.enemyKey = enemy.sprite || 'goblin';
      this.enemyScale = Math.min(scale, maxScale);
      this.enemyBaseY = enemyY;
      this.startEnemyIdle();

      // Update shadow size based on sprite size
      const shadowWidth = Math.min(this.enemySprite.displayWidth * 0.7, 150);
      this.enemyShadow.setSize(shadowWidth, shadowWidth * 0.2);

      // Play idle animation
      const idleKey = `${enemy.sprite || 'goblin'}-idle`;
      if (this.anims.exists(idleKey)) {
        this.enemySprite.play(idleKey);
      }

      // Tint: enemy override (boss gold etc.) > act tint.
      const tint = enemy.tint === 'gold' ? 0xffd700 : enemy.tint ? parseHex(enemy.tint) : actDef?.tint ? parseHex(actDef.tint) : null;
      this.enemyBaseTint = tint;
      if (tint !== null) this.enemySprite.setTint(tint); else this.enemySprite.clearTint();

      // Act aura: soft additive glow behind the enemy.
      this.enemyAura?.destroy();
      this.enemyAura = null;
      const auraColor = actDef?.aura ? parseHex(actDef.aura) : enemy.tier === 'boss' ? 0xffd34a : null;
      if (auraColor !== null) {
        const auraSize = this.enemySprite.displayHeight * (enemy.tier === 'boss' ? 1.25 : 1.05);
        this.enemyAura = this.add.image(enemyX, enemyY - this.enemySprite.displayHeight * .45, 'fx-dot')
          .setDisplaySize(auraSize, auraSize).setTint(auraColor).setAlpha(enemy.tier === 'normal' ? .28 : .42)
          .setBlendMode(Phaser.BlendModes.ADD).setDepth(18);
        this.tweens.add({ targets: this.enemyAura, alpha: (enemy.tier === 'normal' ? .28 : .42) * .55, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      }

      // Crown for boss
      if (enemy.crown) {
        this.crownSprite?.destroy();
        this.crownSprite = this.add.image(
          enemyX,
          enemyY - this.enemySprite.displayHeight - 10,
          'crown'
        );
        this.crownSprite.setScale(0.5).setOrigin(0.5, 0.85);
        this.crownSprite.setDepth(21);
      }
    }

    // Enemy name with rank badge
    if (this.enemyNameText) this.enemyNameText.destroy();

    let rankBadge = '';
    if (enemy.tier === 'elite') {
      rankBadge = 'ELITE ';
    } else if (enemy.tier === 'boss') {
      rankBadge = 'BOSS ';
    }

    this.enemyNameText = this.add
      .text(width / 2, arenaTop + arenaHeight - 42, rankBadge + enemy.name, {
        resolution: getRenderDensity(), fontFamily: 'Lilita One',
        fontSize: '19px',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setStroke('#1B1030', 4)
      .setShadow(0, 2, '#1B1030', 0, true, true)
      .setDepth(30);

    // Enemy HP bar
    if (this.enemyHPBar) this.enemyHPBar.destroy();
    this.enemyHPBar = new HPBar(
      this,
      width / 2,
      arenaTop + arenaHeight - 16,
      230,
      22,
      enemy.maxHp
    );
    this.enemyHPBar.setHp(enemy.hp);
    this.enemyHPBar.setPendingDamage(battle.accumulatedDamage);
    this.enemyHPBar.setDepth(30);

    this.updateIntent(battle);
    this.updateEmotion(battle);
  }


  private getActDef(act: number | undefined): ActDef | undefined {
    return getGameManager().getEnemiesData().acts?.[(act ?? 1) - 1];
  }

  /** Calm / angry / scared from HP and intent (thresholds in enemies.json "emotions"). */
  private updateEmotion(battle: BattleState): void {
    const next = getEmotion(battle.enemy, getGameManager().getEnemiesData().emotions);
    if (next === this.emotion || this.enemyDying) return;
    this.emotion = next;
    this.clearEmote();
    const sprite = this.enemySprite;
    if (!sprite) return;
    sprite.anims.timeScale = next === 'calm' ? 1 : next === 'angry' ? 1.35 : 1.6;
    if (next === 'calm') return;
    const mark = this.add.graphics().setDepth(26);
    if (next === 'angry') {
      // Anime anger vein: four red curved strokes.
      mark.lineStyle(5, 0xff2a3d, 1);
      for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        mark.beginPath(); mark.arc(dx * 9, dy * 9, 7, Math.atan2(-dy, -dx) - .9, Math.atan2(-dy, -dx) + .9); mark.strokePath();
      }
    } else {
      // Sweat drop.
      mark.fillStyle(0x7fd4ff, 1).lineStyle(3, 0x1b1030, 1);
      mark.beginPath(); mark.moveTo(0, -14); mark.lineTo(9, 3); mark.arc(0, 4, 9, 0, Math.PI); mark.lineTo(0, -14); mark.closePath(); mark.fillPath(); mark.strokePath();
    }
    this.emoteMark = mark;
    this.positionEmote();
    this.tweens.add({ targets: mark, scale: { from: 0, to: 1 }, duration: 220, ease: 'Back.out' });
    if (next === 'angry') this.tweens.add({ targets: mark, scale: 1.18, duration: 380, yoyo: true, repeat: -1, delay: 220 });
    else this.tweens.add({ targets: mark, y: '+=6', alpha: .6, duration: 700, yoyo: true, repeat: -1, delay: 220 });
    // Scared enemies shiver; angry ones puff steam.
    this.emoteTimer = window.setInterval(() => {
      if (!this.sys.isActive() || !this.enemySprite || this.enemyDying) return;
      const x = this.enemySprite.x; const top = this.enemySprite.y - this.enemySprite.displayHeight * .8;
      if (this.emotion === 'angry') this.juice.dustPuff(x + Phaser.Math.Between(-20, 20), top, 3, 0xffffff);
      else this.juice.sparkBurst(x + 24, top + 10, 2, 0x7fd4ff);
    }, 900);
  }

  private positionEmote(): void {
    const sprite = this.enemySprite;
    if (!sprite) return;
    const head = sprite.y - sprite.displayHeight * this.enemyHeadTop;
    this.emoteMark?.setPosition(sprite.x + sprite.displayWidth * .2, head + 14);
    this.crownSprite?.setPosition(sprite.x, head + 6);
  }

  private clearEmote(): void {
    if (this.emoteMark) { this.tweens.killTweensOf(this.emoteMark); this.emoteMark.destroy(); this.emoteMark = null; }
    if (this.emoteTimer !== null) { window.clearInterval(this.emoteTimer); this.emoteTimer = null; }
    if (this.enemySprite) this.enemySprite.anims.timeScale = 1;
  }

  private updateIntent(battle: BattleState): void {
    const intent = battle.enemy.intents[battle.enemy.currentIntentIndex];
    this.renderedIntentKey = `${intent?.type}:${intent?.value}`;
    this.intentBubble?.destroy();
    this.intentBubble = null;
    if (intent) {
      this.intentBubble = createIntentBubble(
        this, viewport(this).width / 2 + 80,
        this.layout.arenaTop + 36,
        intent.type, intent.value
      );
      this.intentBubble.setScale(0.72);
      this.intentBubble.setDepth(25);
    }
  }

  private renderTableau(battle: BattleState): void {
    const existing = new Map(this.cardVisuals.map((visual) => [visual.getCard().id, visual]));
    const next: CardVisual[] = [];
    const firstDeal = !this.dealt && battle.turnNumber === 0 && battle.mode !== 'boss';
    this.dealt = true;
    const { tableauTop, cw, strip, side, gap } = this.layout;
    const powers = new Map(battle.powerCards.map((power) => [power.cardId, power.type]));
    this.exposedSlots.clear();

    battle.tableau.forEach((column, colIndex) => {
      column.cards.forEach((card, cardIndex) => {
        const x = side + colIndex * (cw + gap);
        const y = tableauTop + cardIndex * strip;
        const isNew = !existing.has(card.id);
        const visual = existing.get(card.id) ?? new CardVisual(this, x, y, card, powers.get(card.id) ?? null);
        existing.delete(card.id);
        const exposed = cardIndex === column.cards.length - 1;
        const playable = exposed && this.canPlayCard(card, battle);
        visual.setPosition(x, y);
        const state = !exposed ? 'covered' : playable ? 'playable' : 'disabled';
        if (visual.getState() !== state) visual.setState(state);
        const onTap = () => {
          if (this.inputPaused || !this.pointerArmed) return;
          const live = getGameManager().getState()?.battle;
          if (live && isPlayable(live, card.id)) this.onCardClick(card.id);
          else this.rejectCard(visual, exposed);
        };
        visual.setInteractive(onTap);
        if (exposed) this.exposedSlots.set(card.id, { x, y, width: cw, height: this.layout.ch, onTap });
        visual.setDepth((playable ? 60 : 15) + cardIndex);
        if (isNew && firstDeal) {
          const container = visual.getContainer();
          container.setScale(.35).setAlpha(0);
          const g = this.stockGeometry();
          container.setPosition(g.left, g.top);
          // Short deal (≤ ~450ms total); cards are tappable immediately.
          this.tweens.add({ targets: container, x, y, scale: 1, alpha: 1, duration: 240, delay: colIndex * 22 + cardIndex * 14, ease: 'Cubic.out' });
        }
        next.push(visual);
      });
    });
    existing.forEach((visual) => visual.destroy());
    this.cardVisuals = next;
  }

  private canPlayCard(card: Card, battle: BattleState): boolean {
    return isPlayable(battle, card.id);
  }

  private renderActiveCard(battle: BattleState): void {
    if (this.activeCardVisual?.getCard().id === battle.activeCard?.id) return;
    if (this.activeCardVisual) {
      this.activeCardVisual.destroy();
      this.activeCardVisual = null;
    }
    if (this.activeLabel) {
      this.activeLabel.destroy();
      this.activeLabel = null;
    }

    if (!battle.activeCard) return;

    const { trayTop, activeW, activeH, activeScale } = this.layout;
    const width = viewport(this).width;

    // Position active card in center of tray, slightly right of center
    const activeX = width * 0.76;
    const activeY = trayTop + 12 + activeH / 2;

    // Get power type if any
    const powerCard = battle.powerCards.find((pc) => pc.cardId === battle.activeCard!.id);
    const powerType = powerCard?.type || null;

    this.activeCardVisual = new CardVisual(this, activeX - activeW / 2, activeY - activeH / 2, battle.activeCard, powerType);
    this.activeCardVisual.setState('active');
    this.activeCardVisual.getContainer().setScale(activeScale);
    this.activeCardVisual.setDepth(55);

    // Active rule hint — power state overrides base rank rule.
    const labelY = activeY + activeH / 2 + 12;
    this.activeLabel = this.add
      .text(activeX, labelY, battle.wildActive ? 'WILD · ANY CARD' : battle.activeCard?.joker === 'red' ? 'RED · RED NEXT' : battle.activeCard?.joker === 'black' ? 'BLACK · BLACK NEXT' : 'ACTIVE · ±1', {
        resolution: getRenderDensity(), fontFamily: 'Fredoka',
        fontSize: '11px',
        color: '#9a8aba',
      })
      .setOrigin(0.5)
      .setDepth(55);
  }

  private updateComboBanner(battle: BattleState): void {
    const chainLength = battle.chain.length;
    const damage = battle.accumulatedDamage;

    if (chainLength > 0) {
      this.comboBanner.update(chainLength, damage);
    } else {
      this.comboBanner.update(0, 0);
    }
    this.activeLabel?.setText(battle.wildActive ? 'WILD · ANY CARD' : battle.activeCard?.joker === 'red' ? 'RED · RED NEXT' : battle.activeCard?.joker === 'black' ? 'BLACK · BLACK NEXT' : 'ACTIVE · ±1');
  }

  private updateDrawPile(battle: BattleState): void {
    const count = battle.deck.length;
    this.stockBacks.forEach((back, i) => back.setVisible(count > 2 - i));
    this.stockEmpty.setVisible(count === 0);
    this.stockBadge.setText(String(count));
    this.stockBadgeBg.setFillStyle(count === 0 ? 0x6b5a8a : 0xff3b4e);
    const g = this.stockGeometry();
    const topOffset = Math.min(2, Math.max(0, count - 1)) * 2;
    this.stockBadgeBg.setPosition(g.left + g.w - 2 - topOffset, g.top + 2 - topOffset);
    this.stockBadge.setPosition(this.stockBadgeBg.x, this.stockBadgeBg.y);
    const intent = battle.enemy.intents[battle.enemy.currentIntentIndex];
    const ready = battle.chain.length >= MIN_ATTACK_CHAIN;
    const verb = battle.chain.length ? 'TAP DECK · END TURN' : count ? 'TAP DECK · DRAW' : 'TAP DECK · PASS';
    const enemy = ready ? 'Enemy skips turn' : intent.type === 'attack' ? `Enemy hits ${intent.value}` : `Enemy: ${intent.type}`;
    this.stockLabel.setText(`${verb}\nChain ${battle.chain.length}/${MIN_ATTACK_CHAIN}\n${enemy}`);
    this.stockLabel.setColor(ready ? '#9effc0' : '#e1e6ff');
    this.setUndoEnabled(getGameManager().canUndo());
  }

  private updatePlayerHUD(state: RunState): void {
    this.playerHPBar.setHp(this.heldPlayerHp ?? state.player.hp, state.player.maxHp);
    this.goldText.setText(`${state.player.gold}`);
    this.armorText.setText(`ARMOR ${state.player.armor}`);
    const relics = state.player.relics;
    this.buildText.setText(relics.length ? `BUILD · ${relics.length} RELICS · TAP TO VIEW` : 'BUILD · RELICS AFTER EACH VICTORY');
  }

  private onCardClick(cardId: string): void {
    if (this.inputPaused) return;
    AudioSystem.unlock();
    const visual = this.cardVisuals.find((item) => item.getCard().id === cardId);
    if (!visual) return;
    const bounds = visual.getWorldBounds();
    const result = getGameManager().playCard(cardId);
    if (!result?.events.length) return;
    // Logic and autosave commit immediately; animation only presents the accepted action.
    const card = visual.getCard();
    const power = this.currentState?.battle?.powerCards.find((item) => item.cardId === cardId)?.type ?? null;
    const flying = new CardVisual(this, bounds.x, bounds.y, card, power);
    this.inputPaused = true;
    this.refreshState();
    flying.setDepth(180);
    this.activeCardVisual?.getContainer().setVisible(false);
    this.handleEvents(result.events);
    const moving = flying.getContainer();
    const destinationX = viewport(this).width * 0.76 - this.layout.activeW / 2;
    const destinationY = this.layout.trayTop + 12;
    const J = JUICE.cards;
    const played = result.events.find((item) => item.type === 'card_played') as { damage: number; chainPosition: number } | undefined;
    const tint = card.joker ? (card.joker === 'red' ? 0xff557c : 0xb795ff) : power ? POWER_TINTS[power] : 0xffe7a0;
    const special = !!(power || card.joker);
    const { cw, ch, activeScale, activeW, activeH } = this.layout;
    // 1) Anticipation lift.
    this.tweens.add({ targets: moving, y: bounds.y - J.liftPx, angle: -J.rotateDeg * 0.5, scale: J.liftScale, duration: J.liftMs, ease: 'Quad.out', onComplete: () => {
      // 2) Arc flight with rotation and trail.
      const path = new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(moving.x, moving.y), new Phaser.Math.Vector2((moving.x + destinationX) / 2 + 20, Math.min(moving.y, destinationY) - J.flightArcPx), new Phaser.Math.Vector2(destinationX, destinationY));
      const progress = { t: 0 };
      const point = new Phaser.Math.Vector2();
      this.juice.startTrail(moving, cw / 2, ch / 2, tint);
      this.tweens.add({ targets: progress, t: 1, duration: J.flightMs, ease: 'Sine.inOut', onUpdate: () => {
        path.getPoint(progress.t, point);
        const t = progress.t;
        moving.setPosition(point.x, point.y).setAngle(-J.rotateDeg * 0.5 + J.rotateDeg * Math.sin(t * Math.PI) * 0.9 - J.rotateDeg * 0.5 * t).setScale(J.liftScale + (activeScale - J.liftScale) * t);
      }, onComplete: () => {
        this.juice.stopTrail();
        flying.destroy();
        // 3) Landing squash + dust/glow.
        const active = this.activeCardVisual?.getContainer();
        if (active) {
          active.setVisible(true).setScale(activeScale * (1 + J.landSquash), activeScale * (1 - J.landSquash));
          this.tweens.add({ targets: active, scaleX: activeScale, scaleY: activeScale, duration: J.landMs, ease: 'Back.out' });
        }
        const cx = destinationX + activeW / 2;
        this.juice.dustPuff(cx, destinationY + activeH, J.dustCount, special ? tint : 0xfff3d0);
        if (special) {
          this.juice.ring(cx, destinationY + activeH / 2, tint, 3, 340, 5);
          this.juice.sparkBurst(cx, destinationY + activeH / 2, 14, tint);
        } else {
          this.cardBurst(cx, destinationY + activeH / 2, 0xffdf70);
        }
        // 4) Routine hit feedback on the enemy: the chain is charging up.
        if (played && played.damage > 0) this.playChargeFeedback(played.damage, played.chainPosition);
        const ended = getGameManager().getState()?.phase !== 'battle';
        const handle = window.setTimeout(() => { if (!this.sys.isActive()) return; this.inputPaused = false; this.checkPhaseTransition(); }, ended ? 1400 : 110);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => window.clearTimeout(handle));
      } });
    } });
  }

  /** Routine tier: small number + flinch while a chain builds (damage lands on END TURN). */
  private playChargeFeedback(damage: number, chainPosition: number): void {
    const x = viewport(this).width / 2;
    const y = this.enemyBaseY - this.layout.enemyHeight * 0.55;
    this.juice.damageNumber(x + Phaser.Math.Between(-30, 30), y, damage, { small: true, prefix: '+', size: JUICE.numbers.routineSize + Math.min(10, chainPosition), color: '#fff1a8' });
    this.juice.shake(JUICE.shake.routine.intensity + chainPosition * 0.0003, JUICE.shake.routine.ms);
    const sprite = this.enemySprite;
    if (sprite && !this.enemyDying) {
      const baseX = viewport(this).width / 2;
      const px = JUICE.enemy.routineFlinchPx + Math.min(4, chainPosition * 0.5);
      this.tweens.add({ targets: sprite, x: baseX + px, duration: 40, yoyo: true, ease: 'Sine.inOut', onComplete: () => sprite.setX(baseX) });
      this.juice.sparkBurst(x, y + 10, 4 + Math.min(8, chainPosition), 0xffe08a);
    }
  }

  private onDrawClick(): void {
    if (this.inputPaused) return;
    AudioSystem.unlock();
    const before = getGameManager().getState();
    const result = getGameManager().draw();
    if (!result || result.state === before) return;
    this.inputPaused = true;
    AudioSystem.play('card_draw');
    const chain = before?.battle?.chain ?? [];
    const powers = before?.battle?.powerCards ?? [];
    this.chainHadCrit = chain.some((c) => c.joker === 'black' || powers.some((p) => p.cardId === c.id && p.type === 'CRIT'));
    const attacked = result.events.some((e) => e.type === 'enemy_attacked');
    this.heldPlayerHp = attacked && before ? before.player.hp : null;
    this.refreshState();
    this.handleEvents(result.events);
    const active = this.activeCardVisual?.getContainer();
    if (active && result.state.battle) {
      const targetX = active.x;
      const targetY = active.y;
      const g = this.stockGeometry();
      active.setPosition(g.left, g.top).setAlpha(0.6).setAngle(-12).setScale(this.layout.activeScale * .9);
      this.tweens.add({ targets: active, x: targetX, y: targetY, alpha: 1, angle: 0, scale: this.layout.activeScale, duration: 280, ease: 'Back.out' });
    }
    // Unlock on a real-time timer (not the game clock, which can stretch after slow frames).
    const unlock = () => { if (!this.sys.isActive()) return; this.inputPaused = false; this.checkPhaseTransition(); };
    const died = result.events.some((e) => e.type === 'enemy_died');
    const handle = window.setTimeout(unlock, result.state.phase === 'battle' ? (attacked ? 900 : 520) : died ? 1500 : 1100);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => window.clearTimeout(handle));
  }

  private onUndoClick(): void {
    if (this.inputPaused) return;
    AudioSystem.unlock();
    const manager = getGameManager();
    if (!manager.canUndo()) {
      AudioSystem.play('invalid_tap', { volume: .35 });
      if (this.undoButton) { const b = this.undoButton; const x = b.x; this.tweens.add({ targets: b, x: x + 4, duration: 40, yoyo: true, repeat: 1, onComplete: () => b.setX(x) }); }
      return;
    }
    // Where the card currently sits (active slot) before the state is reverted.
    const fromX = viewport(this).width * 0.76 - this.layout.activeW / 2;
    const fromY = this.layout.trayTop + 12;
    const result = manager.undo();
    if (!result) return;
    const event = result.events.find((item) => item.type === 'undo_applied') as { cardId: string | null } | undefined;
    this.refreshState();
    AudioSystem.play('card_draw', { pitchShift: -0.15, volume: .7 });
    // Short reverse tween: the undone card slides from the active slot back to its column.
    const visual = event?.cardId ? this.cardVisuals.find((item) => item.getCard().id === event.cardId) : undefined;
    if (visual) {
      const container = visual.getContainer();
      const toX = container.x;
      const toY = container.y;
      container.setPosition(fromX, fromY).setScale(this.layout.activeScale).setAngle(6);
      this.tweens.add({ targets: container, x: toX, y: toY, scale: 1, angle: 0, duration: 170, ease: 'Cubic.out' });
    }
  }

  private handleEvents(events: Array<{ type: string; [key: string]: unknown }>): void {
    for (const event of events) {
      switch (event.type) {
        case 'card_played':
          AudioSystem.playCardSound((event.chainPosition as number) || 1);
          break;
        case 'enemy_staggered':
          playCombatVFX(this, 'stagger', viewport(this).width / 2, this.enemyBaseY - this.layout.enemyHeight - 8, 84);
          this.cardBurst(viewport(this).width / 2, this.enemyBaseY - 40, 0x69d6ff);
          break;
        case 'enemy_attacked': {
          const damage = event.damage as number;
          const blocked = event.blocked as number;
          // Let a chain hit land first, then the enemy answers.
          const hitFirst = events.some((e) => e.type === 'chain_resolved');
          this.time.delayedCall(hitFirst ? 380 : 0, () => this.playEnemyAttackAnimation(damage, blocked));
          break;
        }
        case 'enemy_died':
          playCombatVFX(this, 'smoke', viewport(this).width / 2, this.enemyBaseY - this.layout.enemyHeight * .4, 140, 0xcfc2ff);
          this.enemyHPBar.setPendingDamage(0);
          this.enemyHPBar.setHp(0, this.lastEnemyMaxHp);
          this.playEnemyDeathAnimation();
          AudioSystem.play('enemy_death');
          break;
        case 'chain_resolved':
          this.playChainHit(event.totalDamage as number, event.chainLength as number, events.some((e) => e.type === 'enemy_died'));
          AudioSystem.play('enemy_hit');
          break;
        case 'power_activated':
          AudioSystem.playPower(event.powerType as PowerType);
          this.playPowerEffect(event.powerType as PowerType);
          break;
        case 'joker_activated':
          AudioSystem.playPower(event.color === 'red' ? 'RED_JOKER' : 'BLACK_JOKER');
          this.playPowerEffect(event.color === 'red' ? 'RED_JOKER' : 'BLACK_JOKER');
          break;
        case 'armor_gained':
          AudioSystem.play('shield');
          break;
        case 'battle_won':
          AudioSystem.play('victory');
          break;
        case 'battle_lost':
          AudioSystem.play('defeat');
          break;
      }
    }
  }

  private startEnemyIdle(): void {
    if (!this.enemySprite || this.enemyDying) return;
    this.tweens.killTweensOf(this.enemySprite);
    this.enemySprite.setY(this.enemyBaseY).setAngle(0).setScale(this.enemyScale).setAlpha(1);
    this.tweens.add({ targets: this.enemySprite, scaleX: this.enemyScale * 1.035, scaleY: this.enemyScale * .965, y: this.enemyBaseY - 4, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    if (this.enemyShadow) {
      this.tweens.killTweensOf(this.enemyShadow);
      this.tweens.add({ targets: this.enemyShadow, scaleX: .9, alpha: .3, duration: 900, yoyo: true, repeat: -1 });
    }
  }

  private playEnemyAttackAnimation(damage = 0, blocked = 0): void {
    const sprite = this.enemySprite;
    if (!sprite || this.enemyDying) { this.releasePlayerHp(); return; }
    this.tweens.killTweensOf(sprite);
    sprite.play(`${this.enemyKey}-attack`, true);
    this.tweens.add({ targets: sprite, y: this.enemyBaseY - 18, angle: -7, duration: 130, ease: 'Quad.out', onComplete: () => {
      this.tweens.add({ targets: sprite, y: this.enemyBaseY + 16, angle: 7, scaleX: this.enemyScale * 1.12, scaleY: this.enemyScale * .92, duration: 110, ease: 'Cubic.in', onComplete: () => {
        this.onPlayerHit(damage, blocked);
        playCombatVFX(this, 'slash', 76, this.layout.playerHudTop + 15, 94, 0xff606f, 35);
        this.cardBurst(viewport(this).width / 2, this.layout.arenaTop + this.layout.arenaHeight - 70, 0xff6655);
        this.tweens.add({ targets: sprite, y: this.enemyBaseY, angle: 0, scale: this.enemyScale, duration: 240, onComplete: () => { sprite.play(`${this.enemyKey}-idle`); this.startEnemyIdle(); } });
      } });
    } });
  }

  /** Player getting hit: red vignette, screen shake, HP bar shake, number. */
  private onPlayerHit(damage: number, blocked: number): void {
    AudioSystem.play('player_hit');
    const taken = Math.max(0, damage - blocked);
    const s = JUICE.shake;
    this.releasePlayerHp();
    if (taken > 0) {
      this.juice.vignetteFlash();
      this.juice.shake(Math.min(s.max, s.playerBase + taken * s.playerPerDamage), s.playerMs);
      this.playerHPBar.shake();
      this.juice.damageNumber(110, this.layout.playerHudTop + 34, taken, { prefix: '-', color: JUICE.numbers.playerHitColor, size: 26 + Math.min(16, taken) });
    } else {
      this.juice.shake(s.routine.intensity * 2, s.routine.ms);
    }
    if (blocked > 0) {
      playCombatVFX(this, 'shield', viewport(this).width - 60, this.layout.playerHudTop + 15, 70);
      this.juice.damageNumber(viewport(this).width - 60, this.layout.playerHudTop + 34, blocked, { prefix: '⛨ ', color: '#9ccfff', size: 20 });
    }
  }

  private releasePlayerHp(): void {
    if (this.heldPlayerHp === null) return;
    this.heldPlayerHp = null;
    const state = getGameManager().getState();
    if (state) this.playerHPBar.setHp(state.player.hp, state.player.maxHp);
  }

  /**
   * Every chain-resolve hit: hit-stop, camera shake, white flash, knockback/squash,
   * sparks at the hit point, big punchy number; escalates with damage and chain length
   * up to a finisher (slow-mo, screen flash, bigger burst).
   */
  private playChainHit(damage: number, chainLength: number, killing: boolean): void {
    const tier = classifyHit(damage, chainLength, this.lastEnemyMaxHp, killing);
    if (killing) { this.enemyHPBar.setPendingDamage(0); this.enemyHPBar.setHp(0, this.lastEnemyMaxHp); }
    const width = viewport(this).width;
    const x = width / 2;
    const y = this.enemyBaseY - this.layout.enemyHeight * 0.45;
    const S = JUICE.shake;
    const E = JUICE.enemy;
    const P = JUICE.sparks;
    this.juice.hitStop(killing ? JUICE.hitStop.deathMs : hitStopMs(damage, tier));
    this.juice.shake(shakeIntensity(damage, chainLength), tier === 'finisher' ? S.finisherMs : tier === 'big' ? S.bigMs : S.hitMs);
    playCombatVFX(this, 'slash', x, y, Math.min(195, this.layout.arenaHeight * .75), tier !== 'routine' ? 0xffb43b : undefined, -20);
    const sprite = this.enemySprite;
    if (sprite && !this.enemyDying) {
      this.juice.flashWhite(sprite, E.flashMs, this.enemyBaseTint ?? undefined);
      // Hurt animation state, then back to idle.
      const hurtKey = `${this.enemyKey}-hurt`;
      if (!killing && this.anims.exists(hurtKey)) {
        sprite.play(hurtKey, true);
        sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => { if (sprite.active && !this.enemyDying) sprite.play(`${this.enemyKey}-idle`, true); });
      }
      const kb = Math.min(E.knockbackMax, E.knockbackPx + damage * E.knockbackPerDamage);
      const sq = E.squash * (tier === 'routine' ? 0.6 : tier === 'big' ? 1 : 1.4);
      this.tweens.killTweensOf(sprite);
      sprite.setX(x);
      this.tweens.add({ targets: sprite, x: x + kb, scaleX: this.enemyScale * (1 - sq), scaleY: this.enemyScale * (1 + sq), duration: E.knockbackMs, ease: 'Quad.out', onComplete: () => {
        if (!sprite.active || this.enemyDying) return;
        this.tweens.add({ targets: sprite, x, scaleX: this.enemyScale, scaleY: this.enemyScale, duration: E.recoverMs, ease: 'Back.out', onComplete: () => this.startEnemyIdle() });
      } });
    }
    const sparks = Math.min(P.max, P.base + damage * P.perDamage) + (tier === 'finisher' ? P.finisherExtra : 0);
    this.juice.sparkBurst(x, y, sparks, tier === 'finisher' ? 0xfff0a0 : 0xffd27a);
    if (tier !== 'routine') this.juice.shardBurst(x, y, tier === 'finisher' ? 18 : 9, 0xffffff);
    this.juice.ring(x, y, tier === 'finisher' ? 0xfff3b0 : 0xffc65a, tier === 'finisher' ? 5 : 3.2, 360, tier === 'finisher' ? 6 : 4);
    this.juice.damageNumber(x, this.layout.arenaTop + this.layout.arenaHeight * 0.36, damage, { chain: chainLength, crit: this.chainHadCrit });
    if (tier === 'finisher') {
      const hold = killing ? JUICE.hitStop.deathMs : JUICE.hitStop.finisherMs;
      window.setTimeout(() => { if (this.sys.isActive()) this.juice.slowMo(); }, hold);
      this.juice.screenFlash();
      window.setTimeout(() => { if (this.sys.isActive()) this.juice.ring(x, y, 0xffffff, 6, 520, 3); }, 60);
    }
  }

  private playEnemyDeathAnimation(): void {
    const sprite = this.enemySprite;
    if (!sprite) return;
    this.enemyDying = true;
    this.tweens.killTweensOf(sprite);
    sprite.play(`${this.enemyKey}-dead`, true);
    this.juice.flashWhite(sprite, 110, this.enemyBaseTint ?? undefined);
    this.clearEmote();
    for (const extra of [this.enemyAura, this.crownSprite]) if (extra) { this.tweens.killTweensOf(extra); this.tweens.add({ targets: extra, alpha: 0, duration: 300 }); }
    const ms = JUICE.death.fallMs;
    this.tweens.add({ targets: sprite, y: this.enemyBaseY + 20, angle: 22, alpha: 0, scaleY: this.enemyScale * .4, duration: ms, delay: 120, ease: 'Cubic.in' });
    if (this.enemyShadow) this.tweens.add({ targets: this.enemyShadow, alpha: 0, scaleX: .3, duration: ms, delay: 120 });
    // Coin burst flying to the gold counter.
    const width = viewport(this).width;
    const fromY = this.enemyBaseY - this.layout.enemyHeight * 0.45;
    const goldX = width * 0.58 + 6;
    const goldY = this.layout.hudTop + this.layout.hudHeight / 2;
    window.setTimeout(() => {
      if (!this.sys.isActive()) return;
      this.juice.sparkBurst(width / 2, fromY, 30, 0xffe9a0);
      this.juice.coinBurst(width / 2, fromY, goldX, goldY, JUICE.death.coinCount, () => {
        if (!this.goldText?.active) return;
        this.tweens.killTweensOf(this.goldText);
        this.goldText.setScale(1.35);
        this.tweens.add({ targets: this.goldText, scale: 1, duration: 120, ease: 'Quad.out' });
      });
    }, 160);
  }

  private rejectCard(visual: CardVisual, exposed: boolean): void {
    if (this.time.now - this.lastShake < 220) return;
    this.lastShake = this.time.now;
    AudioSystem.unlock(); AudioSystem.play('invalid_tap', { volume: .45 });
    const container = visual.getContainer();
    const x = container.x;
    this.tweens.killTweensOf(container);
    this.tweens.add({ targets: container, x: x + 5, angle: 3, duration: 40, yoyo: true, repeat: 2, onComplete: () => container.setX(x).setAngle(0) });
    const hint = this.add.text(viewport(this).width / 2, this.layout.bannerTop + 16, exposed ? 'Choose ±1 from the active card' : 'Use the bottom card of a column', { resolution: getRenderDensity(), fontFamily: 'Fredoka', fontSize: '13px', color: '#ff8585', backgroundColor: '#211740', padding: { x: 8, y: 4 } }).setOrigin(.5).setDepth(200);
    this.tweens.add({ targets: hint, alpha: 0, duration: 200, delay: 700, onComplete: () => hint.destroy() });
  }

  private cardBurst(x: number, y: number, color: number): void {
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4;
      const spark = this.add.star(x, y, 4, 2, 5, color).setDepth(180);
      this.tweens.add({ targets: spark, x: x + Math.cos(angle) * 30, y: y + Math.sin(angle) * 25, alpha: 0, scale: .1, angle: 90, duration: 270, onComplete: () => spark.destroy() });
    }
  }

  private playPowerEffect(power: PowerType | 'RED_JOKER' | 'BLACK_JOKER'): void {
    const x = viewport(this).width / 2;
    const y = this.enemyBaseY - this.layout.enemyHeight * .5;
    const themes: Record<typeof power, { color: number; symbol: string; text: string }> = {
      CRIT: { color: 0xff6633, symbol: '⚔', text: 'CRITICAL ×3' },
      HEAL: { color: 0x3aef98, symbol: '♥', text: 'HEAL' },
      GUARD: { color: 0x50bfff, symbol: '⬡', text: 'GUARD' },
      GOLD: { color: 0xffd34a, symbol: '🪙', text: 'GOLD' },
      BOMB: { color: 0xff9a30, symbol: '✹', text: 'BOMB' },
      WILD: { color: 0x80eaff, symbol: '🃏', text: 'WILD · ANY CARD' },
      ECHO: { color: 0xc58aff, symbol: '◎', text: 'ECHO +2' },
      RED_JOKER: { color: 0xff557c, symbol: '♥', text: 'LIFESTEAL 30%' },
      BLACK_JOKER: { color: 0xb795ff, symbol: '♛', text: 'CHAIN CRIT ×5' },
    };
    const theme = themes[power];
    const arenaSize = Math.min(180, this.layout.arenaHeight * .7);
    if (power === 'CRIT' || power === 'BLACK_JOKER') {
      playCombatVFX(this, 'slash', x, y, arenaSize, power === 'CRIT' ? 0xffad57 : 0xc2a2ff, -30);
      this.time.delayedCall(100, () => playCombatVFX(this, 'slash', x, y, arenaSize, theme.color, 35));
    } else if (power === 'HEAL' || power === 'RED_JOKER') {
      playCombatVFX(this, 'heal', 76, this.layout.playerHudTop + 15, 88, power === 'RED_JOKER' ? 0xff608a : undefined);
    } else if (power === 'GUARD') {
      playCombatVFX(this, 'shield', viewport(this).width - 60, this.layout.playerHudTop + 15, 76);
    } else if (power === 'GOLD') {
      playCombatVFX(this, 'reward', viewport(this).width * .58, this.layout.hudTop + 20, 80);
    } else if (power === 'WILD') {
      playCombatVFX(this, 'magic', viewport(this).width * .76, this.layout.trayTop + this.layout.activeH / 2, 96);
    } else if (power === 'ECHO') {
      playCombatVFX(this, 'slash', x, y, arenaSize, 0xc58aff, 20);
      this.time.delayedCall(140, () => playCombatVFX(this, 'slash', x, y, arenaSize, 0xc58aff, -20));
    } else if (power === 'BOMB') {
      playCombatVFX(this, 'smoke', x, y, arenaSize, 0xffb86a);
    }
    const hex = '#' + theme.color.toString(16).padStart(6, '0');
    const label = this.add.text(x, this.layout.arenaTop + 70, theme.text, { resolution: getRenderDensity(), fontFamily: 'Lilita One', fontSize: '23px', color: hex }).setOrigin(.5).setStroke('#1b1030', 5).setDepth(190);
    label.setScale(.6);
    this.tweens.add({ targets: label, scale: 1, duration: 170, ease: 'Back.out' });
    this.tweens.add({ targets: label, y: label.y - 20, alpha: 0, delay: 450, duration: 300, onComplete: () => label.destroy() });
    if (power === 'CRIT' || power === 'BLACK_JOKER') {
      [-1, 1].forEach(direction => {
        const slash = this.add.rectangle(x, y, 7, this.layout.enemyHeight * .7, theme.color).setRotation(direction * .75).setDepth(180);
        this.tweens.add({ targets: slash, scaleY: 1.4, scaleX: 0, alpha: 0, duration: 240, onComplete: () => slash.destroy() });
      });
    } else if (power === 'BOMB' || power === 'ECHO') {
      for (let i = 0; i < 3; i++) {
        const ring = this.add.circle(x, y, 12, theme.color, .12).setStrokeStyle(3, theme.color).setDepth(180);
        this.tweens.add({ targets: ring, scale: power === 'BOMB' ? 5 : 4, alpha: 0, duration: 420, delay: i * 75, onComplete: () => ring.destroy() });
      }
      if (power === 'BOMB') this.cameras.main.shake(140, .004);
    } else if (power === 'WILD') {
      const bolt = this.add.graphics().lineStyle(5, theme.color).setDepth(180);
      bolt.beginPath(); bolt.moveTo(x + 12, y - 40); bolt.lineTo(x - 12, y); bolt.lineTo(x + 12, y); bolt.lineTo(x - 12, y + 40); bolt.strokePath();
      this.tweens.add({ targets: bolt, alpha: 0, duration: 380, onComplete: () => bolt.destroy() });
    } else {
      for (let i = 0; i < 5; i++) {
        const icon = power === 'GOLD'
          ? this.add.image(x + (i - 2) * 14, y, 'coin').setDisplaySize(20, 20)
          : this.add.text(x + (i - 2) * 14, y, theme.symbol, { resolution: getRenderDensity(), fontSize: '24px', color: hex }).setOrigin(.5);
        icon.setDepth(180);
        const destinationX = power === 'GOLD' ? viewport(this).width * .58 : power === 'GUARD' ? viewport(this).width - 30 : 76;
        this.tweens.add({ targets: icon, x: destinationX, y: this.layout.playerHudTop + 15, alpha: 0, delay: i * 40, duration: 500, ease: 'Cubic.in', onComplete: () => icon.destroy() });
      }
    }
    this.cardBurst(x, y, theme.color);
  }

  private checkPhaseTransition(): void {
    const manager = getGameManager();
    const state = manager.getState();
    if (!state) return;

    switch (state.phase) {
      case 'reward':
        this.scene.launch('RewardScene');
        this.scene.pause();
        break;
      case 'victory':
      case 'defeat':
        this.scene.launch('EndScene');
        this.scene.pause();
        break;
    }
  }

  private handleResize(): void {
    // Dimensions change card geometry and hit zones; rebuild once for resize,
    // never for a game action. Phaser tears down the old display list.
    this.scene.restart();
  }

  shutdown(): void {
    this.scale.off('resize', this.handleResize, this);
    this.input.off(Phaser.Input.Events.POINTER_DOWN, this.armPointer, this);
    this.input.off(Phaser.Input.Events.POINTER_UP, this.onScenePointerUp, this);
    this.exposedSlots.clear();
    this.stockBacks = [];
    this.undoButton = null;
    setTestHook(null);
    this.cardVisuals = [];
    this.activeCardVisual = null;
    this.activeLabel = null;
    this.enemySprite = null;
    this.enemyShadow = null;
    this.crownSprite = null;
    this.clearEmote();
    this.enemyAura = null;
    this.emotion = 'calm';
    this.intentBubble = null;
    this.buildPanel?.destroy();
    this.buildPanel = null;
    this.currentState = null;
    this.renderedEnemyId = null;
    this.renderedIntentKey = null;
    this.inputPaused = false;
    if (this.settingsModal) {
      this.settingsModal.destroy();
      this.settingsModal = null;
    }
  }
}
