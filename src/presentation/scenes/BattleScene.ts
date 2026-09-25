import Phaser from 'phaser';
import { getGameManager } from '../GameManager';
import { Card, BattleState, GameEvent, PowerCard, RunState, Relic } from '../../core/types';
import { getPlayableCards, getRankDisplay, getSuitSymbol } from '../../core/GameRules';

export class BattleScene extends Phaser.Scene {
  private cardObjects: Map<string, Phaser.GameObjects.Container> = new Map();
  private isAnimating = false;

  constructor() {
    super('BattleScene');
  }

  create(): void {
    const manager = getGameManager();
    const state = manager.getState();

    if (!state || !state.battle) {
      this.scene.start('StartScene');
      return;
    }

    // Subscribe to events
    manager.onEvents((events) => this.handleEvents(events));

    this.cameras.main.setBackgroundColor('#0a0e17');
    this.render();
  }

  private render(): void {
    const manager = getGameManager();
    const state = manager.getState();

    if (!state || !state.battle) {
      return;
    }

    // Clear previous objects but keep the map for animation reference
    this.children.removeAll();
    this.cardObjects.clear();

    const width = this.scale.width;
    const height = this.scale.height;
    const battle = state.battle;

    this.drawBackground(width, height);
    this.drawHUD(width);
    this.drawEnemy(width, battle);
    this.drawPlayerStats(width, height, state);
    this.drawTableau(width, height, battle, state.player.relics);
    this.drawActiveCard(width, height, battle);
    this.drawDeck(width, height, battle);
    this.drawChainIndicator(width, height, battle);
  }

  private drawBackground(width: number, height: number): void {
    const g = this.add.graphics();

    // Dark blue gradient background
    g.fillStyle(0x0c1220, 1);
    g.fillRect(0, 0, width, height);

    // Table area
    const tableTop = height * 0.38;
    g.fillStyle(0x0a1018, 0.9);
    g.fillRoundedRect(8, tableTop, width - 16, height - tableTop - 8, 16);
    g.lineStyle(1, 0x2a4a6a, 0.3);
    g.strokeRoundedRect(8, tableTop, width - 16, height - tableTop - 8, 16);
  }

  private drawHUD(width: number): void {
    const manager = getGameManager();
    const safeTop = 12;

    // Title and fight number
    this.add
      .text(14, safeTop, '♣ GOLF ROGUE', {
        fontFamily: 'Georgia, serif',
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#f0cf68',
      });

    this.add
      .text(width - 14, safeTop + 2, `FIGHT ${manager.getCurrentFightNumber()}/${manager.getTotalFights()}`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '10px',
        fontStyle: 'bold',
        color: '#6a7a8a',
      })
      .setOrigin(1, 0);

