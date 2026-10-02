import Phaser from 'phaser';
import {
  configureViewport,
  viewport,
  safeArea,
  getRenderDensity,
} from '../presentation/design/viewport';
import { popupButton } from '../presentation/design/GamePopup';
import { AudioSystem } from '../presentation/audio/AudioSystem';
import { gameConfig } from '../data/gameConfig';
import { UPGRADE_VALUES, REDEAL_HP_COST } from './CastleDefense';

interface GuideEntry {
  title: string;
  icon: string;
  description: string;
}
const powers = gameConfig.powerCards;
const groups: { title: string; entries: GuideEntry[] }[] = [
  {
    title: 'POWER CARDS',
    entries: [
      {
        title: 'CRIT',
        icon: '×3',
        description: `Defenders built or reloaded from this chain deal ×${powers.CRIT.damageMultiplier} damage. Activates when you DRAW. Does not multiply the laser.`,
      },
      {
        title: 'HEAL',
        icon: '+HP',
        description: `Immediately repairs ${powers.HEAL.healAmount} castle HP, up to your maximum. The card’s suit bonus also applies.`,
      },
      {
        title: 'GUARD',
        icon: '+8',
        description: `Immediately grants ${powers.GUARD.armorAmount} armor. Armor absorbs enemy damage before castle HP is lost.`,
      },
      {
        title: 'GOLD',
        icon: '$',
        description: `Immediately grants ${powers.GOLD.goldAmount} gold, plus any diamond bonus. Earnings are banked at the end of the siege.`,
      },
      {
        title: 'BOMB',
        icon: '*',
        description: `Immediately deals ${powers.BOMB.flatDamage} damage to every enemy currently on the road. No need to DRAW.`,
      },
      {
        title: 'WILD',
        icon: '±',
        description:
          'The next open card can be any rank or suit. One use only; DRAW ends the effect.',
      },
      {
        title: 'ECHO',
        icon: '+2',
        description: `Adds ${powers.ECHO.comboBonus} extra links to this chain for defense rewards. Example: ECHO alone counts as ${1 + powers.ECHO.comboBonus} links and unlocks the turret.`,
      },
    ],
  },
  {
    title: 'JOKERS',
    entries: [
      {
        title: 'BLACK JOKER',
        icon: '★',
        description:
          'Multiplies newly deployed defender and laser damage by 5 until DRAW. The next card must be spades or clubs.',
      },
      {
        title: 'RED JOKER',
        icon: '★',
        description:
          'Banks healing from 30% of defender and laser damage actually dealt. The next card must be hearts or diamonds.',
      },
      {
        title: 'JOKER ORDER',
        icon: '↔',
        description:
          'Black then red: healing includes the ×5 boost. Red then black: damage rises, but healing stays based on the earlier damage. You can always play a joker on any card.',
      },
    ],
  },
  {
    title: 'SUITS',
    entries: [
      {
        title: 'HEARTS',
        icon: '♥',
        description: `Every heart repairs ${gameConfig.combat.baseHeartHeal} castle HP. Cannot exceed maximum HP; HEAL adds its repair on top.`,
      },
      {
        title: 'CLUBS',
        icon: '♣',
        description: `Every club grants ${gameConfig.combat.baseClubArmor} armor. Armor stays until enemies consume it; GUARD adds more.`,
      },
      {
        title: 'DIAMONDS',
        icon: '♦',
        description: `Every diamond grants ${gameConfig.combat.baseDiamondGold} gold. GOLD adds its own reward on top.`,
      },
      {
        title: 'SPADES',
        icon: '♠',
        description:
          'Spades extend the chain like other ranks. In castle siege they grant no extra repair, armor or gold. Use them to reach defense rewards.',
      },
    ],
  },
  {
    title: 'COMBOS',
    entries: [
      {
        title: '1 LINK · SOLDIERS',
        icon: '1',
        description:
          'DRAW deploys a marching soldier with 1 HP and 1 damage. Soldier upgrades increase squad size.',
      },
      {
        title: '2 LINKS · ARCHER',
        icon: '2',
        description:
          'DRAW also deploys a stationary archer: 1 HP, 2 base damage per arrow. Enemies can kill it at the castle.',
      },
      {
        title: '3 LINKS · TURRET',
        icon: '3',
        description:
          'DRAW also builds your single turret or reloads it to 10 base rounds. Each bullet deals 2 base damage.',
      },
      {
        title: '4 LINKS · ARC CANNON',
        icon: '4',
        description:
          'DRAW also deploys an arc cannon with 12 shells. Each shell deals 9 base damage to up to 3 enemies.',
      },
      {
        title: '5+ LINKS · LASER',
        icon: '5',
        description:
          'DRAW also deals 40 base damage to every enemy. An extra beam is banked at 8, 11, 14… links. All reached rewards deploy together.',
      },
      {
        title: 'NO MOVES · NEW DEAL',
        icon: '−5',
        description: `Empty stock + no legal moves costs ${REDEAL_HP_COST} HP and deals a fresh board. Armor does not absorb this cost. Enemies, defenders and gold stay. At 0 HP the siege ends.`,
      },
    ],
  },
  {
    title: 'UPGRADES',
    entries: [
      {
        title: 'REINFORCED WALLS',
        icon: '+HP',
        description: `+${UPGRADE_VALUES.walls.step} maximum castle HP, starting with the next siege.`,
      },
      {
        title: 'REINFORCEMENTS',
        icon: '+1',
        description: `+${UPGRADE_VALUES.soldier.step} soldier every time you deploy a squad. Individual soldier HP and damage stay the same.`,
      },
      {
        title: 'SHARP ARROWS',
        icon: '>',
        description: `+${UPGRADE_VALUES.knight.step} damage per archer arrow.`,
      },
      {
        title: 'LARGER MAGAZINE',
        icon: '+5',
        description: `+${UPGRADE_VALUES.magazine.step} turret rounds per reload. One turret; refills do not stack magazines.`,
      },
      {
        title: 'EXPLOSIVE SHELLS',
        icon: '*',
        description: `+${UPGRADE_VALUES.mortar.step} arc cannon damage per target.`,
      },
      {
        title: 'FOCUSED LASER',
        icon: '/',
        description: `+${UPGRADE_VALUES.laser.step} laser damage to each enemy. Victory choice bonuses last until defeat. Purchased workshop levels are permanent.`,
      },
    ],
  },
];

