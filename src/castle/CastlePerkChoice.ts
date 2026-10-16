import Phaser from 'phaser';
import { getRenderDensity, safeArea, viewport } from '../presentation/design/viewport';
import { gameDisplayStyle } from '../presentation/design/displayFont';
import { gildedPanel } from '../presentation/design/GameFeel';
import { popupButton } from '../presentation/design/GamePopup';
import { AudioSystem } from '../presentation/audio/AudioSystem';
import { isShakeReduced } from '../presentation/juice/fxSettings';
import { successFeedback, tapFeedback } from '../presentation/haptics/haptics';
import { getLanguage } from '../localization/i18n';
import type { CastleManager } from './CastleManager';
import { generatePerkOffer, getPerk, DROP_RULES, type PerkDef, type PerkOffer } from './PerkManager';
import { RNG } from '../core/RNG';

const RARITY_COLORS: Record<string, { bg: number; border: number; glow: number; text: string }> = {
  common: { bg: 0x4a5568, border: 0x718096, glow: 0xa0aec0, text: '#e2e8f0' },
  uncommon: { bg: 0x276749, border: 0x38a169, glow: 0x48bb78, text: '#c6f6d5' },
  rare: { bg: 0x2b6cb0, border: 0x4299e1, glow: 0x63b3ed, text: '#bee3f8' },
  legendary: { bg: 0x744210, border: 0xd69e2e, glow: 0xffc107, text: '#fefcbf' },
};

const CATEGORY_ICONS: Record<string, string> = {
  suit: '♠',
  deck: '🃏',
  units: '⚔',
  castle: '🏰',
  economy: '💰',
  synergy: '⚡',
  risk: '☠',
};

const PERK_ICONS: Record<string, string> = {
  heart_mend: '♥',
  spade_edge: '♠',
  diamond_vein: '♦',
  club_bulwark: '♣',
  flush_run: '🎴',
  royal_court: '👑',
  ace_flare: '✦',
  lucky_seven: '🎲',
  momentum: '⚡',
  ouroboros: '∞',
  spare_stock: '📦',
  card_counter: '👁',
  jester: '🃏',
  longbow: '🏹',
  quick_draw: '💨',
  extended_mag: '🔋',
  heavy_shells: '💣',
  cluster_shells: '💥',
  focusing_lens: '🔮',
  veteran_militia: '🛡',
  stone_walls: '🧱',
  masons: '🔨',
  field_hospital: '🏥',
  tar_moat: '🛢',
  bounty_board: '📜',
  guild_charter: '📋',
  spade_salvo: '🎯',
  heartfire: '🔥',
  trinity: '△',
  starfall: '★',
  glass_cannon: '⚔',
  blood_price: '🩸',
};

function getPerkIcon(perk: PerkDef): string {
  return PERK_ICONS[perk.id] || CATEGORY_ICONS[perk.category] || '✧';
}

