import type Phaser from 'phaser';
import type { CastleRun } from './CastleDefense';
import { getRenderDensity, safeArea, viewport } from '../presentation/design/viewport';
import { gameDisplayStyle } from '../presentation/design/displayFont';
import { gildedPanel } from '../presentation/design/GameFeel';
import { popupButton } from '../presentation/design/GamePopup';
import { AudioSystem } from '../presentation/audio/AudioSystem';
import { isShakeReduced } from '../presentation/juice/fxSettings';

function runTime(seconds: number): string {
  const total = Math.floor(seconds), minutes = Math.floor(total / 60);
  return minutes >= 60
    ? `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
    : `${minutes}:${String(total % 60).padStart(2, '0')}`;
}

/** Celebrate the outcome first, then reveal cumulative run totals and enabled actions. */
export function showCastleRoundResult(scene: Phaser.Scene, state: CastleRun,
  callbacks: { next: () => boolean | void; menu: () => boolean | void }): Phaser.GameObjects.Container {
  const won = state.run.phase === 'victory', reduced = isShakeReduced();
  const screen = viewport(scene), safe = safeArea(scene);
  const width = Math.min(480, screen.width - 24), height = Math.min(560, safe.height - 12);
  const top = -height / 2;
  const root = scene.add.container(screen.width / 2, safe.centerY)
    .setDepth(3000).setName('castle-round-result');
  const owned: Phaser.GameObjects.GameObject[] = [root];
  const own = <T extends Phaser.GameObjects.GameObject>(object: T): T => { owned.push(object); return object; };
  const text = (parent: Phaser.GameObjects.Container, x: number, y: number, value: string,
    size: number, color = '#fff1cc') => {
    const label = own(scene.add.text(x, y, value, {
      resolution: getRenderDensity(), ...gameDisplayStyle(value), fontSize: `${size}px`, color,
      align: 'center',
    }).setOrigin(.5));
    parent.add(label); return label;
  };
  const reveal = (object: Phaser.GameObjects.Container, delay: number, duration = 240,
    ready?: () => void) => {
    const y = object.y;
    object.setAlpha(0).setY(y + (reduced ? 0 : 12));
    scene.tweens.add({ targets: object, y, alpha: 1,
      delay: reduced ? delay * .25 : delay, duration: reduced ? 80 : duration,
      ease: 'Sine.out', onComplete: ready });
  };
  const shade = own(scene.add.rectangle(0, screen.height / 2 - safe.centerY,
    screen.width, screen.height, 0x08131f).setInteractive().setAlpha(0));
  root.add(shade);
  scene.tweens.add({ targets: shade, alpha: .88, duration: reduced ? 100 : 260 });
  root.add(own(gildedPanel(scene, -width / 2, top, width, height)));

  const crest = own(scene.add.container(0, top + 78)); root.add(crest);
  const glow = own(scene.add.graphics());
  const accent = won ? 0xffd065 : 0xef5068;
  for (let i = 4; i > 0; i--)
    glow.fillStyle(accent, won ? .035 : .025).fillCircle(0, 0, 32 + i * 11);
  crest.add(glow);
  const seal = own(scene.add.graphics());
  seal.fillStyle(won ? 0x76552c : 0x4d2337, .7).fillCircle(0, 0, 35);
  seal.lineStyle(1.5, accent, .7).strokeCircle(0, 0, 35);
  seal.lineStyle(1, 0xfff2c5, .2).strokeCircle(0, 0, 30);
  crest.add(seal);
  const emblemKey = won ? 'cardboard-crown' : 'cardboard-guard';
  if (scene.textures.exists(emblemKey)) {
    const emblem = own(scene.add.image(0, -1, emblemKey));
    const aspect = emblem.width / emblem.height;
    emblem.setDisplaySize(won ? 65 : 51 * aspect, won ? 65 / aspect : 51);
    if (!won) emblem.setTint(0xf895a0).setAngle(-10);
    crest.add(emblem);
  } else text(crest, 0, -1, won ? '★' : '×', 45, won ? '#ffe593' : '#ff8795');
  if (won && !reduced) {
    for (let i = 0; i < 14; i++) {
      const angle = i * Math.PI * 2 / 14, distance = 47 + (i % 3) * 14;
      const spark = own(scene.add.rectangle(0, 0, i % 2 ? 3 : 4, i % 2 ? 7 : 4,
        i % 3 ? 0xffd26b : 0x9aece0).setAngle(i * 29).setAlpha(0));
      crest.add(spark);
      scene.tweens.add({ targets: spark, x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance, alpha: { from: .9, to: 0 }, angle: i * 29 + 90,
        delay: 160, duration: 620 + i * 12, ease: 'Sine.out', onComplete: () => spark.destroy() });
    }
  }
  scene.tweens.add({ targets: glow, alpha: won ? .5 : .18,
    duration: reduced ? 220 : won ? 1200 : 850, delay: reduced ? 0 : 160, ease: 'Sine.out' });
  crest.setScale(reduced ? 1 : won ? .65 : 1.08);
  reveal(crest, 60, won ? 380 : 420);
  if (!reduced) scene.tweens.add({ targets: crest, scale: 1, duration: won ? 480 : 500,
    ease: won ? 'Back.out' : 'Sine.out', delay: 60 });

  const heading = own(scene.add.container(0, 0)); root.add(heading);
  text(heading, 0, top + 23, `ROUND ${state.siegeNumber}`, 12, '#a0bdcb');
  text(heading, 0, top + 131, won ? 'VICTORY' : 'DEFEATED', width < 330 ? 34 : 40,
    won ? '#ffe18c' : '#ff91a3').setStroke('#142638', 4);
  text(heading, 0, top + 163, won ? 'THE CASTLE STANDS. THE RUN CONTINUES.' : 'YOUR DEFENSE ENDS HERE.',
    width < 330 ? 10 : 11, '#b7ced8');
  reveal(heading, 180, 280);

  const stats = state.runStats ?? { roundsWon: won ? state.siegeNumber : Math.max(0, state.siegeNumber - 1),
    enemiesDefeated: state.siege.kills, bossesDefeated: 0, cardsPlayed: 0,
    seconds: state.siege.elapsed, goldEarned: state.siege.coins };
  const totals = own(scene.add.container(0, 0)); root.add(totals);
  text(totals, 0, top + 190, 'RUN TOTALS', 11, '#87b9c9');
  reveal(totals, 330);
  const rows = [
    ['ROUNDS WON', stats.roundsWon], ['ENEMIES DEFEATED', stats.enemiesDefeated],
    ['BOSSES DEFEATED', stats.bossesDefeated], ['CARDS PLAYED', stats.cardsPlayed],
    ['TIME SURVIVED', runTime(stats.seconds)], ['GOLD EARNED', stats.goldEarned],
  ] as const;
  const cellWidth = (width - 52) / 2;
  rows.forEach(([label, value], index) => {
    const x = (index % 2 ? 1 : -1) * (cellWidth / 2 + 5);
    const cell = own(scene.add.container(x, top + 225 + Math.floor(index / 2) * 48));
    root.add(cell);
    const backing = own(scene.add.graphics());
    backing.fillStyle(0x0c2434, .44).fillRoundedRect(-cellWidth / 2, -20, cellWidth, 43, 8);
    backing.lineStyle(1, 0x80b6c3, .13).lineBetween(-cellWidth / 2 + 8, 21, cellWidth / 2 - 8, 21);
    cell.add(backing);
    text(cell, 0, -10, label, width < 330 ? 9 : 10, '#93b6c3');
    text(cell, 0, 9, typeof value === 'number' ? value.toLocaleString('en-US') : value,
      width < 330 ? 21 : 23, label === 'GOLD EARNED' ? '#ffe08c' : '#f5efd8');
    reveal(cell, 350 + Math.floor(index / 2) * 75 + (index % 2) * 35);
  });

  const resources = own(scene.add.container(0, height / 2 - 145)); root.add(resources);
  text(resources, 0, -30, won ? 'CARRYING INTO THE NEXT ROUND' : 'RESOURCES AT THE END',
    width < 330 ? 9 : 10, '#93b6c3');
  const pillWidth = (width - 48) / 3;
  const remaining = [String(state.siege.coins), `${Math.ceil(state.run.player.hp)}/${state.run.player.maxHp}`,
    String(state.run.player.armor)];
  remaining.forEach((value, index) => {
    const x = (index - 1) * (pillWidth + 5), pill = own(scene.add.graphics());
    pill.fillStyle(0x0c2232, .62).fillRoundedRect(x - pillWidth / 2, -19, pillWidth, 38, 8);
    pill.lineStyle(1, index === 0 ? 0xffd471 : index === 1 ? 0xed6c88 : 0x66b9ed, .28)
      .strokeRoundedRect(x - pillWidth / 2, -19, pillWidth, 38, 8);
    resources.add(pill);
    const iconX = x - pillWidth / 2 + 16;
    if (index === 0 && scene.textures.exists('coin')) {
      resources.add(own(scene.add.image(iconX, -1, 'coin').setDisplaySize(16, 16)));
    } else if (index === 1) {
      pill.fillStyle(0xf66e90).fillCircle(iconX - 3.5, -4, 4.7).fillCircle(iconX + 3.5, -4, 4.7)
        .fillTriangle(iconX - 8, -3, iconX + 8, -3, iconX, 8);
    } else if (index === 2) {
      pill.fillStyle(0x66b9ed).fillPoints([
        { x: iconX - 7, y: -8 }, { x: iconX + 7, y: -8 },
        { x: iconX + 6, y: 3 }, { x: iconX, y: 9 }, { x: iconX - 6, y: 3 },
      ], true);
    }
    text(resources, x + 7, -1, value, width < 330 ? 12 : 14,
      index === 0 ? '#ffe08c' : '#f2e9d5');
  });
  reveal(resources, 620);

  let acted = false;
  const act = (callback: () => boolean | void) => {
    if (acted || !root.active) return;
    acted = true;
    if (callback() === false) { acted = false; return; }
    if (root.active) root.destroy();
  };
  const next = own(popupButton(scene, root, height / 2 - 83, width - 38,
    won ? 'NEXT ROUND' : 'NEW RUN', () => act(callbacks.next))).setName('round-result-next');
  const menu = own(scene.add.container(0, height / 2 - 30)).setName('round-result-menu');
  root.add(menu);
  menu.add(own(gildedPanel(scene, -(width - 38) / 2, -20, width - 38, 40, true)));
  text(menu, 0, 0, 'MENU', 16, '#dae7eb');
  menu.setSize(width - 38, 40).setInteractive({ useHandCursor: true });
  menu.on('pointerover', () => menu.setScale(1.02));
  menu.on('pointerout', () => menu.setScale(1));
  menu.on('pointerdown', () => menu.setScale(.98));
  menu.on('pointerup', () => {
    menu.setScale(1);
    AudioSystem.unlock(); AudioSystem.play('button_tap'); act(callbacks.menu);
  });
  for (const [index, button] of [next, menu].entries()) {
    button.disableInteractive();
    reveal(button, 720 + index * 55, 180, () => {
      if (button.active && button.input) button.input.enabled = true;
    });
  }
  const cleanup = () => {
    for (const object of owned) scene.tweens.killTweensOf(object);
    scene.events.off('shutdown', cleanup);
  };
  root.once('destroy', cleanup);
  scene.events.once('shutdown', cleanup);
  return root;
}
