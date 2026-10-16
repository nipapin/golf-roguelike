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

const GLOSSARY_EN: { title: string; text: string }[] = [
  { title: 'Draw Pile', text: 'The card stack (bottom-left) you draw from. When empty with no moves, you pay HP for a new deal.' },
  { title: 'Chain', text: 'A sequence of cards you play. Chain length determines your reward when you DRAW.' },
  { title: 'Link', text: 'Each card in a chain = 1 link. More links = better rewards. 5+ links = laser!' },
  { title: 'Draw', text: 'The button that deploys defenders based on your chain and takes a new card from the pile.' },
  { title: 'Reshuffle', text: 'When the pile is empty with no moves, cards are re-dealt. Costs 5 HP (or less with perks).' },
  { title: 'Armor', text: 'Absorbs enemy damage before castle HP is lost. Shown as a blue bar.' },
  { title: 'Stacks', text: 'Some perks can be taken multiple times. Each stack increases the effect.' },
  { title: 'Rarity', text: 'Common (gray), Uncommon (green), Rare (blue), Legendary (gold). Rarer perks are stronger.' },
];

const GLOSSARY_RU: { title: string; text: string }[] = [
  { title: 'Колода', text: 'Колода (слева внизу) — откуда берёшь карты. Когда она пуста и нет ходов, платишь HP за новый расклад.' },
  { title: 'Цепочка', text: 'Последовательность сыгранных карт. Длина цепочки определяет награду при ДОБОРЕ.' },
  { title: 'Звено', text: 'Каждая карта в цепочке = 1 звено. Больше звеньев = лучшие награды. 5+ звеньев = лазер!' },
  { title: 'Добор', text: 'Кнопка, которая призывает защитников по твоей цепочке и берёт новую карту из колоды.' },
  { title: 'Пересдача', text: 'Когда колода пуста и нет ходов, карты раздаются заново. Стоит 5 HP (или меньше с перками).' },
  { title: 'Броня', text: 'Поглощает урон врагов до того, как теряется HP замка. Показана синей полоской.' },
  { title: 'Стаки', text: 'Некоторые перки можно взять несколько раз. Каждый стак усиливает эффект.' },
  { title: 'Редкость', text: 'Common (серый), Uncommon (зелёный), Rare (синий), Legendary (золотой). Редкие перки сильнее.' },
];
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

  const helpBtn = own(scene.add.container(width / 2 - 24, top + 32));
  root.add(helpBtn);
  const helpBg = own(scene.add.graphics());
  helpBg.fillStyle(0x2d5a8a).fillCircle(0, 0, 14);
  helpBg.lineStyle(2, 0x4299e1).strokeCircle(0, 0, 14);
  helpBtn.add(helpBg);
  const helpText = own(scene.add.text(0, 0, '?', {
    resolution: getRenderDensity(), fontFamily: 'Lilita One', fontSize: '16px', color: '#ffffff',
  }).setOrigin(0.5));
  helpBtn.add(helpText);
  helpBtn.setInteractive(new Phaser.Geom.Circle(0, 0, 14), Phaser.Geom.Circle.Contains);
  helpBtn.on('pointerup', () => {
    AudioSystem.play('button_tap');
    tapFeedback();
    showGlossary(scene, own, root, width, height, top, lang);
  });

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
      const ownedPerk = (state.perks ?? []).find(p => p.id === perk.id);
      const currentStacks = ownedPerk?.stacks ?? 0;
      const card = createPerkCard(scene, own, perk, cardWidth, cardHeight, lang, index, reduced, currentStacks, () => {
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
  currentStacks: number,
  onSelect: () => void
): Phaser.GameObjects.Container {
  const card = own(scene.add.container(0, 0));
  const colors = RARITY_COLORS[perk.rarity];
  const maxStacks = perk.stack?.max ?? 1;

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

  if (maxStacks > 1) {
    const nextStacks = Math.min(currentStacks + 1, maxStacks);
    const stackText = currentStacks > 0 
      ? `${currentStacks} → ${nextStacks}` 
      : `0 → 1`;
    const stackBg = own(scene.add.graphics());
    stackBg.fillStyle(0x1a2634, 0.9).fillRoundedRect(-width / 2 + 4, height / 2 - 24, width - 8, 18, 4);
    card.add(stackBg);
    
    const stackIcon = own(scene.add.text(-width / 2 + 10, height / 2 - 15, '⬆', {
      resolution: getRenderDensity(), fontFamily: 'Lilita One', fontSize: '10px', color: currentStacks > 0 ? '#48bb78' : '#718096',
    }).setOrigin(0, 0.5));
    card.add(stackIcon);
    
    const stackLabel = own(scene.add.text(0, height / 2 - 15, stackText, {
      resolution: getRenderDensity(), fontFamily: 'Lilita One', fontSize: '10px', 
      color: currentStacks > 0 ? '#48bb78' : '#a0aec0',
    }).setOrigin(0.5));
    card.add(stackLabel);
    
    const maxLabel = own(scene.add.text(width / 2 - 10, height / 2 - 15, `/${maxStacks}`, {
      resolution: getRenderDensity(), fontFamily: 'Lilita One', fontSize: '9px', color: '#718096',
    }).setOrigin(1, 0.5));
    card.add(maxLabel);
  } else {
    const singleBg = own(scene.add.graphics());
    singleBg.fillStyle(0x1a2634, 0.9).fillRoundedRect(-width / 2 + 4, height / 2 - 24, width - 8, 18, 4);
    card.add(singleBg);
    const singleLabel = own(scene.add.text(0, height / 2 - 15, lang === 'ru' ? 'Один раз' : 'Once only', {
      resolution: getRenderDensity(), fontFamily: lang === 'ru' ? 'Rubik' : 'Fredoka', fontSize: '9px', color: '#718096',
    }).setOrigin(0.5));
    card.add(singleLabel);
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

  let longPressTimer: ReturnType<typeof setTimeout> | null = null;
  let isLongPress = false;

  card.on('pointerover', () => {
    scene.tweens.add({ targets: card, scale: 1.05, duration: 100 });
    scene.tweens.add({ targets: glow, alpha: 1, duration: 150 });
  });
  card.on('pointerout', () => {
    scene.tweens.add({ targets: card, scale: 1, duration: 100 });
    scene.tweens.add({ targets: glow, alpha: 0, duration: 150 });
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  });
  card.on('pointerdown', () => {
    card.setScale(0.98);
    isLongPress = false;
    longPressTimer = setTimeout(() => {
      isLongPress = true;
      AudioSystem.play('button_tap');
      tapFeedback();
      showPerkDetail(scene, own, card, perk, lang, currentStacks);
    }, 400);
  });
  card.on('pointerup', () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
    if (!isLongPress) {
      card.setScale(1.05);
      onSelect();
    }
  });

  return card;
}

function showPerkDetail(
  scene: Phaser.Scene,
  own: <T extends Phaser.GameObjects.GameObject>(obj: T) => T,
  card: Phaser.GameObjects.Container,
  perk: PerkDef,
  lang: 'en' | 'ru',
  currentStacks: number
): void {
  const colors = RARITY_COLORS[perk.rarity];
  const maxStacks = perk.stack?.max ?? 1;
  
  const tooltip = own(scene.add.container(0, -100));
  card.add(tooltip);
  
  const tooltipWidth = 180;
  const desc = perk.description[lang];
  const textHeight = Math.ceil(desc.length / 25) * 12 + 40;
  const tooltipHeight = Math.max(80, textHeight);
  
  const bg = own(scene.add.graphics());
  bg.fillStyle(0x0a1520, 0.95);
  bg.fillRoundedRect(-tooltipWidth / 2, -tooltipHeight / 2, tooltipWidth, tooltipHeight, 8);
  bg.lineStyle(2, colors.border);
  bg.strokeRoundedRect(-tooltipWidth / 2, -tooltipHeight / 2, tooltipWidth, tooltipHeight, 8);
  tooltip.add(bg);
  
  const titleText = own(scene.add.text(0, -tooltipHeight / 2 + 14, perk.name[lang], {
    resolution: getRenderDensity(), 
    fontFamily: lang === 'ru' ? 'Rubik' : 'Lilita One',
    fontStyle: lang === 'ru' ? 'bold' : 'normal',
    fontSize: '11px', color: colors.text,
  }).setOrigin(0.5));
  tooltip.add(titleText);
  
  const descText = own(scene.add.text(0, 4, desc, {
    resolution: getRenderDensity(), 
    fontFamily: lang === 'ru' ? 'Rubik' : 'Fredoka',
    fontSize: '9px', color: '#e2e8f0',
    align: 'center',
    wordWrap: { width: tooltipWidth - 16 },
  }).setOrigin(0.5));
  tooltip.add(descText);
  
  if (maxStacks > 1) {
    const stackInfo = lang === 'ru' 
      ? `Стаки: ${currentStacks}/${maxStacks}`
      : `Stacks: ${currentStacks}/${maxStacks}`;
    const stackText = own(scene.add.text(0, tooltipHeight / 2 - 14, stackInfo, {
      resolution: getRenderDensity(), fontFamily: 'Lilita One', fontSize: '9px', 
      color: currentStacks > 0 ? '#48bb78' : '#718096',
    }).setOrigin(0.5));
    tooltip.add(stackText);
  }
  
  tooltip.setAlpha(0).setScale(0.8);
  scene.tweens.add({ targets: tooltip, alpha: 1, scale: 1, duration: 150, ease: 'Back.out' });
  
  const dismissTimer = scene.time.delayedCall(2500, () => {
    scene.tweens.add({
      targets: tooltip,
      alpha: 0,
      scale: 0.8,
      duration: 150,
      onComplete: () => tooltip.destroy(),
    });
  });
  
  tooltip.once('destroy', () => dismissTimer.remove());
}

function showGlossary(
  scene: Phaser.Scene,
  own: <T extends Phaser.GameObjects.GameObject>(obj: T) => T,
  parent: Phaser.GameObjects.Container,
  panelWidth: number,
  panelHeight: number,
  top: number,
  lang: 'en' | 'ru'
): void {
  const glossary = lang === 'ru' ? GLOSSARY_RU : GLOSSARY_EN;
  const overlay = own(scene.add.container(0, 0));
  parent.add(overlay);

  const bg = own(scene.add.graphics());
  bg.fillStyle(0x0a1520, 0.95);
  bg.fillRoundedRect(-panelWidth / 2 + 4, top + 4, panelWidth - 8, panelHeight - 8, 10);
  overlay.add(bg);

  const title = own(scene.add.text(0, top + 28, lang === 'ru' ? 'СПРАВКА' : 'GLOSSARY', {
    resolution: getRenderDensity(), fontFamily: 'Lilita One', fontSize: '20px', color: '#ffe35a',
  }).setOrigin(0.5));
  overlay.add(title);

  let yPos = top + 60;
  const lineHeight = 52;
  const textWidth = panelWidth - 40;

  for (const entry of glossary) {
    const termTitle = own(scene.add.text(-panelWidth / 2 + 20, yPos, entry.title, {
      resolution: getRenderDensity(), fontFamily: lang === 'ru' ? 'Rubik' : 'Lilita One',
      fontStyle: lang === 'ru' ? 'bold' : 'normal',
      fontSize: '12px', color: '#4299e1',
    }).setOrigin(0, 0));
    overlay.add(termTitle);

    const termText = own(scene.add.text(-panelWidth / 2 + 20, yPos + 14, entry.text, {
      resolution: getRenderDensity(), fontFamily: lang === 'ru' ? 'Rubik' : 'Fredoka',
      fontSize: '9px', color: '#c5d1d8', wordWrap: { width: textWidth },
    }).setOrigin(0, 0));
    overlay.add(termText);

    yPos += lineHeight;
  }

  const closeBtn = own(scene.add.container(0, top + panelHeight - 40));
  overlay.add(closeBtn);
  const closeBg = own(scene.add.graphics());
  closeBg.fillStyle(0x19313c).fillRoundedRect(-60, -14 + 3, 120, 28, 8);
  closeBg.fillStyle(0x2d5a8a).fillRoundedRect(-60, -14, 120, 28, 8);
  closeBg.fillStyle(0x4299e1).fillRoundedRect(-60, -14, 120, 24, 8);
  closeBg.lineStyle(2, 0x19313c).strokeRoundedRect(-60, -14, 120, 28, 8);
  closeBtn.add(closeBg);
  const closeText = own(scene.add.text(0, -3, lang === 'ru' ? 'ЗАКРЫТЬ' : 'CLOSE', {
    resolution: getRenderDensity(), fontFamily: 'Lilita One', fontSize: '13px', color: '#ffffff',
  }).setOrigin(0.5).setStroke('#19313c', 2));
  closeBtn.add(closeText);
  closeBtn.setInteractive(new Phaser.Geom.Rectangle(-60, -14, 120, 28), Phaser.Geom.Rectangle.Contains);
  closeBtn.on('pointerup', () => {
    AudioSystem.play('button_tap');
    tapFeedback();
    overlay.destroy();
  });

  overlay.setAlpha(0);
  scene.tweens.add({ targets: overlay, alpha: 1, duration: 150 });
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
