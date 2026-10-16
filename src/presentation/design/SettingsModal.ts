import { isShakeReduced, setShakeReduced } from '../juice/fxSettings';
import { isHapticsEnabled, setHapticsEnabled, tapFeedback } from '../haptics/haptics';
import { isFullscreenSupported, isFullscreen, toggleFullscreen, onFullscreenChange } from '../fullscreen/fullscreen';
import { viewport, getRenderDensity, safeArea } from './viewport';
/**
 * SettingsModal - In-game settings panel
 * Per STYLE.md: dark ink outline, cream panel, 3D Supercell-style buttons
 */

import Phaser from 'phaser';
import { colors } from './tokens';
import { AudioSystem } from '../audio/AudioSystem';
import { gameDisplayStyle } from './displayFont';

export interface SettingsModalCallbacks {
  onResume: () => void;
  onRestart: () => void;
  onMainMenu: () => void;
  variant?: 'game' | 'menu';
  onMore?: () => void;
}

export class SettingsModal {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private overlay: Phaser.GameObjects.Rectangle;
  private callbacks: SettingsModalCallbacks;
  private confirmContainer: Phaser.GameObjects.Container | null = null;
  private isOpen: boolean = false;
  private panelWidth: number;
  private panelHeight: number;

  constructor(scene: Phaser.Scene, callbacks: SettingsModalCallbacks) {
    this.scene = scene;
    this.callbacks = callbacks;
    
    const width = viewport(scene).width;
    const height = viewport(scene).height;
    this.panelWidth = Math.min(420, width - 32);
    this.panelHeight = callbacks.variant === 'menu' ? 520 : 580;
    
    // Dark overlay
    this.overlay = scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7);
    this.overlay.setInteractive();
    this.overlay.setDepth(200);
    
    // Main container
    this.container = scene.add.container(width / 2, safeArea(scene).centerY).setName('settings-panel');
    this.container.setDepth(201);
    
