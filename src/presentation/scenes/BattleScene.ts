import Phaser from 'phaser';
import { getGameManager } from '../GameManager';
import { colors, getLayoutMetrics, getCardMetrics, getComboTier } from '../design/tokens';
import { ArenaBackground, getEncounterForEnemy } from '../design/ArenaBackground';
import { HPBar, ComboBanner, createIntentBubble, createChip } from '../design/HudComponents';
import { CardVisual, createCardBack } from '../design/CardVisual';
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
  private goldChip!: Phaser.GameObjects.Container;
  private armorChip: Phaser.GameObjects.Container | null = null;
  private topHUD: Phaser.GameObjects.Container | null = null;
  private activeLabel: Phaser.GameObjects.Text | null = null;

  // Table elements
  private tableBackground!: Phaser.GameObjects.Graphics;
  private cardVisuals: CardVisual[] = [];
  private activeCardVisual: CardVisual | null = null;
  private drawPile: Phaser.GameObjects.Container | null = null;
  private drawCountBadge!: Phaser.GameObjects.Container;

  // State
  private currentState: RunState | null = null;

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

    // Listen for resize
    this.scale.on('resize', this.handleResize, this);
  }

  private createTopHUD(): void {
    const width = this.scale.width;
    const { safeTop, hudHeight } = this.layout;

    this.topHUD = this.add.container(0, safeTop);
    this.topHUD.setDepth(100);

    // Background bar
    const bg = this.add.graphics();
    bg.fillStyle(colors.ink, 0.7);
    bg.fillRect(0, 0, width, hudHeight);
    this.topHUD.add(bg);

    // Fight progress nodes (7 fights)
    const manager = getGameManager();
    const nodeStartX = 12;
    const nodeSpacing = 24;

    for (let i = 0; i < 7; i++) {
      const nodeX = nodeStartX + i * nodeSpacing;
      const nodeY = hudHeight / 2;
      const currentFight = manager.getCurrentFightNumber() - 1;

      const node = this.add.graphics();
      
      if (i < currentFight) {
        // Completed fight
        node.fillStyle(colors.green, 1);
        node.fillCircle(nodeX, nodeY, 8);
        node.lineStyle(2, colors.ink, 1);
        node.strokeCircle(nodeX, nodeY, 8);
      } else if (i === currentFight) {
        // Current fight - gold with swords icon
        node.fillStyle(colors.gold, 1);
        node.fillCircle(nodeX, nodeY, 10);
        node.lineStyle(2, colors.ink, 1);
        node.strokeCircle(nodeX, nodeY, 10);
      } else if (i === 3) {
        // Elite (fight 4)
        node.fillStyle(colors.violet, 0.5);
        node.fillCircle(nodeX, nodeY, 8);
        node.lineStyle(2, colors.ink, 0.5);
        node.strokeCircle(nodeX, nodeY, 8);
      } else if (i === 6) {
        // Boss (fight 7)
        node.fillStyle(colors.red, 0.5);
        node.fillCircle(nodeX, nodeY, 8);
        node.lineStyle(2, colors.ink, 0.5);
        node.strokeCircle(nodeX, nodeY, 8);
      } else {
        // Future fight
        node.fillStyle(colors.white, 0.3);
        node.fillCircle(nodeX, nodeY, 6);
        node.lineStyle(2, colors.ink, 0.3);
        node.strokeCircle(nodeX, nodeY, 6);
      }
      this.topHUD.add(node);
    }

    // Gold display in center
    const goldX = width / 2;
    const state = manager.getState();
    const goldAmount = state?.player.gold || 0;

    const goldIcon = this.add.text(goldX - 30, hudHeight / 2, '💰', {
      fontSize: '18px',
    }).setOrigin(0.5);
    this.topHUD.add(goldIcon);

    const goldText = this.add.text(goldX + 5, hudHeight / 2, goldAmount.toString(), {
      fontFamily: 'Lilita One',
      fontSize: '18px',
      color: '#FFD700',
    }).setOrigin(0, 0.5).setStroke('#1B1030', 3);
    this.topHUD.add(goldText);

    // Settings button on right
    const settingsX = width - 30;
    const settingsBtn = this.add.graphics();
    settingsBtn.fillStyle(colors.blue, 1);
    settingsBtn.fillCircle(settingsX, hudHeight / 2, 14);
    settingsBtn.lineStyle(2, colors.ink, 1);
    settingsBtn.strokeCircle(settingsX, hudHeight / 2, 14);
    this.topHUD.add(settingsBtn);

    const settingsIcon = this.add.text(settingsX, hudHeight / 2, '⚙', {
      fontSize: '16px',
    }).setOrigin(0.5);
    this.topHUD.add(settingsIcon);
  }

  private createTableBackground(): void {
    const { tableTop, tableHeight, safeBottom } = this.layout;
    const width = this.scale.width;
    const height = this.scale.height;

    this.tableBackground = this.add.graphics();
    this.tableBackground.setDepth(10);

    // Felt gradient
    this.tableBackground.fillGradientStyle(
      colors.feltHi,
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
    const width = this.scale.width;
    const height = this.scale.height;
    const { trayTop, activeH, safeBottom } = this.layout;

    const hudY = height - safeBottom - 40;

    // Player HP bar (smaller, right side)
    this.playerHPBar = new HPBar(this, width - 70, hudY, 100, 18, 30, true);
    this.playerHPBar.setDepth(60);

    // Gold chip
    this.goldChip = createChip(this, width - 140, hudY - 30, colors.diamond, '♦', 0);
    this.goldChip.setDepth(60);
  }

  private createDrawPile(): void {
    const { trayTop, cw, ch, side, safeBottom } = this.layout;
    const width = this.scale.width;
    const height = this.scale.height;

    const pileX = side + cw / 2 + 10;
    const pileY = height - safeBottom - ch / 2 - 45;

    this.drawPile = this.add.container(pileX, pileY);
    this.drawPile.setDepth(55);

    // Stack of card backs
    for (let i = 2; i >= 0; i--) {
      const back = createCardBack(this, -cw / 2 + i * 3, -ch / 2 - i * 3);
      this.drawPile.add(back);
    }

    // DRAW button overlay
    const drawBtn = this.add.graphics();
    drawBtn.fillGradientStyle(colors.blue, colors.blue, colors.blueLo, colors.blueLo, 1);
    drawBtn.fillRoundedRect(-35, ch / 2 - 20, 70, 28, 8);
    drawBtn.lineStyle(2.5, colors.ink, 1);
    drawBtn.strokeRoundedRect(-35, ch / 2 - 20, 70, 28, 8);
    this.drawPile.add(drawBtn);

    const drawText = this.add
      .text(0, ch / 2 - 6, 'DRAW', {
        fontFamily: 'Lilita One',
        fontSize: '14px',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setStroke('#1B1030', 3);
    this.drawPile.add(drawText);

    // Count badge
    this.drawCountBadge = this.add.container(cw / 2 - 5, -ch / 2 + 5);
    const badgeBg = this.add.graphics();
    badgeBg.fillStyle(colors.red, 1);
    badgeBg.fillCircle(0, 0, 14);
    badgeBg.lineStyle(2, colors.ink, 1);
    badgeBg.strokeCircle(0, 0, 14);
    this.drawCountBadge.add(badgeBg);

    const countText = this.add
      .text(0, 0, '0', {
        fontFamily: 'Lilita One',
        fontSize: '14px',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setStroke('#1B1030', 2);
    this.drawCountBadge.add(countText);
    this.drawPile.add(this.drawCountBadge);

    // Make entire pile clickable
    this.drawPile.setInteractive(
      new Phaser.Geom.Rectangle(-cw / 2, -ch / 2, cw, ch + 20),
      Phaser.Geom.Rectangle.Contains
    );
    this.drawPile.on('pointerdown', () => this.onDrawClick());
  }

  private refreshState(): void {
    const manager = getGameManager();
    const state = manager.getState();
    if (!state) return;

    this.currentState = state;

    // Update arena background based on enemy
    if (state.battle) {
      const encounter = getEncounterForEnemy(state.battle.enemy.sprite || 'goblin');
      this.arenaBackground.draw(
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
    const height = this.scale.height;
    const { arenaTop, arenaHeight } = this.layout;

    const enemy = battle.enemy;
    const enemyX = width / 2;
    const enemyY = arenaTop + arenaHeight - 70;

    // Target enemy height: ~26% of screen height per STYLE.md
    const targetEnemyHeight = height * 0.26;

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

    // Intent bubble
    if (this.intentBubble) this.intentBubble.destroy();

    const intent = enemy.intents[enemy.currentIntentIndex];
    if (intent) {
      this.intentBubble = createIntentBubble(
        this,
        width / 2 + 80,
        arenaTop + arenaHeight * 0.2,
        intent.type as 'attack' | 'defend' | 'buff' | 'debuff',
        intent.value
      );
      this.intentBubble.setDepth(25);
    }
  }

  private renderTableau(battle: BattleState): void {
    // Clear existing cards
    this.cardVisuals.forEach((cv) => cv.destroy());
    this.cardVisuals = [];

    const { tableauTop, cw, ch, strip, side, gap } = this.layout;
    const width = this.scale.width;

    const tableauX = side;
    const tableauY = tableauTop + 20;

    // Get power cards mapping
    const powerCards = new Map<string, PowerType>();
    battle.powerCards.forEach((pc) => powerCards.set(pc.cardId, pc.type));

    // Render each column
    battle.tableau.forEach((column, colIndex) => {
      const x = tableauX + colIndex * (cw + gap);

      column.cards.forEach((card, cardIndex) => {
        const isTop = cardIndex === column.cards.length - 1;
        const y = tableauY + cardIndex * strip;

        const powerType = powerCards.get(card.id) || null;
        const cardVisual = new CardVisual(this, x, y, card, powerType);

        // Determine state
        let state: 'normal' | 'covered' | 'playable' | 'disabled' = 'normal';
        if (!isTop) {
          state = 'covered';
        } else if (this.canPlayCard(card, battle)) {
          state = 'playable';
          cardVisual.setInteractive(() => this.onCardClick(card.id));
        } else {
          state = 'disabled';
        }

        cardVisual.setState(state);
        cardVisual.setDepth(15 + cardIndex);
        this.cardVisuals.push(cardVisual);
      });
    });
  }

  private canPlayCard(card: Card, battle: BattleState): boolean {
    if (!battle.activeCard) return false;

    const activeRank = battle.activeCard.rank;
    const cardRank = card.rank;

    // Wild active means any card can connect
    if (battle.wildActive) return true;

    // Normal connection: ±1
    const diff = Math.abs(activeRank - cardRank);
    if (diff === 1) return true;

    // Ace-King wrap (check relics)
    if ((activeRank === 1 && cardRank === 13) || (activeRank === 13 && cardRank === 1)) {
      return true;
    }

    return false;
  }

  private renderActiveCard(battle: BattleState): void {
    if (this.activeCardVisual) {
      this.activeCardVisual.destroy();
      this.activeCardVisual = null;
    }
    if (this.activeLabel) {
      this.activeLabel.destroy();
      this.activeLabel = null;
    }

    if (!battle.activeCard) return;

    const { trayTop, activeW, activeH, activeScale, safeBottom, cw, ch, side } = this.layout;
    const width = this.scale.width;
    const height = this.scale.height;

    // Position between draw pile and player HUD
    const activeX = width / 2 - 20;
    const activeY = height - safeBottom - activeH / 2 - 30;

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
      .text(activeX, labelY, 'ACTIVE', {
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
      this.comboBanner.setVisible(false);
    }
  }

  private updateDrawPile(battle: BattleState): void {
    // Update count badge
    const countText = this.drawCountBadge.getAt(1) as Phaser.GameObjects.Text;
    if (countText) {
      countText.setText(battle.deck.length.toString());
    }
  }

  private updatePlayerHUD(state: RunState): void {
    this.playerHPBar.setHp(state.player.hp, state.player.maxHp);

    // Update gold chip
    const goldText = this.goldChip.getAt(3) as Phaser.GameObjects.Text;
    if (goldText) {
      goldText.setText(state.player.gold.toString());
    }

    // Armor chip (create/update if armor > 0)
    if (state.player.armor > 0) {
      if (!this.armorChip) {
        const width = this.scale.width;
        const height = this.scale.height;
        const { safeBottom } = this.layout;
        this.armorChip = createChip(this, width - 140, height - safeBottom - 70, colors.club, '🛡', state.player.armor);
        this.armorChip.setDepth(60);
      } else {
        const armorText = this.armorChip.getAt(3) as Phaser.GameObjects.Text;
        if (armorText) {
          armorText.setText(state.player.armor.toString());
        }
      }
    } else if (this.armorChip) {
      this.armorChip.destroy();
      this.armorChip = null;
    }
  }

  private onCardClick(cardId: string): void {
    const manager = getGameManager();
    const result = manager.playCard(cardId);

    if (result && result.events.length > 0) {
      this.handleEvents(result.events);
    }

    this.refreshState();
    this.checkPhaseTransition();
  }

  private onDrawClick(): void {
    const manager = getGameManager();
    const result = manager.draw();

    if (result && result.events.length > 0) {
      this.handleEvents(result.events);
    }

    this.refreshState();
    this.checkPhaseTransition();
  }

  private handleEvents(events: Array<{ type: string; [key: string]: unknown }>): void {
    for (const event of events) {
      switch (event.type) {
        case 'enemy_attacked':
          this.playEnemyAttackAnimation();
          break;
        case 'enemy_died':
          this.playEnemyDeathAnimation();
          break;
        case 'chain_resolved':
          this.playDamageAnimation(event.totalDamage as number);
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
    const width = this.scale.width;
    const height = this.scale.height;

    this.layout = getLayoutMetrics(width, height);
    this.cardMetrics = getCardMetrics(width);

    // Recreate table background
    if (this.tableBackground) {
      this.tableBackground.destroy();
    }
    this.createTableBackground();

    // Refresh everything
    this.refreshState();
  }

  shutdown(): void {
    this.scale.off('resize', this.handleResize, this);
  }
}
