import type Phaser from 'phaser';
import { gamePopup, popupButton, popupTile } from '../presentation/design/GamePopup';
import { getRenderDensity } from '../presentation/design/viewport';
import { AudioSystem } from '../presentation/audio/AudioSystem';
import type { CastleManager } from './CastleManager';
import { MODULES } from './CastleProgression';

function useCyrillicFont(root: Phaser.GameObjects.Container): void {
  for (const object of root.list) {
    if (object.type === 'Text') (object as Phaser.GameObjects.Text).setFontFamily('Rubik');
    else if (object.type === 'Container') useCyrillicFont(object as Phaser.GameObjects.Container);
  }
}

/** Called only while CastleScene has stopped the simulation. */
export function showRunWorkshop(scene: Phaser.Scene, manager: CastleManager, close: () => void): void {
  const modal = gamePopup(scene, 'МАСТЕРСКАЯ', 'Выбери специализацию · оборона на паузе', 610);
  modal.root.setDepth(3000);
  let page: Phaser.GameObjects.Container | undefined;
  const draw = () => {
    page?.destroy();
    page = scene.add.container();
    modal.content.add(page);
    const state = manager.state!;
    page.add(scene.add.text(0, modal.top + 112,
      `ЗАМОК ${state.progression.level} · БАНК ${state.siege.coins}`, {
        resolution: getRenderDensity(), fontFamily: 'Lilita One', fontSize: '18px', color: '#ffe35a',
      }).setOrigin(0.5));
    const height = Math.min(118, (modal.height - 202) / MODULES.length);
    MODULES.forEach((module, i) => {
      const bought = state.progression.modules.includes(module.id);
      const unlocked = state.progression.level >= module.level;
      const affordable = state.siege.coins >= module.cost;
      const badge = bought ? 'УСТАНОВЛЕНО' : !unlocked ? `НУЖЕН УРОВЕНЬ ${module.level}` :
        affordable ? `УСТАНОВИТЬ · ${module.cost} МОНЕТ` : `НУЖНО ${module.cost - state.siege.coins} МОНЕТ`;
      popupTile(scene, page!, modal.top + 137 + i * (height + 5), modal.width - 36,
        height, ['S', 'F', 'L'][i], module.title, module.description, badge,
        !bought && unlocked && affordable, () => {
          if (!manager.buyModule(module.id)) return;
          AudioSystem.play('reward_pick');
          draw();
        });
    });
    popupButton(scene, page, modal.height / 2 - 34, modal.width - 36, 'ПРОДОЛЖИТЬ', () => {
      modal.root.destroy();
      close();
    }, true);
    useCyrillicFont(modal.root);
  };
  draw();
}

/** The menu explains progression; run currency is spent inside its own siege. */
export function showCastleWorkshop(scene: Phaser.Scene, close: () => void): void {
  const modal = gamePopup(scene, 'РАЗВИТИЕ ЗАМКА', 'Каждый забег начинается с солдат', 510);
  modal.root.setDepth(3000);
  modal.content.add(scene.add.text(0, modal.top + 112,
    'Уровни 2–5 открывают лучников, туррель, пушку и магическое ядро.\n\n' +
    'Карты и убитые враги дают опыт. Закрытые награды длинной цепочки тоже дают опыт.\n\n' +
    'Монеты выпадают только из врагов. Во время забега открой мастерскую и выбери щитоносцев, огненные стрелы или подрыв горения лазером.\n\n' +
    'Специализации действуют до конца забега. Постоянные числовые улучшения больше не нужны.', {
      resolution: getRenderDensity(), fontFamily: 'Fredoka', fontSize: '16px', color: '#fff8e5',
      align: 'center', wordWrap: { width: modal.width - 44 },
    }).setOrigin(0.5, 0));
  popupButton(scene, modal.content, modal.height / 2 - 34, modal.width - 36, 'НАЗАД', () => {
    modal.root.destroy();
    close();
  }, true);
  useCyrillicFont(modal.root);
}
