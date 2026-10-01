import { viewport, getRenderDensity, safeArea } from './viewport';
import Phaser from 'phaser';
import { colors } from './tokens';
import { ArenaBackground } from './ArenaBackground';
import { AudioSystem } from '../audio/AudioSystem';

/** Shared modal language: teal felt, shaded panels, cream cards, gold buttons. */
export function gamePopup(scene: Phaser.Scene, title: string, subtitle: string, height: number) {
  const w = Math.min(viewport(scene).width - 24, 420);
  const safe = safeArea(scene);
  const h = Math.min(height, safe.height - 16);
  // Backdrop/shade cover the full screen; the panel stays inside the safe band.
  const root = scene.add.container(viewport(scene).width / 2, safe.centerY).setDepth(1000);
  // Restore/save routes may open a modal without a live battle beneath it.
  if (!scene.scene.isPaused('BattleScene') && !scene.scene.isActive('CastleScene')) {
    const arena = new ArenaBackground(scene);
    arena.draw(viewport(scene).width, 0, viewport(scene).height * 0.6, 'goblin_camp');
    const felt = scene.add.rectangle(
      viewport(scene).width / 2,
      viewport(scene).height * 0.8,
      viewport(scene).width,
      viewport(scene).height * 0.4,
      colors.felt
    );
    arena.setDepth(-2);
    felt.setDepth(-1);
  }
  const shade = scene.add
    .rectangle(
      0,
      viewport(scene).height / 2 - safe.centerY,
      viewport(scene).width,
      viewport(scene).height,
      colors.ink,
      0.8
    )
    .setInteractive();
  root.add(shade);
  const panel = scene.add.graphics();
  panel.fillStyle(colors.ink).fillRoundedRect(-w / 2, -h / 2 + 8, w, h, 22);
  panel.fillStyle(colors.feltLo).fillRoundedRect(-w / 2, -h / 2, w, h, 22);
  panel.lineStyle(4, colors.ink).strokeRoundedRect(-w / 2, -h / 2, w, h, 22);
  panel.lineStyle(2, 0x729fa3).strokeRoundedRect(-w / 2 + 5, -h / 2 + 5, w - 10, h - 10, 18);
  root.add(panel);
  root.add(
    scene.add
      .text(0, -h / 2 + 36, title, {
        resolution: getRenderDensity(),
        fontFamily: 'Lilita One',
        fontSize: '28px',
        color: '#ffe35a',
      })
      .setOrigin(0.5)
      .setStroke('#19313c', 5)
  );
  root.add(
    scene.add
      .text(0, -h / 2 + 74, subtitle, {
        resolution: getRenderDensity(),
        fontFamily: 'Fredoka',
        fontSize: '13px',
        color: '#f4e9ff',
        align: 'center',
        wordWrap: { width: w - 32 },
      })
      .setOrigin(0.5)
  );
  // Animate the panel contents, not the full-screen input-blocking backdrop.
  const content = scene.add.container(0, 0);
  root.add(content);
  content.setScale(0.9).setAlpha(0);
  scene.tweens.add({ targets: content, scale: 1, alpha: 1, duration: 300, ease: 'Back.out' });
  const resize = () => scene.scene.restart();
  scene.scale.once('resize', resize);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.scale.off('resize', resize));
  return { root, content, width: w, height: h, top: -h / 2 };
}

export function popupButton(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  y: number,
  width: number,
  label: string,
  callback: () => void,
  secondary = false
) {
  const button = scene.add.container(0, y);
  const g = scene.add.graphics();
  g.fillStyle(colors.ink).fillRoundedRect(-width / 2, -24 + 5, width, 48, 14);
  g.fillStyle(secondary ? colors.blueLo : colors.goldLo).fillRoundedRect(
    -width / 2,
    -24,
    width,
    48,
    14
  );
  g.fillStyle(secondary ? colors.blue : colors.gold).fillRoundedRect(
    -width / 2,
    -24,
    width,
    39,
    14
  );
  g.fillStyle(0xffffff, 0.28).fillRoundedRect(-width / 2 + 8, -20, width - 16, 7, 4);
  g.lineStyle(3, colors.ink).strokeRoundedRect(-width / 2, -24, width, 48, 14);
  button.add(g);
  button.add(
    scene.add
      .text(0, -2, label, {
        resolution: getRenderDensity(),
        fontFamily: 'Lilita One',
        fontSize: '21px',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setStroke('#19313c', 4)
  );
  button.setInteractive(
    new Phaser.Geom.Rectangle(-width / 2, -24, width, 48),
    Phaser.Geom.Rectangle.Contains
  );
  button.on('pointerdown', () => button.setScale(0.96));
  button.on('pointerout', () => button.setScale(1));
  button.on('pointerup', () => {
    button.setScale(1);
    AudioSystem.unlock();
    AudioSystem.play('button_tap');
    callback();
  });
  parent.add(button);
  return button;
}

export function popupTile(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  y: number,
  width: number,
  height: number,
  icon: string,
  title: string,
  description: string,
  badge: string,
  enabled: boolean,
  callback: () => void
) {
  const tile = scene.add.container(0, y);
  const g = scene.add.graphics();
  g.fillStyle(colors.ink).fillRoundedRect(-width / 2, 4, width, height, 14);
  g.fillStyle(enabled ? colors.face : 0xd9cbbf).fillRoundedRect(-width / 2, 0, width, height, 14);
  g.lineStyle(3, colors.ink).strokeRoundedRect(-width / 2, 0, width, height, 14);
  g.fillStyle(colors.violet).fillRoundedRect(-width / 2 + 10, 16, 38, 42, 10);
  tile.add(g);
  tile.add(
    scene.add
      .text(-width / 2 + 29, 37, icon, {
        resolution: getRenderDensity(),
        fontFamily: 'Lilita One',
        fontSize: '24px',
        color: '#ffe35a',
      })
      .setOrigin(0.5)
  );
  tile.add(
    scene.add.text(-width / 2 + 58, 12, title, {
      resolution: getRenderDensity(),
      fontFamily: 'Lilita One',
      fontSize: '17px',
      color: '#322149',
      wordWrap: { width: width - 74 },
    })
  );
  tile.add(
    scene.add.text(-width / 2 + 58, 36, description, {
      resolution: getRenderDensity(),
      fontFamily: 'Fredoka',
      fontSize: '13px',
      color: '#634d74',
      wordWrap: { width: width - 74 },
    })
  );
  if (badge)
    tile.add(
      scene.add
        .text(width / 2 - 12, height - 13, badge, {
          resolution: getRenderDensity(),
          fontFamily: 'Lilita One',
          fontSize: '13px',
          color: enabled ? '#855100' : '#755e6f',
        })
        .setOrigin(1, 0.5)
    );
  tile.setInteractive(
    new Phaser.Geom.Rectangle(-width / 2, 0, width, height),
    Phaser.Geom.Rectangle.Contains
  );
  tile.on('pointerup', () => {
    if (!enabled) {
      AudioSystem.unlock();
      AudioSystem.play('invalid_tap', { volume: 0.4 });
      scene.tweens.add({ targets: tile, x: 4, duration: 45, yoyo: true, repeat: 2 });
      return;
    }
    callback();
  });
  parent.add(tile);
  return tile;
}