export function showPerkChoice(
  scene: Phaser.Scene,
  manager: CastleManager,
  onComplete: () => void
): Phaser.GameObjects.Container {
  const state = manager.state!;
  const reduced = isShakeReduced();
  const screen = viewport(scene);
  const safe = safeArea(scene);
  const lang = getLanguage();
  
  const width = Math.min(400, screen.width - 20);
  const height = Math.min(620, safe.height - 16);
  const top = -height / 2;
  
  const root = scene.add.container(screen.width / 2, safe.centerY).setDepth(3100);
  const owned: Phaser.GameObjects.GameObject[] = [root];
  const own = <T extends Phaser.GameObjects.GameObject>(obj: T): T => { owned.push(obj); return obj; };

  const shade = own(scene.add.rectangle(0, screen.height / 2 - safe.centerY,
    screen.width, screen.height, 0x08131f).setInteractive().setAlpha(0));
  root.add(shade);
  scene.tweens.add({ targets: shade, alpha: 0.92, duration: reduced ? 100 : 280 });

  root.add(own(gildedPanel(scene, -width / 2, top, width, height)));

  const text = (parent: Phaser.GameObjects.Container, x: number, y: number, value: string,
    size: number, color = '#fff1cc', maxWidth?: number) => {
    const style: Phaser.Types.GameObjects.Text.TextStyle = {
      resolution: getRenderDensity(), ...gameDisplayStyle(value), fontSize: `${size}px`, color,
      align: 'center', wordWrap: maxWidth ? { width: maxWidth } : undefined,
    };
    const label = own(scene.add.text(x, y, value, style).setOrigin(0.5));
    parent.add(label);
    return label;
  };

  text(root, 0, top + 32, lang === 'ru' ? 'ВЫБЕРИ ПЕРК' : 'CHOOSE A PERK', 26, '#ffe35a');
  text(root, 0, top + 60, lang === 'ru' ? 'Усиль свой забег' : 'Power up your run', 12, '#b7ced8');

  let currentOffer!: PerkOffer;
  let cardsContainer: Phaser.GameObjects.Container;
  let rerollButton: Phaser.GameObjects.Container | null = null;
  let acted = false;

  const generateOffer = () => {
    if (state.pendingPerkOffer) {
      const pendingPerks = state.pendingPerkOffer.perks
        .map(id => getPerk(id))
        .filter((p): p is PerkDef => !!p);
      if (pendingPerks.length > 0) {
        const freeRerolls = DROP_RULES.freeRerollsPerRun - (state.perkFreeRerollsUsed ?? 0);
        currentOffer = {
          perks: pendingPerks,
          rerollCost: freeRerolls > 0 ? 0 : DROP_RULES.rerollBaseCost + (state.perkRerollsUsed ?? 0) * DROP_RULES.rerollCostIncrement,
          canReroll: true,
        };
        return;
      }
    }
    const rng = new RNG(state.run.seed + ':perk-offer:' + Date.now());
    currentOffer = generatePerkOffer(
      state.perks ?? [],
      state.siegeNumber,
      state.perkRerollsUsed ?? 0,
      state.perkFreeRerollsUsed ?? 0,
      state.perkRareStreak ?? 0,
      rng
    );
  };

  const renderCards = () => {
    if (cardsContainer) {
      cardsContainer.destroy();
      owned.splice(owned.indexOf(cardsContainer), 1);
    }
    cardsContainer = own(scene.add.container(0, 0));
    root.add(cardsContainer);

    const cardWidth = Math.min(110, (width - 40) / 3);
    const cardHeight = cardWidth * 1.5;
    const gap = 8;
    const totalWidth = currentOffer.perks.length * cardWidth + (currentOffer.perks.length - 1) * gap;
    const startX = -totalWidth / 2 + cardWidth / 2;

    currentOffer.perks.forEach((perk, index) => {
      const x = startX + index * (cardWidth + gap);
      const y = top + 180;
      const card = createPerkCard(scene, own, perk, cardWidth, cardHeight, lang, index, reduced, () => {
        if (acted) return;
        acted = true;
        selectPerk(perk);
      });
      card.setPosition(x, y);
      cardsContainer.add(card);
    });

    updateRerollButton();
  };

  const updateRerollButton = () => {
    if (rerollButton) {
      rerollButton.destroy();
      owned.splice(owned.indexOf(rerollButton), 1);
      rerollButton = null;
    }

    const canAfford = state.siege.coins >= currentOffer.rerollCost;
    const label = currentOffer.rerollCost === 0
      ? (lang === 'ru' ? 'БЕСПЛАТНЫЙ РЕРОЛЛ' : 'FREE REROLL')
      : (lang === 'ru' ? `РЕРОЛЛ · ${currentOffer.rerollCost}` : `REROLL · ${currentOffer.rerollCost}`);

    rerollButton = own(scene.add.container(0, top + 360));
    root.add(rerollButton);

    const btnWidth = width - 60;
    const g = own(scene.add.graphics());
    g.fillStyle(0x19313c).fillRoundedRect(-btnWidth / 2, -18 + 3, btnWidth, 36, 10);
    g.fillStyle(canAfford ? 0x2d5a8a : 0x3a4a5a).fillRoundedRect(-btnWidth / 2, -18, btnWidth, 36, 10);
    g.fillStyle(canAfford ? 0x4299e1 : 0x4a5a6a).fillRoundedRect(-btnWidth / 2, -18, btnWidth, 30, 10);
    g.lineStyle(2, 0x19313c).strokeRoundedRect(-btnWidth / 2, -18, btnWidth, 36, 10);
    rerollButton.add(g);

    const labelText = own(scene.add.text(0, -3, label, {
      resolution: getRenderDensity(), fontFamily: 'Lilita One', fontSize: '15px',
      color: canAfford ? '#ffffff' : '#8899aa',
    }).setOrigin(0.5).setStroke('#19313c', 3));
    rerollButton.add(labelText);

    if (canAfford && currentOffer.canReroll) {
      rerollButton.setInteractive(new Phaser.Geom.Rectangle(-btnWidth / 2, -18, btnWidth, 36),
        Phaser.Geom.Rectangle.Contains);
      rerollButton.on('pointerup', () => {
        if (acted) return;
        AudioSystem.play('button_tap');
        tapFeedback();
        if (currentOffer.rerollCost > 0) {
          state.siege.coins -= currentOffer.rerollCost;
          state.perkRerollsUsed = (state.perkRerollsUsed ?? 0) + 1;
        } else {
          state.perkFreeRerollsUsed = (state.perkFreeRerollsUsed ?? 0) + 1;
        }
        manager.save();
        generateOffer();
        renderCards();
      });
      rerollButton.on('pointerover', () => rerollButton?.setScale(1.02));
      rerollButton.on('pointerout', () => rerollButton?.setScale(1));
    }
  };

  const selectPerk = (perk: PerkDef) => {
    AudioSystem.play('reward_pick');
    successFeedback();

    if (!state.perks) state.perks = [];
    const existing = state.perks.find(p => p.id === perk.id);
    if (existing) {
      existing.stacks = Math.min(existing.stacks + 1, perk.stack?.max ?? 1);
    } else {
      if (perk.replaces) {
        state.perks = state.perks.filter(p => p.id !== perk.replaces);
      }
      state.perks.push({ id: perk.id, stacks: 1 });
    }

    const isRareOrHigher = perk.rarity === 'rare' || perk.rarity === 'legendary';
    state.perkRareStreak = isRareOrHigher ? 0 : (state.perkRareStreak ?? 0) + 1;

    delete state.pendingPerkOffer;
    manager.save();

    scene.tweens.add({
      targets: root,
      alpha: 0,
      scale: 0.95,
      duration: reduced ? 100 : 200,
      onComplete: () => {
        cleanup();
        root.destroy();
        onComplete();
      }
    });
  };

  const skipChoice = () => {
    if (acted) return;
    acted = true;
    AudioSystem.play('button_tap');
    tapFeedback();

    state.siege.coins += DROP_RULES.skipCoins;
    delete state.pendingPerkOffer;
    manager.save();

    scene.tweens.add({
      targets: root,
      alpha: 0,
      scale: 0.95,
      duration: reduced ? 100 : 200,
      onComplete: () => {
        cleanup();
        root.destroy();
        onComplete();
      }
    });
  };

  own(popupButton(scene, root, top + 410, width - 60,
    lang === 'ru' ? `ПРОПУСТИТЬ · +${DROP_RULES.skipCoins}` : `SKIP · +${DROP_RULES.skipCoins}`,
    skipChoice, true));

  const coinsDisplay = own(scene.add.container(0, top + 460));
  root.add(coinsDisplay);
  const coinIcon = own(scene.add.graphics());
  coinIcon.fillStyle(0xffd24a).fillCircle(-30, 0, 10);
  coinIcon.fillStyle(0xe8a800).fillCircle(-30, 0, 7);
  coinsDisplay.add(coinIcon);
  const coinsText = own(scene.add.text(0, 0, `${state.siege.coins}`, {
    resolution: getRenderDensity(), fontFamily: 'Lilita One', fontSize: '18px', color: '#ffe08c',
  }).setOrigin(0, 0.5));
  coinsDisplay.add(coinsText);

  generateOffer();
  state.pendingPerkOffer = {
    perks: currentOffer.perks.map(p => p.id),
    rerollsUsed: state.perkRerollsUsed ?? 0,
    freeRerollsUsed: state.perkFreeRerollsUsed ?? 0,
  };
  manager.save();
  renderCards();

  root.setScale(reduced ? 1 : 0.9).setAlpha(0);
  scene.tweens.add({ targets: root, scale: 1, alpha: 1, duration: reduced ? 100 : 300, ease: 'Back.out' });

  const cleanup = () => {
    for (const obj of owned) scene.tweens.killTweensOf(obj);
    scene.events.off('shutdown', cleanup);
  };
  root.once('destroy', cleanup);
  scene.events.once('shutdown', cleanup);

  return root;
}

