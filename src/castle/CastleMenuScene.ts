import { menuScrim } from './CastleMenuUI';
import { getLanguage, setLanguage } from '../localization/i18n';
import Phaser from 'phaser';
import {
  viewport,
  configureViewport,
  safeArea,
  getRenderDensity,
} from '../presentation/design/viewport';
import { gamePopup, popupButton } from '../presentation/design/GamePopup';
import { AudioSystem } from '../presentation/audio/AudioSystem';
import { SettingsModal } from '../presentation/design/SettingsModal';
import { gameDisplayStyle } from '../presentation/design/displayFont';
import { showCastleWorkshop } from './CastleWorkshop';
import { castleManager } from './CastleManager';
import { trainingCompleted, resetTrainingSession } from './CastleTutorial';

import { isDesktopViewport } from '../presentation/design/desktopLayout';
import { coverImage } from '../presentation/design/coverImage';
import { fadeIn } from '../presentation/juice/transitions';

export function siegeRules(scene: Phaser.Scene, close: () => void) {
  const modal = gamePopup(scene, 'DEFEND THE CASTLE', 'One solitaire. A whole siege.', 560);
  modal.root.setDepth(3000);
  const lines = [
    [
      'PLAY ±1',
      'Take an open card one rank above or below the active card. A ↔ K is blocked; Q ↔ K works. WILD allows any next rank.',
    ],
    [
      'BUILD A CHAIN',
      '1 soldier · 2 archer · 3 turret reload · 4 cannon · 5 laser. Tap the stock to deploy all banked rewards. Rewards repeat every five cards; all are available from round one.',
    ],
    [
      'THE ROAD IS REAL TIME',
      'Enemies emerge from ground portals. All defenses are available through card chains. Boss attacks bypass armor. Pause or switch apps to stop time.',
    ],
    [
      'CARDS KEEP YOU ALIVE',
      'Tap stock to draw. Empty stock: shuffle for 5 HP; recycled cards lose powers, field cards keep them. It glows without moves. 1 WILD, 2 GUARD. Undo reverses a step, including draws and WILD, without a limit. HEAL/BOMB/ECHO: 30/100/50 gold, once.',
    ],
    [
      'FINISH TO WIN',
      'Clear all columns to win. Gold, HP and armor carry forward; abilities and undos reset. Enemies drop gold. Defeat ends the run. New run: full HP, no armor or gold.',
    ],
  ];
  const available = modal.height - 166,
    step = available / lines.length;
  lines.forEach(([title, body], i) => {
    modal.content.add(
      scene.add.text(-modal.width / 2 + 18, modal.top + 106 + i * step, title, {
        resolution: getRenderDensity(),
        ...gameDisplayStyle(title),
        fontSize: '16px',
        color: '#ffe35a',
      })
    );
    modal.content.add(
      scene.add.text(-modal.width / 2 + 18, modal.top + 127 + i * step, body, {
        resolution: getRenderDensity(),
        fontFamily: 'Fredoka, Rubik, sans-serif',
        fontSize: '12px',
        color: '#f4e9ff',
        wordWrap: { width: modal.width - 36 },
      })
    );
  });
  popupButton(scene, modal.content, modal.height / 2 - 34, modal.width - 36, 'GOT IT', () => {
    modal.root.destroy();
    close();
  });
  return modal.root;
}
export class CastleMenuScene extends Phaser.Scene {
  private settings!: SettingsModal;
  constructor() {
    super('StartScene');
  }
  create(): void {
    configureViewport(this);
    AudioSystem.setMusicScene('menu');
    fadeIn(this, { duration: 350 });
    const { width: w, height: h } = viewport(this);
    const safe = safeArea(this);
    const desktop = isDesktopViewport(w, h);
    const landscape = desktop || w / h >= 1.2;
    const compactWide = landscape && !desktop;
    const menuX = landscape ? w * (compactWide ? 0.75 : 0.79) : w / 2;
    const manager = castleManager();
    const meta = manager.service.readMeta();
    const saved = manager.service.load();
    const continuing = saved?.run.phase === 'battle';
    const buttonWidth = landscape
      ? Math.min(364, w * (compactWide ? 0.43 : 0.32))
      : Math.min(w - 48, 368);
    const firstButtonY = landscape
      ? safe.top + safe.height * (compactWide ? 0.51 : 0.55)
      : safe.bottom - (continuing ? 198 : 136);
    const artKey = landscape
      ? w / h >= 2.1
        ? 'menu-story-ultrawide'
        : 'menu-story-wide'
      : 'menu-story-portrait';
    this.cameras.main.setBackgroundColor('#102333');
    coverImage(this, artKey, 0, 0, w, h).setDepth(-10);
    if (landscape) {
      menuScrim(
        this,
        'menu-story-side-v1',
        0,
        0,
        w,
        h,
        [
          [0, 'rgba(9,22,34,0)'],
          [0.46, 'rgba(9,22,34,0)'],
          [0.66, 'rgba(9,22,34,.55)'],
          [0.75, 'rgba(9,22,34,.8)'],
          [1, 'rgba(9,22,34,.55)'],
        ],
        true
      ).setDepth(40);
    }
    menuScrim(this, 'menu-story-vertical-v1', 0, 0, w, h, [
      [0, 'rgba(9,22,34,.4)'],
      [0.24, 'rgba(9,22,34,0)'],
      [0.67, 'rgba(9,22,34,0)'],
      [0.86, 'rgba(9,22,34,.25)'],
      [1, 'rgba(9,22,34,.78)'],
    ]).setDepth(41);

    const language = this.text(w - 45, safe.top + 13,
      getLanguage() === 'ru' ? 'RU / EN' : 'EN / RU', 12, '#ffe35a')
      .setPadding(8).setDepth(100).setInteractive({ useHandCursor: true })
      .setName('menu-language');
    language.on('pointerup', () => {
      setLanguage(getLanguage() === 'ru' ? 'en' : 'ru');
      this.scene.restart();
    });

    const titleY = landscape
      ? safe.top + safe.height * (compactWide ? 0.13 : 0.18)
      : safe.top + (safe.height < 620 ? 28 : 52);
    const logoSize = desktop ? 60 : compactWide ? 31 : w >= 430 ? 53 : w < 350 ? 39 : 45;
    this.text(menuX, titleY, 'CASTLE', logoSize * 0.86, '#fff1b3')
      .setStroke('#1b1030', 5)
      .setDepth(100);
    this.text(menuX, titleY + logoSize * 0.93, 'SOLITAIRE', logoSize, '#fff1b3')
      .setStroke('#1b1030', 5)
      .setDepth(100);
    if (!compactWide && safe.height >= 620) {
      this.text(
        menuX,
        titleY + logoSize * 1.77,
        'Собери цепочку. Защити замок.',
        desktop ? 16 : 14,
        '#fff3d7'
      )
        .setStroke('#19313c', 1.5)
        .setDepth(100);
    }

    const buttons = this.add.container(menuX, firstButtonY).setDepth(100).setName('menu-actions');
    let row = 0;
    if (continuing) {
      popupButton(this, buttons, row++ * 62, buttonWidth, 'ПРОДОЛЖИТЬ', () =>
        this.beginSiege(true)
      ).setName('menu-continue');
    }
    popupButton(
      this,
      buttons,
      row++ * 62,
      buttonWidth,
      'НОВАЯ ИГРА',
      () => {
        if (continuing) this.startOver();
        else this.beginSiege(false);
      },
      continuing
    ).setName('menu-new-game');
    popupButton(
      this,
      buttons,
      row * 62,
      buttonWidth,
      'НАСТРОЙКИ',
      () => this.settings.show(),
      true
    ).setName('menu-settings');

    if (continuing)
      this.text(
        menuX,
        firstButtonY - 47,
        'ОСАДА ' + saved.siegeNumber + '  •  УРОВЕНЬ ' + saved.progression.level,
        compactWide ? 10 : 14,
        '#ffe5a7'
      )
        .setStroke('#19313c', 1.5)
        .setDepth(100);
    const record =
      meta.bestSiege > 0 || meta.bestKills > 0
        ? 'Лучшая осада: ' + meta.bestSiege + '  •  ' + meta.bestKills + ' врагов'
        : 'Карты решают. Замок держится.';
    const footer = this.text(
      menuX,
      safe.bottom - 18,
      record,
      desktop ? 16 : compactWide ? 9 : w < 350 ? 12 : 14,
      '#f1e2bf'
    )
      .setStroke('#19313c', 1.5)
      .setDepth(100);
    const footerWidth = landscape ? buttonWidth + 12 : w - 32;
    if (footer.width > footerWidth) footer.setScale(footerWidth / footer.width);

    this.settings = new SettingsModal(this, {
      variant: 'menu',
      onResume: () => {},
      onRestart: () => {},
      onMainMenu: () => {},
      onMore: () => this.moreMenu(),
    });
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && this.settings.isVisible()) this.settings.hide();
    };
    this.input.keyboard?.on('keydown', escape);
    const resize = () => this.scene.restart();
    this.scale.on('resize', resize);
    this.events.once('shutdown', () => {
      this.scale.off('resize', resize);
      this.input.keyboard?.off('keydown', escape);
      this.settings.destroy();
    });
  }

  private beginSiege(resume: boolean): void {
    const manager = castleManager();
    AudioSystem.unlock();
    if (!trainingCompleted()) {
      this.scene.start('CastleScene', { tutorial: true, finish: resume ? 'resume' : 'start' });
      return;
    }
    if (resume) manager.resume();
    else manager.start();
    this.scene.start('CastleScene', { tutorial: false });
  }

  private moreMenu(): void {
    if (this.children.getByName('menu-options')) return;
    const modal = gamePopup(this, 'ДОПОЛНИТЕЛЬНО', '', 470);
    modal.root.setName('menu-options');
    const rows: [string, string, () => void][] = [
      ['МОЙ ЗАМОК', 'castle', () => this.workshop()],
      [
        'ОБУЧЕНИЕ',
        'training',
        () => this.scene.start('CastleScene', { tutorial: true, finish: 'menu' }),
      ],
      ['ПРАВИЛА', 'rules', () => siegeRules(this, () => {})],
      ['ОБ ИГРЕ', 'credits', () => this.credits()],
    ];
    const columns = modal.height < 430 ? 2 : 1;
    const rowWidth = (modal.width - 40 - (columns - 1) * 12) / columns;
    rows.forEach(([label, name, action], index) => {
      const button = popupButton(
        this,
        modal.content,
        modal.top + 108 + Math.floor(index / columns) * 58,
        rowWidth,
        label,
        () => {
          modal.root.destroy();
          action();
        },
        true
      ).setName('menu-option-' + name);
      if (columns === 2) button.setX(((index % 2 ? 1 : -1) * (rowWidth + 12)) / 2);
      const text = button.list.find(
        (child) => child instanceof Phaser.GameObjects.Text
      ) as Phaser.GameObjects.Text;
      if (text.width > rowWidth - 20) text.setFontSize((21 * (rowWidth - 20)) / text.width);
    });
    const reset = this.text(0, modal.height / 2 - 98, 'Сбросить прогресс', 13, '#ffb8b4')
      .setPadding(18, 12)
      .setInteractive({ useHandCursor: true })
      .setName('menu-reset');
    reset.on('pointerup', () => {
      modal.root.destroy();
      this.resetProgress();
    });
    modal.content.add(reset);
    popupButton(this, modal.content, modal.height / 2 - 42, modal.width - 40, 'НАЗАД', () => {
      modal.root.destroy();
      this.settings.show();
    }).setName('menu-options-back');
  }

  private startOver(): void {
    const manager = castleManager();
    const modal = gamePopup(
      this,
      'НАЧАТЬ ЗАНОВО?',
      'Текущая осада закончится. Заработанные монеты сохранятся.',
      270
    );
    modal.root.setName('menu-new-confirm');
    popupButton(this, modal.content, 35, modal.width - 36, 'НОВАЯ ИГРА', () => {
      manager.resume();
      if (manager.state) {
        manager.state.run = { ...manager.state.run, phase: 'defeat' };
        manager.service.settle(manager.state);
        manager.save();
      }
      this.beginSiege(false);
    }).setName('menu-confirm-new');
    popupButton(
      this,
      modal.content,
      97,
      modal.width - 36,
      'НАЗАД',
      () => modal.root.destroy(),
      true
    ).setName('menu-cancel-new');
  }

  private text(x: number, y: number, text: string, size: number, color = '#fff8eb') {
    return this.add
      .text(x, y, text, {
        resolution: getRenderDensity(),
        ...gameDisplayStyle(text),
        fontSize: `${size}px`,
        color,
      })
      .setOrigin(0.5);
  }
  private credits(): void {
    const modal = gamePopup(this, 'CREDITS', 'Artists, audio and licenses', 400);
    const content =
      'Models & animation · Kenney · CC0\nCombat VFX · Kalponic Studio / Jony · CC BY 4.0\nMusic by YannZ – https://yannz41.itch.io\nSpotify: https://open.spotify.com/intl-it/artist/\n76CUcHd0t0XViSm9YBbHBw\nContact: yziango@gmail.com\nFoley & laser · Kenney · CC0\nOther SFX · Chequered Ink · commercial license\nFonts · Google Fonts · SIL OFL 1.1';
    modal.content.add(
      this.add
        .text(0, modal.top + 110, content, {
          resolution: getRenderDensity(),
          ...gameDisplayStyle(content),
          fontSize: '12px',
          color: '#f4e9ff',
          align: 'center',
          lineSpacing: 3,
        })
        .setOrigin(0.5, 0)
    );
    const link = this.text(0, modal.top + 310, 'VFX SOURCE & LICENSE', 13, '#ffe35a')
      .setPadding(10)
      .setInteractive();
    link.on('pointerup', () =>
      window.open('https://kalponic-studio.itch.io/free-stylized-sprite-vfx', '_blank', 'noopener')
    );
    modal.content.add(link);
    popupButton(
      this,
      modal.content,
      modal.height / 2 - 34,
      modal.width - 36,
      'BACK',
      () => modal.root.destroy(),
      true
    );
  }
  private resetProgress(): void {
    const modal = gamePopup(
      this,
      'RESET ALL PROGRESS?',
      'Delete coins, upgrades, records and your current siege. This cannot be undone.',
      300
    );
    popupButton(this, modal.content, 30, modal.width - 36, 'DELETE ALL PROGRESS', () => {
      if (!castleManager().resetProgress()) {
        const error = this.text(
          0,
          modal.top + 110,
          'Could not reset. Please try again.',
          14,
          '#ff9b9b'
        );
        modal.content.add(error);
        return;
      }
      resetTrainingSession();
      modal.root.destroy();
      this.scene.restart();
    });
    popupButton(
      this,
      modal.content,
      94,
      modal.width - 36,
      'CANCEL',
      () => modal.root.destroy(),
      true
    );
  }
  private workshop(): void {
    showCastleWorkshop(this, () => this.scene.restart());
  }
}