/** Paged cards keep explanations readable without a long mobile scroll. */
export class CastleGuideScene extends Phaser.Scene {
  private group = 0;
  private page = 0;
  private content?: Phaser.GameObjects.Container;
  constructor() {
    super('CastleGuideScene');
  }
  create(): void {
    configureViewport(this);
    AudioSystem.setMusicScene('menu');
    this.content = undefined;
    this.cameras.main.setBackgroundColor('#213e48');
    this.draw();
    const resize = () => this.scene.restart();
    this.scale.on('resize', resize);
    this.events.once('shutdown', () => this.scale.off('resize', resize));
  }
  private draw(): void {
    this.content?.destroy();
    const { width: w } = viewport(this),
      safe = safeArea(this);
    const root = this.add.container(w / 2, safe.top);
    this.content = root;
    const text = (x: number, y: number, label: string, size: number, color = '#fff4d8') =>
      this.add.text(x, y, label, {
        resolution: getRenderDensity(),
        fontFamily: 'Fredoka',
        fontSize: `${size}px`,
        color,
      });
    root.add(text(0, 30, 'BOOSTER GUIDE', 30, '#ffe35a').setOrigin(0.5));
    root.add(text(0, 65, 'What it does · when it activates', 14).setOrigin(0.5));
    const tabW = (w - 40) / 3;
    groups.forEach((group, i) => {
      const x = ((i % 3) - 1) * (tabW + 4),
        y = 103 + Math.floor(i / 3) * 40;
      const tab = this.add.container(x, y);
      const selected = i === this.group;
      tab.add(
        this.add
          .rectangle(0, 0, tabW, 34, selected ? 0x936335 : 0x315d6a)
          .setStrokeStyle(2, selected ? 0xffda64 : 0x6d989e)
      );
      tab.add(text(0, 0, group.title, 12, selected ? '#ffe35a' : '#fff4d8').setOrigin(0.5));
      tab.setInteractive(
        new Phaser.Geom.Rectangle(-tabW / 2, -17, tabW, 34),
        Phaser.Geom.Rectangle.Contains
      );
      tab.on('pointerup', () => {
        AudioSystem.play('button_tap');
        this.group = i;
        this.page = 0;
        this.draw();
      });
      root.add(tab);
    });
    const entries = groups[this.group].entries;
    const perPage = Math.max(1, Math.min(3, Math.floor((safe.height - 280) / 130)));
    const pages = Math.ceil(entries.length / perPage);
    this.page = Math.min(this.page, pages - 1);
    const cardHeight = Math.min(144, (safe.height - 322) / perPage);
    entries.slice(this.page * perPage, (this.page + 1) * perPage).forEach((entry, i) => {
      const y = 174 + i * (cardHeight + 9),
        width = w - 32;
      const card = this.add.container(0, y);
      card.add(
        this.add
          .graphics()
          .fillStyle(0xf9edcc)
          .fillRoundedRect(-width / 2, 0, width, cardHeight, 14)
          .lineStyle(2, 0x9f673c)
          .strokeRoundedRect(-width / 2, 0, width, cardHeight, 14)
      );
      card.add(
        this.add.rectangle(-width / 2 + 31, 36, 44, 44, 0x315d6a).setStrokeStyle(2, 0x9f673c)
      );
      card.add(text(-width / 2 + 31, 36, entry.icon, 18, '#ffe35a').setOrigin(0.5));
      const tx = -width / 2 + 63;
      card.add(text(tx, 10, entry.title, 15, '#254650'));
      card.add(text(tx, 34, entry.description, 13, '#322149').setWordWrapWidth(width - 76));
      root.add(card);
    });
    const controlsY = safe.height - 96;
    popupButton(
      this,
      root,
      controlsY,
      86,
      'PREV',
      () => {
        this.page = (this.page - 1 + pages) % pages;
        this.draw();
      },
      true
    )
      .setX(-w / 2 + 61)
      .setAlpha(pages > 1 ? 1 : 0.4);
    popupButton(
      this,
      root,
      controlsY,
      86,
      'NEXT',
      () => {
        this.page = (this.page + 1) % pages;
        this.draw();
      },
      true
    )
      .setX(w / 2 - 61)
      .setAlpha(pages > 1 ? 1 : 0.4);
    root.add(text(0, controlsY, `${this.page + 1} / ${pages}`, 16, '#ffe35a').setOrigin(0.5));
    popupButton(this, root, safe.height - 32, w - 40, 'BACK TO MENU', () =>
      this.scene.start('StartScene')
    );
  }
}