function createPerkCard(
  scene: Phaser.Scene,
  own: <T extends Phaser.GameObjects.GameObject>(obj: T) => T,
  perk: PerkDef,
  width: number,
  height: number,
  lang: 'en' | 'ru',
  index: number,
  reduced: boolean,
  onSelect: () => void
): Phaser.GameObjects.Container {
  const card = own(scene.add.container(0, 0));
  const colors = RARITY_COLORS[perk.rarity];
  const stacks = perk.stack?.max ?? 1;

  const glow = own(scene.add.graphics());
  glow.fillStyle(colors.glow, 0.3);
  for (let i = 3; i > 0; i--) {
    glow.fillRoundedRect(-width / 2 - i * 4, -height / 2 - i * 4, width + i * 8, height + i * 8, 12);
  }
  card.add(glow);
  glow.setAlpha(0);

  const bg = own(scene.add.graphics());
  bg.fillStyle(0x19313c).fillRoundedRect(-width / 2, -height / 2 + 4, width, height, 12);
  bg.fillStyle(colors.bg).fillRoundedRect(-width / 2, -height / 2, width, height, 12);
  bg.lineStyle(3, colors.border).strokeRoundedRect(-width / 2, -height / 2, width, height, 12);
  card.add(bg);

  const rarityBadge = own(scene.add.graphics());
  const badgeY = -height / 2 + 16;
  rarityBadge.fillStyle(colors.border).fillRoundedRect(-width / 2 + 6, badgeY - 8, width - 12, 16, 4);
  card.add(rarityBadge);

  const rarityText = perk.rarity.toUpperCase();
  const rarityLabel = own(scene.add.text(0, badgeY, rarityText, {
    resolution: getRenderDensity(), fontFamily: 'Lilita One', fontSize: '9px', color: colors.text,
  }).setOrigin(0.5));
  card.add(rarityLabel);

  const iconBg = own(scene.add.graphics());
  iconBg.fillStyle(0x1a2634).fillCircle(0, -height / 2 + 55, 24);
  iconBg.fillStyle(colors.border, 0.3).fillCircle(0, -height / 2 + 55, 22);
  card.add(iconBg);

  const icon = own(scene.add.text(0, -height / 2 + 55, getPerkIcon(perk), {
    resolution: getRenderDensity(), fontFamily: 'Lilita One', fontSize: '22px', color: '#ffffff',
  }).setOrigin(0.5));
  card.add(icon);

  const name = perk.name[lang];
  const nameSize = name.length > 12 ? 11 : 13;
  const nameLabel = own(scene.add.text(0, -height / 2 + 95, name, {
    resolution: getRenderDensity(), fontFamily: lang === 'ru' ? 'Rubik' : 'Lilita One',
    fontStyle: lang === 'ru' ? 'bold' : 'normal',
    fontSize: `${nameSize}px`, color: '#ffffff', align: 'center',
    wordWrap: { width: width - 12 },
  }).setOrigin(0.5, 0));
  card.add(nameLabel);

  const desc = perk.description[lang];
  const descLabel = own(scene.add.text(0, -height / 2 + 125, desc, {
    resolution: getRenderDensity(), fontFamily: lang === 'ru' ? 'Rubik' : 'Fredoka',
    fontSize: '9px', color: '#c5d1d8', align: 'center',
    wordWrap: { width: width - 14 },
  }).setOrigin(0.5, 0));
  card.add(descLabel);

  if (stacks > 1) {
    const stackLabel = own(scene.add.text(width / 2 - 10, height / 2 - 14, `×${stacks}`, {
      resolution: getRenderDensity(), fontFamily: 'Lilita One', fontSize: '11px', color: colors.text,
    }).setOrigin(0.5));
    card.add(stackLabel);
  }

  card.setInteractive(new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height),
    Phaser.Geom.Rectangle.Contains);

  card.setScale(reduced ? 1 : 0.7).setAlpha(0);
  scene.tweens.add({
    targets: card,
    scale: 1,
    alpha: 1,
    delay: reduced ? index * 50 : 200 + index * 100,
    duration: reduced ? 100 : 300,
    ease: 'Back.out',
  });

  card.on('pointerover', () => {
    scene.tweens.add({ targets: card, scale: 1.05, duration: 100 });
    scene.tweens.add({ targets: glow, alpha: 1, duration: 150 });
  });
  card.on('pointerout', () => {
    scene.tweens.add({ targets: card, scale: 1, duration: 100 });
    scene.tweens.add({ targets: glow, alpha: 0, duration: 150 });
  });
  card.on('pointerdown', () => card.setScale(0.98));
  card.on('pointerup', () => {
    card.setScale(1.05);
    onSelect();
  });

  return card;
}