    // Fight type indicator
    if (manager.isEliteFight()) {
      this.add
        .text(width - 14, safeTop + 16, 'ELITE', {
          fontFamily: 'Arial, sans-serif',
          fontSize: '9px',
          fontStyle: 'bold',
          color: '#c080ff',
        })
        .setOrigin(1, 0);
    } else if (manager.isBossFight()) {
      this.add
        .text(width - 14, safeTop + 16, 'BOSS', {
          fontFamily: 'Arial, sans-serif',
          fontSize: '9px',
          fontStyle: 'bold',
          color: '#ff6060',
        })
        .setOrigin(1, 0);
    }
  }

  private drawEnemy(width: number, battle: BattleState): void {
    const enemy = battle.enemy;
    const cx = width / 2;
    const panelY = 42;
    const panelH = 85;

    // Enemy panel background
    this.add
      .rectangle(cx, panelY + panelH / 2, width - 20, panelH, 0x141a28)
      .setStrokeStyle(1, 0x2a3a4a);

    // Enemy name
    this.add
      .text(24, panelY + 12, enemy.name, {
        fontFamily: 'Georgia, serif',
        fontSize: '16px',
        fontStyle: 'bold',
        color: '#e8e0d0',
      });

    // Intent
    const intent = enemy.intents[enemy.currentIntentIndex];
    const intentIcon = intent.type === 'attack' ? '⚔' : intent.type === 'defend' ? '🛡' : '✦';
    this.add
      .text(24, panelY + 38, `${intentIcon} ${intent.value}`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '13px',
        fontStyle: 'bold',
        color: intent.type === 'attack' ? '#ff8080' : '#80c0ff',
      });

    // HP display
    const hpText = `${Math.max(0, enemy.hp)}/${enemy.maxHp}`;
    this.add
      .text(width - 24, panelY + 12, hpText, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#e8e0d0',
      })
      .setOrigin(1, 0);

    // HP bar
    const barWidth = Math.min(120, width * 0.3);
    const barX = width - 24 - barWidth;
    const barY = panelY + 42;

    this.add.rectangle(barX + barWidth / 2, barY, barWidth, 8, 0x3a1a2a).setOrigin(0.5);

    const hpRatio = Math.max(0, enemy.hp / enemy.maxHp);
    if (hpRatio > 0) {
      this.add
        .rectangle(barX, barY, barWidth * hpRatio, 8, 0xd84b65)
        .setOrigin(0, 0.5);
    }

    // Enemy sprite (positioned in center of panel)
    const spriteKey = enemy.sprite;
    if (this.textures.exists(spriteKey)) {
      const sprite = this.add.image(cx, panelY + panelH / 2 + 5, spriteKey);
      sprite.setDisplaySize(60, 60);

      // Idle bounce animation
      this.tweens.add({
        targets: sprite,
        y: sprite.y - 4,
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut',
      });
    }
  }

  private drawPlayerStats(width: number, height: number, state: RunState): void {
    const statsY = 138;

    // HP
    this.add
      .text(16, statsY, `♥ ${state.player.hp}/${state.player.maxHp}`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#ff6677',
      });

    // Armor
    this.add
      .text(width / 2, statsY, `♣ ${state.player.armor}`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#70a0e0',
      })
      .setOrigin(0.5, 0);

    // Gold
    this.add
      .text(width - 16, statsY, `♦ ${state.player.gold}`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#f0cf68',
      })
      .setOrigin(1, 0);

    // Relics row
    if (state.player.relics.length > 0) {
      const relicsY = statsY + 22;
      state.player.relics.forEach((relic, i) => {
        this.add
          .text(16 + i * 24, relicsY, '◆', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '12px',
            color: '#a080c0',
          })
          .setInteractive()
          .on('pointerover', () => {
            // Could show tooltip
          });
      });
    }
  }

  private drawTableau(
    width: number,
    height: number,
    battle: BattleState,
    relics: Relic[]
  ): void {
    const manager = getGameManager();
    const playableCards = getPlayableCards(battle, relics);
    const playableIds = new Set(playableCards.map((c) => c.id));

    const tableTop = height * 0.40;
    const tableBottom = height - 115;
    const cols = battle.tableau.length;
    const gap = 4;
    const cardWidth = Math.floor((width - 20 - gap * (cols - 1)) / cols);
    const cardHeight = Math.min(72, cardWidth * 1.4);
    const overlap = Math.min(42, (tableBottom - tableTop - cardHeight) / 4);
    const startX = (width - (cardWidth * cols + gap * (cols - 1))) / 2;

    battle.tableau.forEach((column, colIdx) => {
      column.cards.forEach((card, rowIdx) => {
        const x = startX + colIdx * (cardWidth + gap);
        const y = tableTop + rowIdx * overlap;
        const isExposed = rowIdx === column.cards.length - 1;
        const isPlayable = isExposed && playableIds.has(card.id);
        const powerType = this.getPowerType(card.id, battle.powerCards);

        this.drawCard(x, y, cardWidth, cardHeight, card, isExposed, isPlayable, powerType);
      });
    });
  }

  private drawCard(
    x: number,
    y: number,
    width: number,
    height: number,
    card: Card,
    isExposed: boolean,
    isPlayable: boolean,
    powerType: string | null
  ): void {
    const container = this.add.container(x + width / 2, y + height / 2);

    // Card shadow
    const shadow = this.add.rectangle(2, 3, width, height, 0x000000, 0.3);
    container.add(shadow);

    // Card background
    const cardKey = this.getCardKey(card);
    if (this.textures.exists(cardKey)) {
      const cardImg = this.add.image(0, 0, cardKey);
      cardImg.setDisplaySize(width, height);
      if (!isExposed) {
        cardImg.setTint(0xb0b0b0);
        cardImg.setAlpha(0.85);
      }
      container.add(cardImg);
    } else {
      // Fallback: draw card manually
      const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
      const bg = this.add.rectangle(0, 0, width, height, 0xffffff);
      container.add(bg);

      const label = getRankDisplay(card.rank) + getSuitSymbol(card.suit);
      const text = this.add
        .text(0, 0, label, {
          fontFamily: 'Georgia, serif',
          fontSize: `${Math.floor(width * 0.35)}px`,
          fontStyle: 'bold',
          color: isRed ? '#c84050' : '#1a2540',
        })
        .setOrigin(0.5);
      container.add(text);

      if (!isExposed) {
        bg.setFillStyle(0xd0d0d0);
      }
    }

    // Playable glow
    if (isPlayable) {
      const glow = this.add
        .rectangle(0, 0, width + 6, height + 6)
        .setStrokeStyle(3, 0xffd85b, 0.8);
      container.addAt(glow, 0);

      this.tweens.add({
        targets: glow,
        alpha: 0.4,
        duration: 500,
        yoyo: true,
        repeat: -1,
      });

      // Make interactive
      const hitArea = this.add
        .rectangle(0, 0, width, height)
        .setInteractive({ useHandCursor: true });
      container.add(hitArea);

      hitArea.on('pointerdown', () => {
        if (!this.isAnimating) {
          this.playCard(card.id);
        }
      });

      hitArea.on('pointerover', () => {
        container.setScale(1.05);
      });

      hitArea.on('pointerout', () => {
        container.setScale(1);
      });
    }

    // Power card indicator
    if (powerType) {
      const badge = this.add.circle(width / 2 - 8, -height / 2 + 8, 10, 0x7050c0);
      badge.setStrokeStyle(2, 0xf0d080);
      container.add(badge);

      const star = this.add
        .text(width / 2 - 8, -height / 2 + 8, '✦', {
          fontFamily: 'Arial',
          fontSize: '10px',
          color: '#fff0c0',
        })
        .setOrigin(0.5);
      container.add(star);

      if (isExposed) {
        const label = this.add
          .text(0, height / 2 - 8, powerType, {
            fontFamily: 'Arial, sans-serif',
            fontSize: '8px',
            fontStyle: 'bold',
            color: '#ffffff',
            backgroundColor: '#6040a0',
            padding: { x: 3, y: 1 },
          })
          .setOrigin(0.5);
        container.add(label);
      }
    }

    this.cardObjects.set(card.id, container);
  }

  private drawActiveCard(width: number, height: number, battle: BattleState): void {
    if (!battle.activeCard) return;

    const card = battle.activeCard;
    const cardW = Math.min(70, width * 0.18);
    const cardH = cardW * 1.4;
    const x = width / 2 + cardW * 0.4;
    const y = height - 65;

    const cardKey = this.getCardKey(card);
    if (this.textures.exists(cardKey)) {
      const img = this.add.image(x, y, cardKey);
      img.setDisplaySize(cardW, cardH);
    } else {
      const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
      this.add.rectangle(x, y, cardW, cardH, 0xffffff).setStrokeStyle(1, 0x888888);
      this.add
        .text(x, y, getRankDisplay(card.rank) + getSuitSymbol(card.suit), {
          fontFamily: 'Georgia, serif',
          fontSize: '18px',
          fontStyle: 'bold',
          color: isRed ? '#c84050' : '#1a2540',
        })
        .setOrigin(0.5);
    }

    // Label
    this.add
      .text(x, y + cardH / 2 + 12, 'ACTIVE', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '8px',
        fontStyle: 'bold',
        color: '#6a7a8a',
      })
      .setOrigin(0.5);
  }

  private drawDeck(width: number, height: number, battle: BattleState): void {
    const cardW = Math.min(70, width * 0.18);
    const cardH = cardW * 1.4;
    const x = width / 2 - cardW * 0.4;
    const y = height - 65;

    // Draw button
    const drawBtn = this.add
      .rectangle(x, y, cardW, cardH, 0x1a2a40)
      .setStrokeStyle(1, 0x3a5a7a)
      .setInteractive({ useHandCursor: true });

    this.add
      .text(x, y - 10, 'DRAW', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#c0d0e0',
      })
      .setOrigin(0.5);

    this.add
      .text(x, y + 12, `${battle.deck.length}`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '16px',
        fontStyle: 'bold',
        color: '#e0e8f0',
      })
      .setOrigin(0.5);

    drawBtn.on('pointerdown', () => {
      if (!this.isAnimating) {
        this.drawFromDeck();
      }
    });

    drawBtn.on('pointerover', () => drawBtn.setFillStyle(0x2a3a50));
    drawBtn.on('pointerout', () => drawBtn.setFillStyle(0x1a2a40));

    // Help text
    const manager = getGameManager();
    const state = manager.getState();
    const playable = state?.battle ? getPlayableCards(state.battle, state.player.relics) : [];

    const helpText = playable.length > 0 ? 'PLAY ±1  •  DRAW = ENEMY TURN' : 'NO MOVES  •  DRAW';

    this.add
      .text(width / 2, height - 16, helpText, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '9px',
        fontStyle: 'bold',
        color: '#5a6a7a',
      })
      .setOrigin(0.5);
  }

  private drawChainIndicator(width: number, height: number, battle: BattleState): void {
    if (battle.chain.length === 0) return;

    const y = height * 0.36;

    // Chain length indicator
    this.add
      .text(width / 2, y, `CHAIN ×${battle.chain.length}`, {
        fontFamily: 'Georgia, serif',
        fontSize: '16px',
        fontStyle: 'bold',
        color: '#f0cf68',
      })
      .setOrigin(0.5);

    // Accumulated damage
    this.add
      .text(width / 2, y + 20, `${battle.accumulatedDamage} DMG`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#ff9080',
      })
      .setOrigin(0.5);
  }

  private getCardKey(card: Card): string {
    const rankChar = card.rank === 10 ? 'T' : getRankDisplay(card.rank);
    const suitChar = card.suit[0].toUpperCase();
    return `card-${rankChar}${suitChar}`;
  }

  private getPowerType(cardId: string, powerCards: PowerCard[]): string | null {
    const pc = powerCards.find((p) => p.cardId === cardId);
    return pc ? pc.type : null;
  }

  private playCard(cardId: string): void {
    const manager = getGameManager();
    const result = manager.playCard(cardId);

    if (result && result.events.length > 0) {
      // Simple visual feedback
      this.cameras.main.shake(50, 0.003);
    }

    this.checkPhaseTransition();
    this.render();
  }

  private drawFromDeck(): void {
    const manager = getGameManager();
    const result = manager.draw();

    if (result) {
      // Check for enemy attack event
      const attacked = result.events.find((e) => e.type === 'enemy_attacked');
      if (attacked && attacked.type === 'enemy_attacked') {
        this.cameras.main.shake(100, 0.01);
        this.cameras.main.flash(80, 150, 40, 40);
      }
    }

    this.checkPhaseTransition();
    this.render();
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

  private handleEvents(events: GameEvent[]): void {
    // Events are handled for visual feedback
    // Could add more elaborate animations here
    for (const event of events) {
      switch (event.type) {
        case 'chain_resolved':
          if (event.chainLength >= 5) {
            this.showChainText(event.chainLength);
          }
          break;
        case 'power_activated':
          this.showPowerText(event.powerType);
          break;
      }
    }
  }

  private showChainText(length: number): void {
    const width = this.scale.width;
    const height = this.scale.height;

    const text = length >= 8 ? 'MONSTER CHAIN!' : 'HOT STREAK!';
    const color = length >= 8 ? '#ff8040' : '#f0d060';

    const label = this.add
      .text(width / 2, height * 0.3, text, {
        fontFamily: 'Georgia, serif',
        fontSize: length >= 8 ? '24px' : '20px',
        fontStyle: 'bold',
        color,
      })
      .setOrigin(0.5)
      .setAlpha(0);

    this.tweens.add({
      targets: label,
      alpha: 1,
      scale: 1.2,
      y: label.y - 30,
      duration: 400,
      ease: 'Back.out',
      onComplete: () => {
        this.tweens.add({
          targets: label,
          alpha: 0,
          duration: 300,
          delay: 200,
          onComplete: () => label.destroy(),
        });
      },
    });
  }

  private showPowerText(powerType: string): void {
    const width = this.scale.width;
    const height = this.scale.height;

    const label = this.add
      .text(width / 2, height * 0.32, `${powerType}!`, {
        fontFamily: 'Georgia, serif',
        fontSize: '18px',
        fontStyle: 'bold',
        color: '#c090ff',
      })
      .setOrigin(0.5)
      .setAlpha(0);

    this.tweens.add({
      targets: label,
      alpha: 1,
      y: label.y - 20,
      duration: 300,
      onComplete: () => {
        this.tweens.add({
          targets: label,
          alpha: 0,
          duration: 400,
          delay: 300,
          onComplete: () => label.destroy(),
        });
      },
    });
  }
}
