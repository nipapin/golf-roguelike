import { viewport, getRenderDensity, safeArea } from './viewport';
/**
 * SettingsModal - In-game settings panel
 * Per STYLE.md: dark ink outline, cream panel, 3D Supercell-style buttons
 */

import Phaser from 'phaser';
import { colors } from './tokens';
import { AudioSystem } from '../audio/AudioSystem';

export interface SettingsModalCallbacks {
  onResume: () => void;
  onRestart: () => void;
  onMainMenu: () => void;
}

export class SettingsModal {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private overlay: Phaser.GameObjects.Rectangle;
  private callbacks: SettingsModalCallbacks;
  private confirmContainer: Phaser.GameObjects.Container | null = null;
  private isOpen: boolean = false;

  constructor(scene: Phaser.Scene, callbacks: SettingsModalCallbacks) {
    this.scene = scene;
    this.callbacks = callbacks;
    
    const width = viewport(scene).width;
    const height = viewport(scene).height;
    
    // Dark overlay
    this.overlay = scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7);
    this.overlay.setInteractive();
    this.overlay.setDepth(200);
    
    // Main container
    this.container = scene.add.container(width / 2, safeArea(scene).centerY);
    this.container.setDepth(201);
    
    this.createPanel();
    this.hide();
  }

  private createPanel(): void {
    const panelWidth = 280;
    const panelHeight = 440;
    
    // Panel background (cream with dark outline)
    const panel = this.scene.add.graphics();
    
    // Outer shadow
    panel.fillStyle(colors.ink, 1);
    panel.fillRoundedRect(-panelWidth / 2 + 4, -panelHeight / 2 + 6, panelWidth, panelHeight, 20);
    
    // Cream background with gradient
    panel.fillStyle(colors.faceHi, 1);
    panel.fillGradientStyle(colors.faceHi, colors.faceHi, colors.faceLo, colors.faceLo, 1);
    panel.fillRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 20);
    
    // Inner border
    panel.lineStyle(4, colors.ink, 1);
    panel.strokeRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 20);
    
    // Top decorative bar
    panel.fillStyle(colors.violet, 1);
    panel.fillRoundedRect(-panelWidth / 2 + 20, -panelHeight / 2 + 10, panelWidth - 40, 6, 3);
    
    this.container.add(panel);
    
    // Title
    const title = this.scene.add.text(0, -panelHeight / 2 + 40, 'SETTINGS', {
      resolution: getRenderDensity(), fontFamily: 'Lilita One',
      fontSize: '28px',
      color: '#1B1030',
    }).setOrigin(0.5);
    this.container.add(title);
    
    // Sound toggle
    const soundY = -130;
    this.createToggle(0, soundY, 'Sound', AudioSystem.isSoundEnabled, (enabled) => {
      AudioSystem.isSoundEnabled = enabled;
      if (enabled) AudioSystem.play('button_tap');
    });
    
    this.createVolume(-95, () => AudioSystem.soundVolume, (value) => { AudioSystem.soundVolume = value; });
    this.createToggle(0, -45, 'Music', AudioSystem.isMusicEnabled, (enabled) => {
      AudioSystem.unlock();
      AudioSystem.isMusicEnabled = enabled;
    });
    this.createVolume(-10, () => AudioSystem.musicVolume, (value) => { AudioSystem.musicVolume = value; });

    // Buttons
    const buttonY = 55;
    const buttonSpacing = 54;
    
    // Resume button (green - primary action)
    this.createButton(0, buttonY, 'RESUME', colors.green, colors.greenLo, () => {
      AudioSystem.play('button_tap');
      this.hide();
      this.callbacks.onResume();
    });
    
    // Restart Run button (yellow with confirm)
    this.createButton(0, buttonY + buttonSpacing, 'RESTART RUN', colors.gold, colors.goldLo, () => {
      AudioSystem.play('button_tap');
      this.showRestartConfirm();
    });
    
    // Main Menu button (blue)
    this.createButton(0, buttonY + buttonSpacing * 2, 'MAIN MENU', colors.blue, colors.blueLo, () => {
      AudioSystem.play('button_tap');
      this.hide();
      this.callbacks.onMainMenu();
    });
  }

  private createToggle(
    x: number,
    y: number,
    label: string,
    initialValue: boolean,
    onChange: (enabled: boolean) => void
  ): void {
    const toggleWidth = 60;
    const toggleHeight = 32;
    let enabled = initialValue;
    
    // Label
    const labelText = this.scene.add.text(x - 80, y, label, {
      resolution: getRenderDensity(), fontFamily: 'Lilita One',
      fontSize: '20px',
      color: '#1B1030',
    }).setOrigin(0, 0.5);
    this.container.add(labelText);
    
    // Toggle track
    const track = this.scene.add.graphics();
    const knob = this.scene.add.graphics();
    
    const drawToggle = () => {
      track.clear();
      knob.clear();
      
      // Track
      const trackColor = enabled ? colors.green : 0x8a8a8a;
      track.fillStyle(trackColor, 1);
      track.fillRoundedRect(x + 40, y - toggleHeight / 2, toggleWidth, toggleHeight, toggleHeight / 2);
      track.lineStyle(3, colors.ink, 1);
      track.strokeRoundedRect(x + 40, y - toggleHeight / 2, toggleWidth, toggleHeight, toggleHeight / 2);
      
      // Knob
      const knobX = enabled ? x + 40 + toggleWidth - toggleHeight / 2 - 2 : x + 40 + toggleHeight / 2 + 2;
      knob.fillStyle(0xffffff, 1);
      knob.fillCircle(knobX, y, toggleHeight / 2 - 4);
      knob.lineStyle(2, colors.ink, 1);
      knob.strokeCircle(knobX, y, toggleHeight / 2 - 4);
    };
    
    drawToggle();
    
    this.container.add(track);
    this.container.add(knob);
    
    // Interactive zone
    const hitZone = this.scene.add.zone(x + 40 + toggleWidth / 2, y, toggleWidth + 20, Math.max(44, toggleHeight + 14));
    hitZone.setInteractive();
    hitZone.on('pointerdown', () => {
      enabled = !enabled;
      drawToggle();
      onChange(enabled);
    });
    this.container.add(hitZone);
  }

  private createVolume(y: number, get: () => number, set: (value: number) => void): void {
    const valueText = this.scene.add.text(0, y, `${Math.round(get() * 100)}%`, {
      resolution: getRenderDensity(), fontFamily: 'Fredoka', fontSize: '16px', color: '#442960',
    }).setOrigin(0.5);
    this.container.add(valueText);
    for (const [x, delta, label] of [[-80, -0.1, '−'], [80, 0.1, '+']] as const) {
      // Visual 40×30, touch target 48×44.
      const button = this.scene.add.rectangle(x, y, 40, 30, 0xd9c6eb).setInteractive(new Phaser.Geom.Rectangle(-4, -7, 48, 44), Phaser.Geom.Rectangle.Contains);
      button.on('pointerup', () => {
        AudioSystem.unlock();
        set(Math.round((get() + delta) * 100) / 100);
        valueText.setText(`${Math.round(get() * 100)}%`);
      });
      this.container.add([button, this.scene.add.text(x, y, label, { resolution: getRenderDensity(), fontFamily: 'Fredoka', fontSize: '20px', color: '#27173d' }).setOrigin(0.5)]);
    }
  }

  private createButton(
    x: number,
    y: number,
    text: string,
    colorHi: number,
    colorLo: number,
    callback: () => void
  ): Phaser.GameObjects.Container {
    const buttonWidth = 200;
    const buttonHeight = 48;
    
    const buttonContainer = this.scene.add.container(x, y);
    
    const bg = this.scene.add.graphics();
    
    // Shadow
    bg.fillStyle(colors.ink, 1);
    bg.fillRoundedRect(-buttonWidth / 2, -buttonHeight / 2 + 5, buttonWidth, buttonHeight, 14);
    
    // Button body
    bg.fillStyle(colorHi, 1);
    bg.fillGradientStyle(colorHi, colorHi, colorLo, colorLo, 1);
    bg.fillRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight - 5, 14);
    
    // Highlight
    bg.fillStyle(0xffffff, 0.35);
    bg.fillRoundedRect(-buttonWidth / 2 + 8, -buttonHeight / 2 + 4, buttonWidth - 16, 8, 4);
    
    // Outline
    bg.lineStyle(3, colors.ink, 1);
    bg.strokeRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight - 5, 14);
    
    buttonContainer.add(bg);
    
    // Text
    const buttonText = this.scene.add.text(0, -3, text, {
      resolution: getRenderDensity(), fontFamily: 'Lilita One',
      fontSize: '18px',
      color: '#ffffff',
    }).setOrigin(0.5).setStroke('#1B1030', 4);
    buttonContainer.add(buttonText);
    
    // Interactivity
    buttonContainer.setInteractive(
      new Phaser.Geom.Rectangle(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight),
      Phaser.Geom.Rectangle.Contains
    );
    
    buttonContainer.on('pointerdown', () => {
      buttonContainer.setScale(0.95);
    });
    
    buttonContainer.on('pointerup', () => {
      buttonContainer.setScale(1);
      callback();
    });
    
    buttonContainer.on('pointerout', () => {
      buttonContainer.setScale(1);
    });
    
    this.container.add(buttonContainer);
    return buttonContainer;
  }

  private showRestartConfirm(): void {
    if (this.confirmContainer) {
      this.confirmContainer.destroy();
    }
    
    const confirmWidth = 240;
    const confirmHeight = 140;
    
    this.confirmContainer = this.scene.add.container(0, 0);
    
    // Darken the main panel
    const darken = this.scene.add.rectangle(0, 0, 300, 360, 0x000000, 0.5);
    this.confirmContainer.add(darken);
    
    // Confirm panel
    const panel = this.scene.add.graphics();
    panel.fillStyle(colors.red, 0.95);
    panel.fillRoundedRect(-confirmWidth / 2, -confirmHeight / 2, confirmWidth, confirmHeight, 16);
    panel.lineStyle(3, colors.ink, 1);
    panel.strokeRoundedRect(-confirmWidth / 2, -confirmHeight / 2, confirmWidth, confirmHeight, 16);
    this.confirmContainer.add(panel);
    
    // Warning text
    const warningText = this.scene.add.text(0, -confirmHeight / 2 + 30, 'Restart this run?', {
      resolution: getRenderDensity(), fontFamily: 'Lilita One',
      fontSize: '20px',
      color: '#ffffff',
    }).setOrigin(0.5).setStroke('#1B1030', 3);
    this.confirmContainer.add(warningText);
    
    const subText = this.scene.add.text(0, -confirmHeight / 2 + 55, 'Progress will be lost!', {
      resolution: getRenderDensity(), fontFamily: 'Fredoka',
      fontSize: '14px',
      color: '#FFD0D0',
    }).setOrigin(0.5);
    this.confirmContainer.add(subText);
    
    // Confirm button
    const confirmBtn = this.createConfirmButton(-55, 30, 'YES', colors.red, colors.redLo, () => {
      AudioSystem.play('button_tap');
      this.hide();
      this.callbacks.onRestart();
    });
    this.confirmContainer.add(confirmBtn);
    
    // Cancel button
    const cancelBtn = this.createConfirmButton(55, 30, 'NO', colors.blue, colors.blueLo, () => {
      AudioSystem.play('button_tap');
      this.hideConfirm();
    });
    this.confirmContainer.add(cancelBtn);
    
    this.container.add(this.confirmContainer);
  }

  private createConfirmButton(
    x: number,
    y: number,
    text: string,
    colorHi: number,
    colorLo: number,
    callback: () => void
  ): Phaser.GameObjects.Container {
    const btnW = 80;
    const btnH = 44;
    
    const btn = this.scene.add.container(x, y);
    
    const bg = this.scene.add.graphics();
    bg.fillStyle(colors.ink, 1);
    bg.fillRoundedRect(-btnW / 2, -btnH / 2 + 4, btnW, btnH, 12);
    bg.fillStyle(colorHi, 1);
    bg.fillGradientStyle(colorHi, colorHi, colorLo, colorLo, 1);
    bg.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH - 4, 12);
    bg.lineStyle(2.5, colors.ink, 1);
    bg.strokeRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH - 4, 12);
    btn.add(bg);
    
    const txt = this.scene.add.text(0, -2, text, {
      resolution: getRenderDensity(), fontFamily: 'Lilita One',
      fontSize: '16px',
      color: '#ffffff',
    }).setOrigin(0.5).setStroke('#1B1030', 3);
    btn.add(txt);
    
    btn.setInteractive(
      new Phaser.Geom.Rectangle(-btnW / 2, -btnH / 2, btnW, btnH),
      Phaser.Geom.Rectangle.Contains
    );
    
    btn.on('pointerdown', () => btn.setScale(0.95));
    btn.on('pointerup', () => { btn.setScale(1); callback(); });
    btn.on('pointerout', () => btn.setScale(1));
    
    return btn;
  }

  private hideConfirm(): void {
    if (this.confirmContainer) {
      this.confirmContainer.destroy();
      this.confirmContainer = null;
    }
  }

  show(): void {
    this.isOpen = true;
    this.overlay.setVisible(true);
    this.container.setVisible(true);
    this.hideConfirm();
  }

  hide(): void {
    this.isOpen = false;
    this.overlay.setVisible(false);
    this.container.setVisible(false);
    this.hideConfirm();
  }

  toggle(): void {
    if (this.isOpen) {
      this.hide();
    } else {
      this.show();
    }
  }

  isVisible(): boolean {
    return this.isOpen;
  }

  destroy(): void {
    this.overlay.destroy();
    this.container.destroy();
  }
}
