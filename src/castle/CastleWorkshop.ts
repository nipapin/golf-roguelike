import { cardboardArt } from './CardboardArt';
import Phaser from 'phaser';
import { gamePopup, popupButton } from '../presentation/design/GamePopup';
import { getRenderDensity } from '../presentation/design/viewport';
import { AudioSystem } from '../presentation/audio/AudioSystem';
import { castleManager } from './CastleManager';
import {
  UPGRADE_KEYS,
  UPGRADE_LIMIT,
  upgradeCost,
  upgradeValue,
  type UpgradeKey,
} from './CastleDefense';

const DETAILS: Record<
  UpgradeKey,
  { tab: string; title: string; unit: string; description: string }
> = {
  walls: {
    tab: 'CASTLE',
    title: 'CASTLE WALLS',
    unit: 'CASTLE HP',
    description: 'Stronger walls give your castle more health at the start of every siege.',
  },
  soldier: {
    tab: 'SOLDIERS',
    title: 'MARCHING SOLDIERS',
    unit: 'TROOPS / DEPLOY',
    description:
      'Chain 1 recruits this many soldiers. Each marches forward with 1 HP and 1 damage.',
  },
  knight: {
    tab: 'ARCHER',
    title: 'CASTLE ARCHER',
    unit: 'ARROW DAMAGE',
    description:
      'Chain 2 recruits a stationary archer with 1 HP. Increase the damage of each arrow.',
  },
  magazine: {
    tab: 'TURRET',
    title: 'TURRET MAGAZINE',
    unit: 'ROUNDS',
    description:
      'Chain 3 builds your one turret or refills it to this capacity. More rounds, longer defense.',
  },
  mortar: {
    tab: 'CANNON',
    title: 'ARC CANNON',
    unit: 'DAMAGE / SHOT',
    description:
      'Chain 4 deploys a cannon that lobs explosive shells at groups of up to three enemies.',
  },
  laser: {
    tab: 'LASER',
    title: 'LASER CORE',
    unit: 'DAMAGE / ENEMY',
    description:
      'Chain 5 fires a beam across the road. Increase its damage to every enemy; tough enemies can survive.',
  },
};