    this.createPanel();
    this.container.setScale(Math.min(1, (safeArea(scene).height - 24) / this.panelHeight));
    this.hide();
  }

  private createPanel(): void {
    const panelWidth = this.panelWidth;
    const menu = this.callbacks.variant === 'menu';
    const panelHeight = this.panelHeight;
    
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
    const titleText = menu ? 'НАСТРОЙКИ' : 'SETTINGS';
    const title = this.scene.add.text(0, -panelHeight / 2 + 40, titleText, {
      resolution: getRenderDensity(), ...gameDisplayStyle(titleText),
      fontSize: menu ? '24px' : '28px',
      color: '#1B1030',
    }).setOrigin(0.5);
    this.container.add(title);
    
    // Sound toggle
    const soundY = -panelHeight / 2 + 90;
    this.createToggle(0, soundY, menu ? 'Звук' : 'Sound', AudioSystem.isSoundEnabled, (enabled) => {
      AudioSystem.isSoundEnabled = enabled;
      if (enabled) AudioSystem.play('button_tap');
    }, 'settings-sound-toggle');
    
    this.createVolume(soundY + 38, () => AudioSystem.soundVolume, (value) => { AudioSystem.soundVolume = value; }, 'sound');
    this.createToggle(0, soundY + 100, menu ? 'Музыка' : 'Music', AudioSystem.isMusicEnabled, (enabled) => {
      AudioSystem.unlock();
      AudioSystem.isMusicEnabled = enabled;
    }, 'settings-music-toggle');
    this.createVolume(soundY + 138, () => AudioSystem.musicVolume, (value) => { AudioSystem.musicVolume = value; }, 'music');
    // Accessibility: reduce camera shake (persisted)
    this.createToggle(0, soundY + 200, menu ? 'Меньше тряски' : 'Less shake', isShakeReduced(), (enabled) => { setShakeReduced(enabled); }, 'settings-shake-toggle');
    
    // Haptics toggle (mobile vibration feedback)
    this.createToggle(0, soundY + 250, menu ? 'Вибрация' : 'Haptics', isHapticsEnabled(), (enabled) => { 
      setHapticsEnabled(enabled);
      if (enabled) tapFeedback();
    }, 'settings-haptics-toggle');

    if (menu) {
      if (isFullscreenSupported()) {
        this.createFullscreenButton(0, soundY + 310);
      }
      this.createButton(0, soundY + (isFullscreenSupported() ? 372 : 310), 'НАЗАД', colors.gold, colors.goldLo, () => {
        this.hide(); this.callbacks.onResume();
      }).setName('menu-settings-back');
      this.createButton(0, soundY + (isFullscreenSupported() ? 434 : 372), 'ДОПОЛНИТЕЛЬНО', colors.blue, colors.blueLo, () => {
        this.hide(); this.callbacks.onMore?.();
      }).setName('menu-settings-more');
      return;
    }

    // Fullscreen button (only on supported platforms)
    if (isFullscreenSupported()) {
      this.createFullscreenButton(0, soundY + 310);
    }

    // Buttons
    const buttonY = soundY + (isFullscreenSupported() ? 372 : 310);
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
    onChange: (enabled: boolean) => void,
    name: string
  ): void {
    const toggleWidth = 60;
    const toggleHeight = 32;
    const trackX = x + this.panelWidth / 2 - 32 - toggleWidth;
    const labelX = x - this.panelWidth / 2 + 32;
    let enabled = initialValue;
    
    // Label
    const labelText = this.scene.add.text(labelX, y, label, {
      resolution: getRenderDensity(), ...gameDisplayStyle(label),
      fontSize: '20px',
      color: '#1B1030',
    }).setOrigin(0, 0.5);
    const labelWidth = trackX - labelX - 16;
    if (labelText.width > labelWidth) labelText.setFontSize(20 * labelWidth / labelText.width);
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
      track.fillRoundedRect(trackX, y - toggleHeight / 2, toggleWidth, toggleHeight, toggleHeight / 2);
      track.lineStyle(3, colors.ink, 1);
      track.strokeRoundedRect(trackX, y - toggleHeight / 2, toggleWidth, toggleHeight, toggleHeight / 2);
      
      // Knob
      const knobX = enabled ? trackX + toggleWidth - toggleHeight / 2 - 2 : trackX + toggleHeight / 2 + 2;
      knob.fillStyle(0xffffff, 1);
      knob.fillCircle(knobX, y, toggleHeight / 2 - 4);
      knob.lineStyle(2, colors.ink, 1);
      knob.strokeCircle(knobX, y, toggleHeight / 2 - 4);
    };
    
    drawToggle();
    
    this.container.add(track);
    this.container.add(knob);
    
    // Interactive zone
    const hitZone = this.scene.add.zone(trackX + toggleWidth / 2, y, toggleWidth + 20, Math.max(44, toggleHeight + 14)).setName(name);
    hitZone.setInteractive();
    hitZone.on('pointerdown', () => {
      enabled = !enabled;
      drawToggle();
      onChange(enabled);
    });
    this.container.add(hitZone);
  }

  private fullscreenCleanup?: () => void;

  private createFullscreenButton(x: number, y: number): void {
    const buttonWidth = Math.min(280, this.panelWidth - 64);
    const buttonHeight = 48;
    
    const buttonContainer = this.scene.add.container(x, y).setName('settings-fullscreen-button');
    
    const bg = this.scene.add.graphics();
    
    const redraw = () => {
      const full = isFullscreen();
      const colorHi = full ? colors.violet : colors.blue;
      const colorLo = full ? 0x5a3a7a : colors.blueLo;
      
      bg.clear();
      bg.fillStyle(colors.ink, 1);
      bg.fillRoundedRect(-buttonWidth / 2, -buttonHeight / 2 + 5, buttonWidth, buttonHeight, 14);
      bg.fillStyle(colorHi, 1);
      bg.fillGradientStyle(colorHi, colorHi, colorLo, colorLo, 1);
      bg.fillRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight - 5, 14);
      bg.fillStyle(0xffffff, 0.35);
      bg.fillRoundedRect(-buttonWidth / 2 + 8, -buttonHeight / 2 + 4, buttonWidth - 16, 8, 4);
      bg.lineStyle(3, colors.ink, 1);
      bg.strokeRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight - 5, 14);
      
      const label = full ? 'EXIT FULLSCREEN' : 'FULLSCREEN';
      const text = buttonContainer.getByName('fullscreen-text') as Phaser.GameObjects.Text;
      if (text) text.setText(label);
    };
    
    buttonContainer.add(bg);
    
    const buttonText = this.scene.add.text(0, -3, isFullscreen() ? 'EXIT FULLSCREEN' : 'FULLSCREEN', {
      resolution: getRenderDensity(), ...gameDisplayStyle('FULLSCREEN'),
      fontSize: '18px',
      color: '#ffffff',
    }).setOrigin(0.5).setStroke('#1B1030', 4).setName('fullscreen-text');
    if (buttonText.width > buttonWidth - 22) buttonText.setFontSize(18 * (buttonWidth - 22) / buttonText.width);
    buttonContainer.add(buttonText);
    
    buttonContainer.setInteractive(
      new Phaser.Geom.Rectangle(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight),
      Phaser.Geom.Rectangle.Contains
    );
    
    buttonContainer.on('pointerdown', () => {
      buttonContainer.setScale(0.95);
    });
    
    buttonContainer.on('pointerup', () => {
      buttonContainer.setScale(1);
      AudioSystem.play('button_tap');
      tapFeedback();
      toggleFullscreen().then(() => redraw());
    });
    
    buttonContainer.on('pointerout', () => {
      buttonContainer.setScale(1);
    });
    
    this.fullscreenCleanup = onFullscreenChange(() => redraw());
    
    this.container.add(buttonContainer);
  }

  private createVolume(y: number, get: () => number, set: (value: number) => void, name: string): void {
    const left = -this.panelWidth / 2 + 32;
    const trackWidth = this.panelWidth - 64 - 60;
    const track = this.scene.add.graphics();
    const valueText = this.scene.add.text(this.panelWidth / 2 - 32, y, '', {
      resolution: getRenderDensity(), ...gameDisplayStyle('0%'), fontSize: '18px', color: '#442960',
    }).setOrigin(1, 0.5).setName(`settings-${name}-value`);
    const draw = () => {
      const value = Phaser.Math.Clamp(get(), 0, 1);
      const knobX = left + trackWidth * value;
      track.clear();
      track.fillStyle(0xd9c6eb, 1);
      track.fillRoundedRect(left, y - 6, trackWidth, 12, 6);
      if (value > 0) {
        track.fillGradientStyle(colors.violet, colors.blue, colors.violet, colors.blue, 1);
        track.fillRoundedRect(left, y - 6, Math.max(12, trackWidth * value), 12, 6);
      }
      track.lineStyle(2, colors.ink, 1);
      track.strokeRoundedRect(left, y - 6, trackWidth, 12, 6);
      track.fillStyle(colors.ink, 1);
      track.fillCircle(knobX, y + 3, 12);
      track.fillStyle(colors.gold, 1);
      track.fillCircle(knobX, y, 12);
      track.lineStyle(2.5, colors.ink, 1);
      track.strokeCircle(knobX, y, 12);
      track.fillStyle(0xffffff, 0.7);
      track.fillCircle(knobX - 3, y - 4, 4);
      valueText.setText(`${Math.round(value * 100)}%`);
    };
    draw();
    // The whole track accepts taps and drags, including a 44px-high touch target.
    const hitZone = this.scene.add.zone(left + trackWidth / 2, y, trackWidth + 24, 44)
      .setName(`settings-${name}-slider`).setInteractive({ useHandCursor: true });
    const worldPoint = new Phaser.Math.Vector2();
    const localPoint = new Phaser.Math.Vector2();
    const update = (pointer: Phaser.Input.Pointer) => {
      // Pointer positions are canvas pixels; undo camera zoom before the panel transform.
      this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y, worldPoint);
      const local = this.container.getWorldTransformMatrix().applyInverse(worldPoint.x, worldPoint.y, localPoint);
      const value = Phaser.Math.Clamp((local.x - left) / trackWidth, 0, 1);
      set(value);
      draw();
    };
    hitZone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      AudioSystem.unlock();
      update(pointer);
    });
    this.scene.input.setDraggable(hitZone);
    hitZone.on('drag', update);
    this.container.add([track, valueText, hitZone]);
  }

  private createButton(
    x: number,
    y: number,
    text: string,
    colorHi: number,
    colorLo: number,
    callback: () => void
  ): Phaser.GameObjects.Container {
    const buttonWidth = Math.min(280, this.panelWidth - 64);
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
      resolution: getRenderDensity(), ...gameDisplayStyle(text),
      fontSize: '18px',
      color: '#ffffff',
    }).setOrigin(0.5).setStroke('#1B1030', 4);
    if (buttonText.width > buttonWidth - 22) buttonText.setFontSize(18 * (buttonWidth - 22) / buttonText.width);
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
    const darken = this.scene.add.rectangle(0, 0, this.panelWidth, this.panelHeight, 0x000000, 0.5).setInteractive();
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
    this.fullscreenCleanup?.();
    this.overlay.destroy();
    this.container.destroy();
  }
}
