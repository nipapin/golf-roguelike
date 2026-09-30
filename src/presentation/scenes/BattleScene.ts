import { playCombatVFX } from '../design/CombatVFX';
import { viewport, configureViewport, getRenderDensity } from '../design/viewport';
import Phaser from 'phaser';
import { getGameManager, setTestHook } from '../GameManager';
import { colors, getLayoutMetrics, getCardMetrics } from '../design/tokens';
import { ArenaBackground, getEncounterForEnemy } from '../design/ArenaBackground';
import { HPBar, ComboBanner, createIntentBubble } from '../design/HudComponents';
import { CardVisual } from '../design/CardVisual';
import { showBuildPanel } from '../design/BuildPanel';
import { SettingsModal } from '../design/SettingsModal';
import { showRules, hasSeenRules } from '../design/RulesPopup';
import { isPlayable, MIN_ATTACK_CHAIN } from '../../core/GameRules';
import { AudioSystem } from '../audio/AudioSystem';
import type { RunState, Card, BattleState, PowerType } from '../../core/types';

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
  private turnHint!: Phaser.GameObjects.Text;
  private drawText!: Phaser.GameObjects.Text;
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

    // Draw pile
    this.createDrawPile();

    // Initial render
    this.dealt = false;
    this.enemyDying = false;
    AudioSystem.setMusicScene('battle');
    this.refreshState();
    if (hasSeenRules()) { this.inputPaused = true; this.time.delayedCall(650, () => { this.inputPaused = false; }); }
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

  private setupTestHook(): void {
    setTestHook({
      isActive: true,
      getPlayableCards: () => {
        return this.cardVisuals
          .filter((cv) => cv.getState() === 'playable')
          .map((cv) => ({
            cardId: cv.getCard().id,
            bounds: cv.getWorldBounds(),
          }));
      },
      getDrawPileBounds: () => {
        if (!this.drawPile) return { x: 0, y: 0, width: 0, height: 0 };
        return {
          x: 12,
          y: this.layout.trayTop + 14,
          width: viewport(this).width * 0.46,
          height: this.layout.trayHeight - 28,
        };
      },
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
    this.topHUD = this.add.container(0, hudTop).setDepth(100);
    const bg = this.add.rectangle(width / 2, hudHeight / 2, width - 16, hudHeight, 0x21163a).setStrokeStyle(1, 0x654581);
    const progress = this.add.text(16, hudHeight / 2, `FIGHT ${manager.getCurrentFightNumber()} / ${manager.getTotalFights()}`, {
      resolution: getRenderDensity(), fontFamily: 'Fredoka', fontSize: '14px', fontStyle: 'bold', color: '#fff3d1',
    }).setOrigin(0, 0.5);
    const coin = this.add.image(width * 0.58 - 20, hudHeight / 2, 'coin').setDisplaySize(24, 24);
    this.goldText = this.add.text(width * 0.58 + 6, hudHeight / 2, '0', {
      resolution: getRenderDensity(), fontFamily: 'Fredoka', fontSize: '16px', color: '#ffd267',
    }).setOrigin(0.5);
    const settings = this.add.rectangle(width - 30, hudHeight / 2, 40, 36, 0x3d2c66).setInteractive();
    settings.on('pointerup', () => { AudioSystem.unlock(); this.openSettings(); });
    const gear = this.add.text(width - 30, hudHeight / 2, '⚙', { resolution: getRenderDensity(), fontSize: '22px', color: '#fff' }).setOrigin(0.5);
    this.topHUD.add([bg, progress, coin, this.goldText, settings, gear]);
    const build = this.add.rectangle(width / 2, relicTop + 14, width - 24, 26, 0x352353).setDepth(100).setInteractive();
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
    const { tableTop, safeBottom } = this.layout;
    const width = viewport(this).width;
    const height = viewport(this).height;

    this.tableBackground = this.add.graphics();
    this.tableBackground.setDepth(10);

    // Felt gradient - extends to bottom of screen minus safe area
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
      height - tableTop - safeBottom + 10,
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

  private createDrawPile(): void {
    const { trayTop, trayHeight } = this.layout;
    const width = viewport(this).width;
    const buttonWidth = width * 0.46;
    const buttonHeight = trayHeight - 28;
    this.drawPile = this.add.container(12 + buttonWidth / 2, trayTop + 14 + buttonHeight / 2).setDepth(55);
    const bg = this.add.rectangle(0, 0, buttonWidth, buttonHeight, 0x31559a).setStrokeStyle(2, 0x9aafe0);
    this.drawText = this.add.text(0, -10, 'DRAW', {
      resolution: getRenderDensity(), fontFamily: 'Lilita One', fontSize: '20px', color: '#ffffff',
    }).setOrigin(0.5);
    this.turnHint = this.add.text(0, 16, 'Enemy turn', {
      resolution: getRenderDensity(), fontFamily: 'Fredoka', fontSize: '11px', color: '#e1e6ff', align: 'center',
    }).setOrigin(0.5);
    this.drawPile.add([bg, this.drawText, this.turnHint]);
    this.drawPile.setInteractive(new Phaser.Geom.Rectangle(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight), Phaser.Geom.Rectangle.Contains);
    this.drawPile.on('pointerup', () => this.onDrawClick());
  }

  private refreshState(): void {
    const manager = getGameManager();
    const state = manager.getState();
    if (!state) return;

    const previousState = this.currentState;
    this.currentState = state;

    // Update arena background based on enemy
    if (state.battle) {
      const encounter = getEncounterForEnemy(state.battle.enemy.sprite || 'goblin');
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
      this.enemyHPBar.setHp(enemy.hp, enemy.maxHp);
      this.enemyHPBar.setPendingDamage(battle.accumulatedDamage);
      if (this.renderedIntentKey !== intentKey) {
        this.updateIntent(battle);
      }
      return;
    }
    this.renderedEnemyId = enemy.id;
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
      const scale = baseScale * (enemy.scale || 1);
      
      this.enemySprite.setScale(scale);
      this.enemySprite.setDepth(20);
      this.enemyKey = enemy.sprite || 'goblin';
      this.enemyScale = scale;
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

      // Boss gold tint
      if (enemy.tint === 'gold') {
        this.enemySprite.setTint(0xffd700);
      }

      // Crown for boss
      if (enemy.crown) {
        if (this.crownSprite) this.crownSprite.destroy();
        this.crownSprite = this.add.image(
          enemyX,
          enemyY - this.enemySprite.displayHeight - 10,
          'crown'
        );
        this.crownSprite.setScale(0.5);
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
    const firstDeal = !this.dealt;
    this.dealt = true;
    const { tableauTop, cw, strip, side, gap } = this.layout;
    const powers = new Map(battle.powerCards.map((power) => [power.cardId, power.type]));

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
        visual.setInteractive(() => {
          if (this.inputPaused) return;
          const live = getGameManager().getState()?.battle;
          if (live && isPlayable(live, card.id)) this.onCardClick(card.id);
          else this.rejectCard(visual, exposed);
        });
        visual.setDepth((playable ? 60 : 15) + cardIndex);
        if (isNew && firstDeal) {
          const container = visual.getContainer();
          container.setPosition(12, this.layout.trayTop).setScale(.35).setAlpha(0);
          this.tweens.add({ targets: container, x, y, scale: 1, alpha: 1, duration: 350, delay: colIndex * 35 + cardIndex * 22, ease: 'Cubic.out' });
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
    this.drawText.setText(battle.chain.length ? 'END TURN' : 'DRAW');
    const intent = battle.enemy.intents[battle.enemy.currentIntentIndex];
    const ready = battle.chain.length >= MIN_ATTACK_CHAIN;
    const action = ready ? 'Enemy skips this turn' : `Chain ${battle.chain.length}/${MIN_ATTACK_CHAIN} · ${intent.type === 'attack' ? `Enemy hits ${intent.value}` : intent.type}`;
    this.turnHint.setText(`${battle.deck.length} cards left\n${action}`);
  }

  private updatePlayerHUD(state: RunState): void {
    this.playerHPBar.setHp(state.player.hp, state.player.maxHp);
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
    this.tweens.add({ targets: moving, y: bounds.y - 22, angle: -8, scale: 1.15, duration: 90, ease: 'Quad.out', onComplete: () => {
      const path = new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(moving.x, moving.y), new Phaser.Math.Vector2(destinationX + 20, bounds.y - 55), new Phaser.Math.Vector2(destinationX, destinationY));
      const progress = { t: 0 };
      this.tweens.add({ targets: progress, t: 1, duration: 240, ease: 'Cubic.inOut', onUpdate: () => {
        const point = path.getPoint(progress.t); moving.setPosition(point.x, point.y).setAngle(-8 * (1 - progress.t));
      }, onComplete: () => {
        flying.destroy();
        const active = this.activeCardVisual?.getContainer();
        active?.setVisible(true).setScale(this.layout.activeScale * 1.12);
        if (active) this.tweens.add({ targets: active, scale: this.layout.activeScale, duration: 140, ease: 'Back.out' });
        this.cardBurst(destinationX + this.layout.activeW / 2, destinationY + this.layout.activeH / 2, power ? 0xff7cee : 0xffdf70);
        this.time.delayedCall(getGameManager().getState()?.phase === 'battle' ? 160 : 450, () => { this.inputPaused = false; this.checkPhaseTransition(); });
      } });
    } });
  }

  private onDrawClick(): void {
    if (this.inputPaused) return;
    AudioSystem.unlock();
    const before = getGameManager().getState();
    const result = getGameManager().draw();
    if (!result || result.state === before) return;
    this.inputPaused = true;
    AudioSystem.play('card_draw');
    this.refreshState();
    this.handleEvents(result.events);
    const active = this.activeCardVisual?.getContainer();
    if (active && result.state.battle) {
      const targetX = active.x;
      active.setX(16).setAlpha(0.4).setAngle(-18).setScale(.55);
      this.tweens.add({ targets: active, x: targetX, alpha: 1, angle: 0, scale: this.layout.activeScale, duration: 340, ease: 'Back.out' });
    }
    this.time.delayedCall(750, () => {
      this.inputPaused = false;
      this.checkPhaseTransition();
    });
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
        case 'enemy_attacked':
          this.playEnemyAttackAnimation();
          AudioSystem.play('player_hit');
          break;
        case 'enemy_died':
          playCombatVFX(this, 'smoke', viewport(this).width / 2, this.enemyBaseY - this.layout.enemyHeight * .4, 140, 0xcfc2ff);
          this.playEnemyDeathAnimation();
          AudioSystem.play('enemy_death');
          break;
        case 'chain_resolved':
          this.playDamageAnimation(event.totalDamage as number);
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

  private playEnemyAttackAnimation(): void {
    const sprite = this.enemySprite;
    if (!sprite || this.enemyDying) return;
    this.tweens.killTweensOf(sprite);
    sprite.play(`${this.enemyKey}-attack`, true);
    this.tweens.add({ targets: sprite, y: this.enemyBaseY - 18, angle: -7, duration: 130, ease: 'Quad.out', onComplete: () => {
      this.tweens.add({ targets: sprite, y: this.enemyBaseY + 16, angle: 7, scaleX: this.enemyScale * 1.12, scaleY: this.enemyScale * .92, duration: 110, ease: 'Cubic.in', onComplete: () => {
        this.cameras.main.shake(110, .006);
        playCombatVFX(this, 'slash', 76, this.layout.playerHudTop + 15, 94, 0xff606f, 35);
        this.cardBurst(viewport(this).width / 2, this.layout.arenaTop + this.layout.arenaHeight - 70, 0xff6655);
        this.tweens.add({ targets: sprite, y: this.enemyBaseY, angle: 0, scale: this.enemyScale, duration: 240, onComplete: () => { sprite.play(`${this.enemyKey}-idle`); this.startEnemyIdle(); } });
      } });
    } });
  }

  private playEnemyDeathAnimation(): void {
    const sprite = this.enemySprite;
    if (!sprite) return;
    this.enemyDying = true;
    this.tweens.killTweensOf(sprite);
    sprite.play(`${this.enemyKey}-dead`, true);
    this.tweens.add({ targets: sprite, y: this.enemyBaseY + 20, angle: 22, alpha: 0, scaleY: this.enemyScale * .4, duration: 650, ease: 'Cubic.in' });
    if (this.enemyShadow) this.tweens.add({ targets: this.enemyShadow, alpha: 0, scaleX: .3, duration: 650 });
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

  private playDamageAnimation(damage: number): void {
    playCombatVFX(this, 'slash', viewport(this).width / 2, this.enemyBaseY - this.layout.enemyHeight * .45, Math.min(195, this.layout.arenaHeight * .75), damage >= 20 ? 0xffb43b : undefined, -20);
    if (!this.enemySprite) return;

    if (!this.enemyDying) {
      const sprite = this.enemySprite;
      sprite.setTint(0xff8c8c);
      this.time.delayedCall(150, () => { if (sprite.active) sprite.clearTint(); });
      this.tweens.add({ targets: sprite, x: viewport(this).width / 2 + 7, duration: 45, yoyo: true, repeat: 2, onComplete: () => sprite.setX(viewport(this).width / 2) });
      this.cardBurst(sprite.x, sprite.y - sprite.displayHeight / 2, 0xffdf70);
    }

    // Damage number popup
    const dmgText = this.add
      .text(viewport(this).width / 2, this.layout.arenaTop + this.layout.arenaHeight * 0.4, damage.toString(), {
        resolution: getRenderDensity(), fontFamily: 'Lilita One',
        fontSize: '40px',
        color: '#FFD070',
      })
      .setOrigin(0.5)
      .setStroke('#1B1030', 8)
      .setShadow(0, 4, '#1B1030', 0, true, true)
      .setDepth(100);

    this.tweens.add({
      targets: dmgText,
      y: dmgText.y - 60,
      alpha: 0,
      scale: 1.3,
      duration: 800,
      ease: 'Power2',
      onComplete: () => dmgText.destroy(),
    });
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
    setTestHook(null);
    this.cardVisuals = [];
    this.activeCardVisual = null;
    this.activeLabel = null;
    this.enemySprite = null;
    this.enemyShadow = null;
    this.crownSprite = null;
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
