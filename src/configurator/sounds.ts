import type { SoundId } from '../presentation/audio/AudioSystem';

export const SOUND_CATALOG = {
  archer_shot: { url: '/audio/user-sfx-v1/arrow_01.mp3', label: 'Выстрел лучника' },
  soldier_shot: { url: '/audio/user-sfx-v1/sword_01.mp3', label: 'Удар солдата' },
  unit_deploy: { url: '/audio/user-sfx-v1/place.mp3', label: 'Размещение лучника, туррели и пушки' },
  turret_reload: { url: '/audio/soft-v1/reload.mp3', label: 'Перезарядка башни' },
  power_crit: { url: '/audio/user-sfx-v1/crit_01.mp3', label: 'Критический удар' },
  power_heal: { url: '/audio/user-sfx-v1/heal.mp3', label: 'Лечение' },
  power_guard: { url: '/audio/user-sfx-v1/armor.mp3', label: 'Защита' },
  power_gold: { url: '/audio/ci-v1/gold.mp3', label: 'Золото' },
  power_bomb: { url: '/audio/user-sfx-v1/bomb.mp3', label: 'Бомба' },
  power_wild: { url: '/audio/user-sfx-v1/wild.mp3', label: 'Дикая карта' },
  power_echo: { url: '/audio/user-sfx-v1/echo.mp3', label: 'Эхо' },
  power_red_joker: { url: '/audio/ci-v1/red-joker.mp3', label: 'Красный джокер' },
  power_black_joker: { url: '/audio/ci-v1/black-joker.mp3', label: 'Чёрный джокер' },
  card_shuffle: { url: '/audio/user-sfx-v1/shuffle.mp3', label: 'Перемешивание карт' },
  footstep_1: { url: '/audio/user-sfx-v1/step_01.mp3', label: 'Шаг 1' },
  footstep_2: { url: '/audio/user-sfx-v1/step_02.mp3', label: 'Шаг 2' },
  orc_growl: { url: '/audio/combat-v2/growl.mp3', label: 'Рычание орка' },
  orc_hit: { url: '/audio/combat-v2/grunt.mp3', label: 'Ранение орка' },
  orc_death: { url: '/audio/combat-v2/death.mp3', label: 'Гибель орка' },
  turret_shot: { url: '/audio/user-sfx-v1/turret.mp3', label: 'Выстрел башни' },
  mortar_shot: { url: '/audio/user-sfx-v1/cannon.mp3', label: 'Выстрел мортиры' },
  laser_blast: { url: '/audio/user-sfx-v1/laser.mp3', label: 'Лазер' },
  card_play: { url: '/audio/user-sfx-v1/card_01.mp3', label: 'Розыгрыш карты (общий)' },
  card_play_1: { url: '/audio/user-sfx-v1/card_01.mp3', label: 'Карта: вариант 1' },
  card_play_2: { url: '/audio/user-sfx-v1/card_02.mp3', label: 'Карта: вариант 2' },
  card_play_3: { url: '/audio/user-sfx-v1/card_03.mp3', label: 'Карта: вариант 3' },
  card_draw: { url: '/audio/user-sfx-v1/card_02.mp3', label: 'Взятие карты' },
  invalid_tap: { url: '/audio/user-sfx-v1/not-allowed.mp3', label: 'Недопустимый ход' },
  combo_up: { url: '/audio/ci-v1/combo.mp3', label: 'Рост комбо' },
  enemy_hit: { url: '/audio/ci-v1/strike.mp3', label: 'Удар по врагу' },
  player_hit: { url: '/audio/soft-v1/wall-hit.mp3', label: 'Урон замку / игроку' },
  shield: { url: '/audio/user-sfx-v1/armor.mp3', label: 'Щит' },
  enemy_death: { url: '/audio/combat-v2/death.mp3', label: 'Гибель врага' },
  victory: { url: '/audio/user-sfx-v1/victory.mp3', label: 'Победа' },
  defeat: { url: '/audio/user-sfx-v1/defeated.mp3', label: 'Поражение' },
  button_tap: { url: '/audio/user-sfx-v1/button.mp3', label: 'Нажатие кнопки' },
  reward_pick: { url: '/audio/user-sfx-v1/succsess.mp3', label: 'Награда / успешная покупка и улучшение' },
} satisfies Record<SoundId, { url: string; label: string }>;

/** Additional takes share the event's volume, throttle and configurator override. */
export const SOUND_VARIANTS: Partial<Record<SoundId, string[]>> = {
  archer_shot: ['/audio/user-sfx-v1/arrow_02.mp3'],
  soldier_shot: [2, 3, 4, 5].map((take) => `/audio/user-sfx-v1/sword_0${take}.mp3`),
  power_crit: ['/audio/user-sfx-v1/crit_02.mp3'],
  unit_deploy: ['/audio/user-sfx-v1/place_02.mp3'],
};

export const MUSIC_URL = '/audio/user-sfx-v1/menu.mp3';
export const BATTLE_MUSIC_URL = '/audio/user-sfx-v1/game.mp3';
export const MUSIC_CATALOG = {
  music: { url: MUSIC_URL, label: 'Музыка меню' },
  music_battle: { url: BATTLE_MUSIC_URL, label: 'Музыка боя' },
};
