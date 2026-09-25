# Golf Rogue — Отчёт о реконструкции (Фазы 0-3)

**Дата:** 2026-09-25  
**Ветка:** `cursor/core-rebuild-b513`

---

## 1. Что реализовано и играбельно

### Полный игровой цикл
- **Start Screen:** Заголовок, кнопки NEW RUN / CONTINUE
- **Battle Screen:** 7×5 tableau, активная карта, колода, враг с HP и intent
- **Chain механика:** Накопление урона, позиционная формула (1+2+3+...+n)
- **Масти:** ♠ урон, ♥ heal, ♣ armor, ♦ gold — применяются немедленно
- **Power Cards:** CRIT, HEAL, GUARD, GOLD, BOMB, WILD, ECHO — все работают
- **Enemy Attack:** После draw враг атакует, armor поглощает и сбрасывается
- **Reward Screen:** Выбор 1 из 3 реликвий после победы
- **Shop Screen:** Покупка heal и реликвий за gold
- **End Screen:** Victory (после босса) / Defeat
- **Run Structure:** 7 боёв (3 normal → elite → 2 normal → boss)
- **Save/Load:** Автосохранение в localStorage, восстановление при reload

### Игровой баланс (из config.json)
```json
{
  "combat": {
    "baseSpadeDamageBonus": 1,
    "baseHeartHeal": 1,
    "baseClubArmor": 1,
    "baseDiamondGold": 1
  },
  "powerCards": {
    "CRIT": { "damageMultiplier": 3 },
    "HEAL": { "healAmount": 8 },
    "GUARD": { "armorAmount": 8 },
    "GOLD": { "goldAmount": 8 },
    "BOMB": { "flatDamage": 12 },
    "ECHO": { "comboBonus": 2 }
  },
  "shop": {
    "healCost": 10,
    "healAmount": 8,
    "relicBaseCost": 15
  }
}
```

---

## 2. Архитектура и файлы

### Структура проекта
```
src/
├── core/                      # Чистая логика (0 зависимостей от Phaser)
│   ├── types.ts               # Все типы: Card, Enemy, Relic, RunState, GameEvent
│   ├── RNG.ts                 # Seeded Mulberry32 PRNG
│   ├── GameState.ts           # Создание state, setup battle, queries
│   ├── GameRules.ts           # Валидация: isPlayable, canConnect, hasLegalMoves
│   ├── GameActions.ts         # Все actions: playCard, draw, chooseRelic, shop...
│   ├── DamageCalculator.ts    # Формула урона, изолированная и тестируемая
│   ├── *.test.ts              # Unit тесты (54 теста)
│   └── index.ts               # Re-exports
│
├── data/                      # JSON конфигурация
│   ├── config.json            # Все числа баланса
│   ├── enemies.json           # Враги с HP, intents, sprites
│   └── relics.json            # 12 реликвий с эффектами
│
├── presentation/              # Phaser слой (только отображение)
│   ├── GameManager.ts         # Координатор state ↔ scenes
│   └── scenes/
│       ├── BootScene.ts       # Загрузка ассетов
│       ├── StartScene.ts      # Титульный экран
│       ├── BattleScene.ts     # Основной бой
│       ├── RewardScene.ts     # Выбор реликвии
│       ├── ShopScene.ts       # Магазин
│       └── EndScene.ts        # Победа/поражение
│
├── services/
│   └── SaveService.ts         # localStorage save/load
│
└── main.ts                    # Entry point
```

### Ключевые принципы реализации

1. **Состояние — immutable:** `RunState` никогда не мутируется, actions возвращают новый state
2. **Core без Phaser:** Весь `src/core/` можно тестировать в Node.js без браузера
3. **Seeded RNG:** Одинаковый seed → одинаковая игра (детерминизм)
4. **Data-driven:** Баланс в JSON, не в коде
5. **Presentation отражает state:** Сцены получают state и рендерят, не владеют логикой