export function showCurrentPerks(
  scene: Phaser.Scene,
  perks: { id: string; stacks: number }[],
  x: number,
  y: number,
  maxWidth: number
): Phaser.GameObjects.Container {
  const container = scene.add.container(x, y);
  
  if (!perks.length) return container;

  const iconSize = 22;
  const gap = 4;
  const perRow = Math.floor((maxWidth + gap) / (iconSize + gap));
  
  perks.slice(0, 12).forEach((owned, index) => {
    const perk = getPerk(owned.id);
    if (!perk) return;
    
    const col = index % perRow;
    const row = Math.floor(index / perRow);
    const px = col * (iconSize + gap) - (Math.min(perks.length, perRow) - 1) * (iconSize + gap) / 2;
    const py = row * (iconSize + gap);
    
    const colors = RARITY_COLORS[perk.rarity];
    
    const bg = scene.add.graphics();
    bg.fillStyle(colors.bg).fillRoundedRect(px - iconSize / 2, py - iconSize / 2, iconSize, iconSize, 4);
    bg.lineStyle(1.5, colors.border).strokeRoundedRect(px - iconSize / 2, py - iconSize / 2, iconSize, iconSize, 4);
    container.add(bg);
    
    const icon = scene.add.text(px, py, getPerkIcon(perk), {
      resolution: getRenderDensity(), fontFamily: 'Lilita One', fontSize: '12px', color: '#ffffff',
    }).setOrigin(0.5);
    container.add(icon);
    
    if (owned.stacks > 1) {
      const stackBadge = scene.add.text(px + iconSize / 2 - 2, py + iconSize / 2 - 2, `${owned.stacks}`, {
        resolution: getRenderDensity(), fontFamily: 'Lilita One', fontSize: '8px', color: '#ffffff',
        backgroundColor: '#19313c', padding: { x: 2, y: 0 },
      }).setOrigin(1, 1);
      container.add(stackBadge);
    }
  });

  return container;
}
