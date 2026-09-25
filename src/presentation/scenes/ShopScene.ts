import Phaser from 'phaser';
import { getGameManager } from '../GameManager';
import { Relic, RunState } from '../../core/types';

export class ShopScene extends Phaser.Scene {
  constructor() {
    super('ShopScene');
  }

  create(): void {
    const manager = getGameManager();
    const state = manager.getState();

    if (!state || state.phase !== 'shop') {
      this.scene.start('StartScene');
      return;
    }

    const width = this.scale.width;
    const height = this.scale.height;
    const cx = width / 2;
    const config = manager.getConfig();

    // Background
    this.cameras.main.setBackgroundColor('#0a0e17');
    this.drawBackground(width, height);

    // Title
    this.add
      .text(cx, height * 0.06, 'SHOP', {
        fontFamily: 'Georgia, serif',
        fontSize: '24px',
        fontStyle: 'bold',
        color: '#f0cf68',
      })
      .setOrigin(0.5);

    // Gold display
    this.add
      .text(cx, height * 0.12, `♦ ${state.player.gold} GOLD`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#f0cf68',
      })
      .setOrigin(0.5);

    // Items
    let yPos = height * 0.20;

    // Healing option
    const canHeal = state.player.gold >= config.shop.healCost && state.player.hp < state.player.maxHp;
    this.createShopItem(
      cx,
      yPos,
      width - 40,
      `HEAL +${config.shop.healAmount} HP`,
      `Restore health (${config.shop.healCost} gold)`,
      config.shop.healCost,
      canHeal,
      () => this.buyHealing()
    );
    yPos += 80;

    // Available relics for purchase
    const allRelics = manager.getAllRelics();
    const ownedIds = new Set(state.player.relics.map((r) => r.id));
    const availableRelics = allRelics.filter((r) => !ownedIds.has(r.id)).slice(0, 2);

    availableRelics.forEach((relic) => {
      const canBuy = state.player.gold >= config.shop.relicBaseCost;
      this.createShopItem(
        cx,
        yPos,
        width - 40,
        relic.name,
        `${relic.description} (${config.shop.relicBaseCost} gold)`,
        config.shop.relicBaseCost,
        canBuy,
        () => this.buyRelic(relic.id)
      );
      yPos += 80;
    });

    if (availableRelics.length === 0) {
      this.add
        .text(cx, yPos + 20, 'No relics available', {
          fontFamily: 'Arial, sans-serif',
          fontSize: '12px',
          color: '#6a7a8a',
        })
        .setOrigin(0.5);
      yPos += 60;
    }

    // Continue button
    const continueY = Math.min(height * 0.75, yPos + 40);
    const continueBtn = this.add
      .rectangle(cx, continueY, width - 60, 55, 0x3a6a3a)
      .setStrokeStyle(2, 0x5a9a5a)
      .setInteractive({ useHandCursor: true });

    this.add
      .text(cx, continueY, 'CONTINUE', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '18px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    continueBtn.on('pointerdown', () => this.proceed());
    continueBtn.on('pointerover', () => continueBtn.setFillStyle(0x4a8a4a));
    continueBtn.on('pointerout', () => continueBtn.setFillStyle(0x3a6a3a));

    // Player stats at bottom
    this.drawPlayerStats(width, height, state);
  }

  private createShopItem(
    x: number,
    y: number,
    width: number,
    title: string,
    description: string,
    cost: number,
    canBuy: boolean,
    onClick: () => void
  ): void {
    const itemHeight = 65;
    const bgColor = canBuy ? 0x1a2535 : 0x151a25;
    const borderColor = canBuy ? 0x3a5a7a : 0x2a3a4a;
    const textColor = canBuy ? '#e8e0d0' : '#6a7a8a';

    const card = this.add
      .rectangle(x, y + itemHeight / 2, width, itemHeight, bgColor)
      .setStrokeStyle(1, borderColor);

    if (canBuy) {
      card.setInteractive({ useHandCursor: true });
      card.on('pointerdown', onClick);
      card.on('pointerover', () => {
        card.setFillStyle(0x2a3545);
        card.setStrokeStyle(2, 0xf0cf68);
      });
      card.on('pointerout', () => {
        card.setFillStyle(bgColor);
        card.setStrokeStyle(1, borderColor);
      });
    }

    this.add
      .text(x - width / 2 + 15, y + 15, title, {
        fontFamily: 'Georgia, serif',
        fontSize: '14px',
        fontStyle: 'bold',
        color: textColor,
      });

    this.add
      .text(x - width / 2 + 15, y + 38, description, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '11px',
        color: canBuy ? '#8a9bb8' : '#5a6a7a',
      });

    // Cost badge
    this.add
      .text(x + width / 2 - 15, y + itemHeight / 2, `♦${cost}`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '13px',
        fontStyle: 'bold',
        color: canBuy ? '#f0cf68' : '#6a6a6a',
      })
      .setOrigin(1, 0.5);
  }

  private drawBackground(width: number, height: number): void {
    const g = this.add.graphics();
    g.fillStyle(0x0c1220, 1);
    g.fillRect(0, 0, width, height);
  }

  private drawPlayerStats(width: number, height: number, state: RunState): void {
    const y = height - 40;

    this.add
      .text(20, y, `♥ ${state.player.hp}/${state.player.maxHp}`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#ff6677',
      });

    // Show relics
    if (state.player.relics.length > 0) {
      const relicText = state.player.relics.map((r) => '◆').join(' ');
      this.add
        .text(width - 20, y, relicText, {
          fontFamily: 'Arial',
          fontSize: '14px',
          color: '#a080c0',
        })
        .setOrigin(1, 0);
    }
  }

  private buyHealing(): void {
    const manager = getGameManager();
    manager.buyHealing();
    this.scene.restart();
  }

  private buyRelic(relicId: string): void {
    const manager = getGameManager();
    manager.buyShopRelic(relicId);
    this.scene.restart();
  }

  private proceed(): void {
    const manager = getGameManager();
    manager.proceedFromShop();
    this.scene.start('BattleScene');
  }
}