/** One unit at a time: an illustration, readable before/after stats and a purchase CTA. */
export function showCastleWorkshop(scene: Phaser.Scene, close: () => void): void {
  const service = castleManager().service;
  const modal = gamePopup(scene, 'WORKSHOP', 'Permanent upgrades · applied next siege', 650);
  let selected: UpgradeKey = 'walls';
  let page: Phaser.GameObjects.Container | null = null;
  const text = (
    x: number,
    y: number,
    label: string,
    size: number,
    color = '#fff4d8',
    font = 'Lilita One'
  ) =>
    scene.add
      .text(x, y, label, {
        resolution: getRenderDensity(),
        fontFamily: font,
        fontSize: `${size}px`,
        color,
        align: 'center',
      })
      .setOrigin(0.5);
  const icon = (
    key: UpgradeKey,
    x: number,
    y: number,
    size: number
  ): Phaser.GameObjects.Image | Phaser.GameObjects.Sprite => {
    const id =
      key === 'knight'
        ? 'archer'
        : key === 'soldier'
          ? 'soldier'
          : key === 'walls'
            ? 'castle'
            : key === 'mortar'
              ? 'mortar'
              : key === 'laser'
                ? 'laser'
                : 'turret';
    return cardboardArt(scene, id, x, y, size).setOrigin(0.5);
  };
  const draw = (bought = false) => {
    page?.destroy();
    page = scene.add.container(0, modal.top);
    modal.content.add(page);
    const meta = service.readMeta(),
      level = meta.upgrades[selected],
      cost = upgradeCost(level);
    const maxed = level >= UPGRADE_LIMIT,
      affordable = !maxed && meta.coins >= cost;
    const innerW = modal.width - 36;
    const wallet = scene.add.container(0, 107);
    wallet.add(scene.add.image(-46, 0, 'coin').setDisplaySize(25, 25));
    wallet.add(text(12, 0, String(meta.coins), 25, '#ffe35a'));
    page.add(wallet);
    const tabW = (innerW - 12) / 3;
    UPGRADE_KEYS.forEach((key, i) => {
      const x = ((i % 3) - 1) * (tabW + 6),
        y = 147 + Math.floor(i / 3) * 45;
      const tab = scene.add.container(x, y),
        active = selected === key;
      const g = scene.add.graphics();
      g.fillStyle(0x122b34).fillRoundedRect(-tabW / 2, -18 + 4, tabW, 36, 9);
      g.fillStyle(active ? 0xffd86b : 0x365e6a).fillRoundedRect(-tabW / 2, -18, tabW, 34, 9);
      g.lineStyle(active ? 2 : 1, active ? 0xfff1b6 : 0x71949c).strokeRoundedRect(
        -tabW / 2,
        -18,
        tabW,
        34,
        9
      );
      g.fillStyle(0xffffff, 0.16).fillRoundedRect(-tabW / 2 + 4, -15, tabW - 8, 4, 2);
      tab.add(g);
      tab.add(text(0, -1, DETAILS[key].tab, 13, active ? '#253e47' : '#edf5ed'));
      tab.setInteractive(
        new Phaser.Geom.Rectangle(-tabW / 2, -18, tabW, 36),
        Phaser.Geom.Rectangle.Contains
      );
      tab.on('pointerup', () => {
        if (selected === key) return;
        AudioSystem.unlock();
        AudioSystem.play('button_tap');
        selected = key;
        draw();
      });
      page!.add(tab);
    });
    const bodyTop = 223,
      available = modal.height - bodyTop - 180;
    const heroH = Math.min(100, available * 0.34),
      statsH = Math.min(82, available * 0.32);
    const heroY = bodyTop + heroH / 2;
    const halo = scene.add.graphics();
    halo.fillStyle(0x70a3b1, 0.12).fillEllipse(0, heroY, innerW * 0.74, heroH * 1.25);
    halo.lineStyle(1, 0x9edbe5, 0.18).strokeEllipse(0, heroY, innerW * 0.74, heroH * 1.25);
    page.add(halo);
    const model = icon(selected, 0, heroY - 2, heroH * 1.16);
    page.add(model);
    if (selected === 'laser') {
      const laser = scene.add.graphics();
      laser.lineStyle(9, 0x5beaff, 0.25).lineBetween(-innerW * 0.35, heroY - 8, -20, heroY - 8);
      laser.lineStyle(3, 0xaaffff).lineBetween(-innerW * 0.35, heroY - 8, -20, heroY - 8);
      laser.lineStyle(1, 0xffffff).lineBetween(-innerW * 0.35, heroY - 8, -20, heroY - 8);
      page.add(laser);
    }
    const headingY = bodyTop + heroH + 6;
    page.add(text(0, headingY, DETAILS[selected].title, 19));
    const statsY = headingY + 19,
      statW = (innerW - 24) / 2;
    const stat = (x: number, label: string, value: number, next: boolean) => {
      const g = scene.add.graphics();
      g.fillStyle(0x102a34, 0.6).fillRoundedRect(x - statW / 2, statsY + 5, statW, statsH, 12);
      g.fillStyle(next ? 0xffefd0 : 0xd4e5df).fillRoundedRect(
        x - statW / 2,
        statsY,
        statW,
        statsH,
        12
      );
      g.fillStyle(next ? 0xd8a85a : 0x819f99).fillRoundedRect(
        x - statW / 2,
        statsY + statsH - 6,
        statW,
        6,
        { tl: 0, tr: 0, bl: 12, br: 12 }
      );
      g.fillStyle(0xffffff, 0.6).fillRoundedRect(x - statW / 2 + 5, statsY + 3, statW - 10, 3, 2);
      page!.add(g);
      page!.add(text(x, statsY + statsH * 0.2, label, 11, '#516263'));
      page!.add(text(x, statsY + statsH * 0.51, String(value), 27, next ? '#926121' : '#284a51'));
      page!.add(text(x, statsY + statsH * 0.81, DETAILS[selected].unit, 11, '#516263'));
    };
    stat(-(statW + 24) / 2, 'CURRENT', upgradeValue(selected, level), false);
    stat(
      (statW + 24) / 2,
      maxed ? 'MAX LEVEL' : 'AFTER UPGRADE',
      upgradeValue(selected, maxed ? level : level + 1),
      true
    );
    page.add(text(0, statsY + statsH / 2, '›', 25, '#ffe4a0'));
    const descriptionY = statsY + statsH + 14;
    page.add(
      text(0, descriptionY, DETAILS[selected].description, 13, '#d9eee7', 'Fredoka')
        .setOrigin(0.5, 0)
        .setWordWrapWidth(innerW)
    );
    // Level indicator is separated from the purchase: the entire panel is never clickable.
    const buyY = modal.height - 96;
    page.add(
      text(
        0,
        buyY - 43,
        bought
          ? `UPGRADED! · LEVEL ${level} / ${UPGRADE_LIMIT}`
          : `LEVEL ${level} / ${UPGRADE_LIMIT}`,
        14,
        bought ? '#8bffd0' : '#d5eee7'
      )
    );
    const buy = popupButton(
      scene,
      page,
      buyY,
      innerW,
      maxed
        ? 'MAX LEVEL REACHED'
        : affordable
          ? `BUY UPGRADE · ${cost} COINS`
          : `NEED ${cost - meta.coins} MORE COINS`,
      () => {
        if (!service.purchase(selected)) {
          AudioSystem.play('invalid_tap');
          scene.tweens.add({
            targets: buy,
            x: 4,
            duration: 40,
            yoyo: true,
            repeat: 2,
            onComplete: () => buy.setX(0),
          });
          return;
        }
        AudioSystem.play('reward_pick');
        draw(true);
      }
    );
    if (!affordable) buy.setAlpha(0.55);
    popupButton(
      scene,
      page,
      modal.height - 34,
      innerW,
      'BACK TO CASTLE',
      () => {
        modal.root.destroy();
        close();
      },
      true
    );
    if (bought)
      scene.tweens.add({
        targets: model,
        scaleX: model.scaleX * 1.12,
        scaleY: model.scaleY * 1.12,
        duration: 160,
        yoyo: true,
        ease: 'Sine.inOut',
      });
  };
  draw();
}