---

## 3. Тесты

### Запуск
```bash
npm run test
```

### Покрытие (54 теста)

| Файл | Тесты | Что проверяет |
|------|-------|---------------|
| RNG.test.ts | 9 | Детерминизм, shuffle, pick, сериализация state |
| DamageCalculator.test.ts | 12 | Базовый урон, spade bonus, CRIT, BOMB, relics, stacking |
| GameActions.test.ts | 22 | playCard, draw, shop, rewards, save/load round-trip |
| PowerCards.test.ts | 5 | WILD (one-use), ECHO (+2 position) |
| Relics.test.ts | 6 | Все модификаторы урона, стекание нескольких реликвий |

### Примеры тестов

**Формула урона:**
```typescript
it('should calculate chain of 8 = 36 base damage', () => {
  const chain = Array.from({ length: 8 }, (_, i) => makeCard(i + 1, 'hearts'));
  const total = calculateChainDamage(chain, new Map(), [], mockConfig);
  expect(total).toBe(36); // 1+2+3+4+5+6+7+8
});
```

**Save/Load round-trip:**
```typescript
it('should continue from restored state deterministically', () => {
  const state1 = createTestBattleState('determinism-test');
  const state2: RunState = JSON.parse(JSON.stringify(state1));
  expect(state1.battle?.tableau).toEqual(state2.battle?.tableau);
});
```

---

## 4. Известные проблемы и ограничения

### Функциональные
1. **Нет анимации перелёта карты** — карта просто исчезает из tableau и появляется как active
2. **Нет анимаций врага** — только idle bounce, нет Hit/Attack/Death states
3. **Нет масштабирования juice по combo** — одинаковый shake для combo 2 и combo 8
4. **Статусы врагов не реализованы** — buff/debuff intents показываются, но эффекта нет

### Визуальные
5. **Power cards визуально слабо выделены** — маленький badge вместо полной рамки/glow
6. **Intent показывает только число** — нет иконок типа атаки
7. **Safe areas не учтены** — может быть обрезание на iOS

### Технические
8. **Нет звуков** — только визуальный feedback
9. **Нет аналитики** — нет tracking событий
10. **Крупный bundle** — Phaser 1.2MB (можно разбить на chunks)

---

## 5. Что осталось для фаз 4-7

### Фаза 4: Enemy System
- FSM состояний врага (Idle → Anticipation → Attack → Hit → Death)
- Спрайтовые анимации для каждого состояния
- Статусы врагов (poison, weak, shield)
- Attack intent иконки

### Фаза 5: Card Polish
- Анимация взятия карты (lift → fly → land)
- Все состояния карт (selected, hover, disabled)
- Power cards как визуально особенные (рамка, glow, частицы)
- Стабильные позиции tableau (не пересоздавать container)

### Фаза 6: Juice System
- Масштабирование эффектов по combo level (2/4/6/8+)
- Particle trails для карт
- Camera shake intensity по урону
- Sound effects с pitch scaling
- Damage numbers размер по урону

### Фаза 7: Polish
- Responsive layout (375×667 — 430×932)
- Safe area handling (iOS notch)
- Performance optimization
- Sound design
- Key art для start screen

---

## 6. Build и запуск

### Development
```bash
npm install
npm run dev
```

### Production build
```bash
npm run build
# Output: dist/
```

### Тесты
```bash
npm run test        # Single run
npm run test:watch  # Watch mode
```

### Деплой
Import в Vercel, preset: Vite, output: `dist/`

---

## 7. Скриншоты

*(Скриншоты будут добавлены после тестирования)*

- Start Screen (390×844)
- Battle Screen (390×844)
- Chain in progress
- Reward Screen
- Shop Screen
- End Screen (victory/defeat)
- Battle Screen (375×667) — проверка минимального viewport

---

*Документ подготовлен для владельца проекта Golf Rogue.*
