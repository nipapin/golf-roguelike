import Phaser from 'phaser';
import { getGameManager, setTestHook } from '../GameManager';
import { colors, getLayoutMetrics, getCardMetrics } from '../design/tokens';
import { ArenaBackground, getEncounterForEnemy } from '../design/ArenaBackground';
import { HPBar, ComboBanner, createIntentBubble } from '../design/HudComponents';
import { CardVisual } from '../design/CardVisual';
import { showBuildPanel } from '../design/BuildPanel';
import { SettingsModal } from '../design/SettingsModal';
import { isPlayable } from '../../core/GameRules';
import { AudioSystem } from '../audio/AudioSystem';
import type { RunState, Card, BattleState } from '../../core/types';

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

  constructor() {
    super('BattleScene');
  }

  create(): void {
    const width = this.scale.width;
    const height = this.scale.height;

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
    this.refreshState();

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
          .filter((cv) => cv.isInteractive())
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
          width: this.scale.width * 0.46,
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
    const width = this.scale.width;
    const { hudTop, hudHeight, relicTop } = this.layout;
    const manager = getGameManager();
    this.topHUD = this.add.container(0, hudTop).setDepth(100);
    const bg = this.add.rectangle(width / 2, hudHeight / 2, width - 16, hudHeight, 0x21163a).setStrokeStyle(1, 0x654581);
    const progress = this.add.text(16, hudHeight / 2, `FIGHT ${manager.getCurrentFightNumber()} / ${manager.getTotalFights()}`, {
      fontFamily: 'Fredoka', fontSize: '14px', fontStyle: 'bold', color: '#fff3d1',
    }).setOrigin(0, 0.5);
    this.goldText = this.add.text(width * 0.58, hudHeight / 2, '♦ 0', {
      fontFamily: 'Fredoka', fontSize: '16px', color: '#ffd267',
    }).setOrigin(0.5);
    const settings = this.add.rectangle(width - 30, hudHeight / 2, 40, 36, 0x3d2c66).setInteractive();
    settings.on('pointerup', () => { AudioSystem.unlock(); this.openSettings(); });
    const gear = this.add.text(width - 30, hudHeight / 2, '⚙', { fontSize: '22px', color: '#fff' }).setOrigin(0.5);
    this.topHUD.add([bg, progress, this.goldText, settings, gear]);
    const build = this.add.rectangle(width / 2, relicTop + 14, width - 24, 26, 0x352353).setDepth(100).setInteractive();
    this.buildText = this.add.text(width / 2, build.y, 'BUILD · CHOOSE A RELIC', {
      fontFamily: 'Fredoka', fontSize: '12px', color: '#dac6ff',
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
    const width = this.scale.width;
    const height = this.scale.height;

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
    const width = this.scale.width;
    const y = this.layout.playerHudTop + 15;
    this.playerHPBar = new HPBar(this, 76, y, 126, 20, 30, true);
    this.playerHPBar.setDepth(100);
    this.armorText = this.add.text(width - 16, y, 'ARMOR 0', {
      fontFamily: 'Fredoka', fontSize: '13px', color: '#9ccfff',
    }).setOrigin(1, 0.5).setDepth(100);
  }

  private createDrawPile(): void {
    const { trayTop, trayHeight } = this.layout;
    const width = this.scale.width;
    const buttonWidth = width * 0.46;
    const buttonHeight = trayHeight - 28;
    this.drawPile = this.add.container(12 + buttonWidth / 2, trayTop + 14 + buttonHeight / 2).setDepth(55);
    const bg = this.add.rectangle(0, 0, buttonWidth, buttonHeight, 0x31559a).setStrokeStyle(2, 0x9aafe0);
    this.drawText = this.add.text(0, -10, 'DRAW', {
      fontFamily: 'Lilita One', fontSize: '20px', color: '#ffffff',
    }).setOrigin(0.5);
    this.turnHint = this.add.text(0, 16, 'Enemy turn', {
      fontFamily: 'Fredoka', fontSize: '11px', color: '#e1e6ff', align: 'center',
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
        this.scale.width,
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
    const width = this.scale.width;
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
        fontFamily: 'Lilita One',
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
        this, this.scale.width / 2 + 80,
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
    const { tableauTop, cw, strip, side, gap } = this.layout;
    const powers = new Map(battle.powerCards.map((power) => [power.cardId, power.type]));

    battle.tableau.forEach((column, colIndex) => {
      column.cards.forEach((card, cardIndex) => {
        const x = side + colIndex * (cw + gap);
        const y = tableauTop + cardIndex * strip;
        const visual = existing.get(card.id) ?? new CardVisual(this, x, y, card, powers.get(card.id) ?? null);
        existing.delete(card.id);
        const exposed = cardIndex === column.cards.length - 1;
        const playable = exposed && this.canPlayCard(card, battle);
        visual.setPosition(x, y);
        const state = !exposed ? 'covered' : playable ? 'playable' : 'disabled';
        if (visual.getState() !== state) visual.setState(state);
        if (playable) visual.setInteractive(() => this.onCardClick(card.id));
        else visual.disableInteractive();
        visual.setDepth((playable ? 60 : 15) + cardIndex);
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
    const width = this.scale.width;

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

    // "ACTIVE" label - always show
    const labelY = activeY + activeH / 2 + 12;
    this.activeLabel = this.add
      .text(activeX, labelY, 'ACTIVE · ±1', {
        fontFamily: 'Fredoka',
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
  }

  private updateDrawPile(battle: BattleState): void {
    this.drawText.setText(battle.chain.length ? 'END TURN' : 'DRAW');
    const intent = battle.enemy.intents[battle.enemy.currentIntentIndex];
    const action = intent.type === 'attack' ? `Enemy hits ${intent.value}` : `Enemy: ${intent.type}`;
    this.turnHint.setText(`${battle.deck.length} cards left\n${action}`);
  }

  private updatePlayerHUD(state: RunState): void {
    this.playerHPBar.setHp(state.player.hp, state.player.maxHp);
    this.goldText.setText(`♦ ${state.player.gold}`);
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
    this.tweens.add({
      targets: flying.getContainer(),
      x: this.scale.width * 0.76 - this.layout.activeW / 2,
      y: this.layout.trayTop + 12,
      scale: this.layout.activeScale, angle: 0,
      duration: 260, ease: 'Cubic.out',
      onComplete: () => {
        flying.destroy();
        this.activeCardVisual?.getContainer().setVisible(true);
        this.inputPaused = false;
        this.checkPhaseTransition();
      },
    });
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
      active.setX(16).setAlpha(0.4);
      this.tweens.add({ targets: active, x: targetX, alpha: 1, duration: 230, ease: 'Cubic.out' });
    }
    this.time.delayedCall(260, () => {
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
        case 'enemy_attacked':
          this.playEnemyAttackAnimation();
          AudioSystem.play('player_hit');
          break;
        case 'enemy_died':
          this.playEnemyDeathAnimation();
          AudioSystem.play('enemy_death');
          break;
        case 'chain_resolved':
          this.playDamageAnimation(event.totalDamage as number);
          AudioSystem.play('enemy_hit');
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

  private playEnemyAttackAnimation(): void {
    if (!this.enemySprite) return;

    const attackKey = `${this.currentState?.battle?.enemy.sprite || 'goblin'}-attack`;
    if (this.anims.exists(attackKey)) {
      this.enemySprite.play(attackKey);
      this.enemySprite.once('animationcomplete', () => {
        const idleKey = `${this.currentState?.battle?.enemy.sprite || 'goblin'}-idle`;
        if (this.anims.exists(idleKey)) {
          this.enemySprite?.play(idleKey);
        }
      });
    }

    // Screen shake
    this.cameras.main.shake(100, 0.01);
  }

  private playEnemyDeathAnimation(): void {
    if (!this.enemySprite) return;

    const deadKey = `${this.currentState?.battle?.enemy.sprite || 'goblin'}-dead`;
    if (this.anims.exists(deadKey)) {
      this.enemySprite.play(deadKey);
    }
  }

  private playDamageAnimation(damage: number): void {
    if (!this.enemySprite) return;

    const hurtKey = `${this.currentState?.battle?.enemy.sprite || 'goblin'}-hurt`;
    if (this.anims.exists(hurtKey)) {
      this.enemySprite.play(hurtKey);
      this.enemySprite.once('animationcomplete', () => {
        const idleKey = `${this.currentState?.battle?.enemy.sprite || 'goblin'}-idle`;
        if (this.anims.exists(idleKey)) {
          this.enemySprite?.play(idleKey);
        }
      });
    }

    // Damage number popup
    const dmgText = this.add
      .text(this.scale.width / 2, this.layout.arenaTop + this.layout.arenaHeight * 0.4, damage.toString(), {
        fontFamily: 'Lilita One',
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
        this.scene.start('RewardScene');
        break;
      case 'victory':
      case 'defeat':
        this.scene.start('EndScene');
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
