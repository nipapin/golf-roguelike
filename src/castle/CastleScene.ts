import Phaser from 'phaser';
import { viewport, configureViewport, getRenderDensity } from '../presentation/design/viewport';
import { getLayoutMetrics } from '../presentation/design/tokens';
import { ArenaBackground } from '../presentation/design/ArenaBackground';
import { CardVisual } from '../presentation/design/CardVisual';
import { canConnect, getPowerType } from '../core/GameState';
import { AudioSystem } from '../presentation/audio/AudioSystem';
import { SettingsModal } from '../presentation/design/SettingsModal';
import { gamePopup, popupButton } from '../presentation/design/GamePopup';
import { playCombatVFX } from '../presentation/design/CombatVFX';
import { isShakeReduced } from '../presentation/juice/fxSettings';
import { castleArt, weaponArt } from './CastleArt';
import { castleManager } from './CastleManager';
import { siegeRules } from './CastleMenuScene';
import { STEP, earnedCoins, type Invader, type Defender, type SiegeEvent } from './CastleDefense';

interface EnemyView {
  root: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Sprite;
  hp: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
}
interface UnitView {
  root: Phaser.GameObjects.Container;
  body?: Phaser.GameObjects.Sprite;
  label: Phaser.GameObjects.Text;
}
const RULES_KEY = 'golf-castle-rules-v1';
export class CastleScene extends Phaser.Scene {
  private layout!: ReturnType<typeof getLayoutMetrics>;
  private cards = new Map<string, CardVisual>();
  private active: CardVisual | null = null;
  private invaders = new Map<number, EnemyView>();
  private defenders = new Map<number, UnitView>();
  private castle!: Phaser.GameObjects.Container;
  private hp!: Phaser.GameObjects.Graphics;
  private hpText!: Phaser.GameObjects.Text;
  private coins!: Phaser.GameObjects.Text;
  private chainText!: Phaser.GameObjects.Text;
  private stockText!: Phaser.GameObjects.Text;
  private status!: Phaser.GameObjects.Text;
  private activeLabel!: Phaser.GameObjects.Text;
  private steps: Phaser.GameObjects.Rectangle[] = [];
  private settings!: SettingsModal;
  private paused = false;
  private locked = false;
  private ended = false;
  private accumulator = 0;
  private saveTimer = 0;
  private nextShotSound = 0;
  constructor() {
    super('CastleScene');
  }
  create(): void {
    configureViewport(this);
    const manager = castleManager();
    if (!manager.state && !manager.resume()) manager.start();
    this.cards = new Map();
    this.invaders = new Map();
    this.defenders = new Map();
    this.steps = [];
    this.accumulator = 0;
    this.saveTimer = 0;
    this.paused = false;
    this.locked = false;
    this.ended = false;
    this.active = null;
    this.nextShotSound = 0;
    const { width: w, height: h } = viewport(this);
    this.layout = getLayoutMetrics(w, h);
    const { arenaTop, arenaHeight, tableTop, hudTop, bannerTop, relicTop } = this.layout;
    const bg = new ArenaBackground(this);
    bg.draw(w, arenaTop, arenaHeight, 'castle');
    this.cameras.main.setBackgroundColor('#140a2a');
    const felt = this.add
      .graphics()
      .fillStyle(0x392179)
      .fillRect(0, tableTop, w, h - tableTop);
    felt.lineStyle(3, 0x9f673c).lineBetween(0, tableTop, w, tableTop).setDepth(0);
    const ground = this.groundY();
    const road = this.add
      .graphics()
      .fillStyle(0xc1956a, 0.8)
      .fillEllipse(w / 2, ground - 1, w * 1.2, 28);
    road.lineStyle(2, 0xffdaa7, 0.6);
    for (let x = 0; x < w * 0.73; x += 24) road.lineBetween(x, ground - 1, x + 10, ground - 1);
    this.castle = castleArt(
      this,
      w * 0.87,
      ground,
      Math.min(1.15, (arenaHeight - 20) / 158)
    ).setDepth(22);
    this.add.rectangle(w / 2, hudTop + 20, w - 16, 40, 0x21163a).setStrokeStyle(2, 0x654581);
    this.text(17, hudTop + 20, 'CASTLE SIEGE', 16).setOrigin(0, 0.5);
    this.add.image(w * 0.62, hudTop + 20, 'coin').setDisplaySize(23, 23);
    this.coins = this.text(w * 0.69, hudTop + 20, '0', 17, '#ffe35a');
    const pause = this.add
      .rectangle(w - 31, hudTop + 20, 44, 40, 0x443266)
      .setStrokeStyle(1, 0x8563bd)
      .setInteractive();
    this.text(w - 31, hudTop + 20, 'Ⅱ', 23);
    pause.on('pointerup', () => {
      if (this.ended) return;
      this.paused = true;
      manager.save();
      AudioSystem.setMusicScene('menu');
      this.settings.show();
    });
    this.hp = this.add.graphics();
    this.hpText = this.text(w * 0.32, this.layout.playerHudTop + 15, '', 17);
    this.status = this.text(w * 0.76, this.layout.playerHudTop + 15, '', 11, '#aeeaff');
    this.chainText = this.text(w / 2, relicTop + 14, '', 13, '#ffe5a4');
    const labels = ['1 SOLDIER', '2 KNIGHT', '3 TURRET', '4 MORTAR', '5 LASER'];
    labels.forEach((label, i) => {
      const x = 8 + ((i + 0.5) * (w - 16)) / 5;
      const box = this.add
        .rectangle(x, bannerTop + 17, (w - 20) / 5 - 3, 32, 0x25193e)
        .setStrokeStyle(1, 0x8862ba);
      this.steps.push(box);
      this.text(x, bannerTop + 17, label, w < 380 ? 9 : 10, '#fff1c9');
    });
    const stock = this.add.container(24, this.layout.trayTop + 8);
    const width = w * 0.48,
      height = this.layout.trayHeight - 15;
    stock.add(
      this.add
        .rectangle(width / 2, height / 2 + 4, width, height, 0x211631)
        .setStrokeStyle(3, 0x211631)
    );
    stock.add(
      this.add.rectangle(width / 2, height / 2, width, height, 0x345b99).setStrokeStyle(2, 0x9ec7ff)
    );
    stock.add(this.text(width / 2, 21, 'DRAW', 25));
    this.stockText = this.text(width / 2, 53, '', 12, '#d9e5ff');
    stock.add(this.stockText);
    stock
      .setInteractive(
        new Phaser.Geom.Rectangle(0, 0, width, height),
        Phaser.Geom.Rectangle.Contains
      )
      .on('pointerup', () => {
        if (this.paused || this.locked || this.ended) return;
        AudioSystem.unlock();
        const result = manager.draw();
        if (!result) return;
        this.renderCards();
        this.refreshHUD();
        this.handleEvents(result.events);
        if (this.active) {
          this.active.getContainer().setScale(0.15, 1);
          this.tweens.add({
            targets: this.active.getContainer(),
            scaleX: 1,
            duration: 170,
            ease: 'Back.out',
          });
        }
      });
    const target = this.activePosition();
    this.activeLabel = this.text(
      target.x + this.layout.cw / 2,
      target.y + this.layout.ch + 13,
      '',
      11,
      '#e0ccff'
    );
    this.settings = new SettingsModal(this, {
      onResume: () => {
        this.paused = false;
        AudioSystem.setMusicScene('battle');
      },
      onRestart: () => {
        this.bankAbandoned();
        manager.start();
        this.scene.restart();
      },
      onMainMenu: () => {
        manager.save();
        this.scene.start('StartScene');
      },
    });
    this.renderCards();
    this.syncActors();
    this.refreshHUD();
    AudioSystem.setMusicScene('battle');
    let seen = false;
    try {
      seen = localStorage.getItem(RULES_KEY) === 'yes';
    } catch {
      /* Private storage. */
    }
    if (manager.state!.run.phase !== 'battle') this.endPopup();
    else if (!seen) {
      this.paused = true;
      AudioSystem.setMusicScene('menu');
      siegeRules(this, () => {
        try {
          localStorage.setItem(RULES_KEY, 'yes');
        } catch {
          /* Private storage. */
        }
        this.paused = false;
        AudioSystem.setMusicScene('battle');
      });
    }
    const visibility = () => {
      this.accumulator = 0;
      manager.save();
      if (document.hidden) AudioSystem.setMusicScene('menu');
      else if (!this.paused && !this.ended) AudioSystem.setMusicScene('battle');
    };
    const resize = () => {
      manager.save();
      this.scene.restart();
    };
    const pagehide = () => manager.save();
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', pagehide);
    this.scale.on('resize', resize);
    this.events.once('shutdown', () => {
      manager.save();
      this.settings.destroy();
      this.cards.clear();
      this.invaders.clear();
      this.defenders.clear();
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pagehide', pagehide);
      this.scale.off('resize', resize);
    });
  }
  update(_time: number, delta: number): void {
    if (this.paused || this.ended || document.hidden) {
      this.accumulator = 0;
      return;
    }
    // A delayed frame never fast-forwards an inactive siege.
    this.accumulator += Math.min(delta / 1000, 0.5);
    this.saveTimer += delta / 1000;
    while (this.accumulator >= STEP) {
      this.accumulator -= STEP;
      const result = castleManager().step();
      if (!result) break;
      this.handleEvents(result.events);
      this.syncActors();
      this.refreshHUD();
      if (this.ended) break;
    }
    if (this.saveTimer >= 2) {
      castleManager().save();
      this.saveTimer = 0;
    }
    for (const unit of castleManager().state?.siege.units ?? []) {
      const view = this.defenders.get(unit.id);
      if (!view) continue;
      const target = this.unitPosition(unit);
      view.root.x += (target.x - view.root.x) * Math.min(1, delta / 90);
      view.root.y =
        target.y +
        (unit.kind === 'soldier' || unit.kind === 'knight'
          ? Math.sin(this.time.now / 100 + unit.id) * 1.5
          : 0);
    }
    for (const enemy of castleManager().state?.siege.enemies ?? []) {
      const view = this.invaders.get(enemy.id);
      if (!view) continue;
      const target = this.enemyPosition(enemy);
      view.root.x += (target.x - view.root.x) * Math.min(1, delta / 90);
      view.root.y =
        target.y + Math.sin(this.time.now / 140 + enemy.id) * (enemy.progress < 0.94 ? 1.5 : 0.5);
    }
  }
  private text(x: number, y: number, text: string, size: number, color = '#fff8e5') {
    return this.add
      .text(x, y, text, {
        resolution: getRenderDensity(),
        fontFamily: 'Lilita One',
        fontSize: `${size}px`,
        color,
        align: 'center',
      })
      .setOrigin(0.5);
  }
  private groundY() {
    return this.layout.arenaTop + this.layout.arenaHeight - 14;
  }
  private enemyPosition(enemy: Invader) {
    return {
      x: 10 + enemy.progress * viewport(this).width * 0.78,
      y: this.groundY() - (enemy.id % 4) * 14,
    };
  }
  private activePosition() {
    return { x: viewport(this).width * 0.78 - this.layout.cw / 2, y: this.layout.trayTop + 7 };
  }
  private unitPosition(unit: Defender) {
    return {
      x: 10 + unit.progress * viewport(this).width * 0.78 + ((unit.id % 3) - 1) * 4,
      y:
        this.groundY() -
        (unit.kind === 'turret' || unit.kind === 'mortar' ? 14 : (unit.id % 2) * 9),
    };
  }
  private renderCards(): void {
    const battle = castleManager().state!.run.battle!;
    const next = new Set<string>(),
      { side, cw, gap, tableauTop, strip } = this.layout;
    battle.tableau.forEach((column, col) =>
      column.cards.forEach((card, row) => {
        next.add(card.id);
        let visual = this.cards.get(card.id);
        const x = side + col * (cw + gap),
          y = tableauTop + row * strip;
        if (!visual) {
          visual = new CardVisual(this, x, y, card, getPowerType(battle.powerCards, card.id));
          this.cards.set(card.id, visual);
          visual.setInteractive(() => this.play(card.id));
        }
        visual.setPosition(x, y);
        visual.setDepth(60 + row);
        const exposed = row === column.cards.length - 1;
        visual.setState(
          !exposed
            ? 'covered'
            : battle.activeCard && canConnect(card, battle.activeCard, battle.wildActive)
              ? 'playable'
              : 'normal'
        );
      })
    );
    for (const [id, visual] of this.cards)
      if (!next.has(id)) {
        visual.destroy();
        this.cards.delete(id);
      }
    if (this.active?.getCard().id !== battle.activeCard?.id) {
      this.active?.destroy();
      this.active = null;
      if (battle.activeCard) {
        const p = this.activePosition();
        this.active = new CardVisual(
          this,
          p.x,
          p.y,
          battle.activeCard,
          getPowerType(battle.powerCards, battle.activeCard.id)
        );
        this.active.setDepth(80);
        this.active.setState('active');
      }
    }
  }
  private play(id: string): void {
    if (this.paused || this.locked || this.ended) return;
    AudioSystem.unlock();
    const manager = castleManager(),
      before = manager.state;
    const result = manager.play(id);
    if (!result || result.state === before) {
      AudioSystem.play('invalid_tap', { volume: 0.45 });
      const container = this.cards.get(id)?.getContainer();
      if (container) {
        const x = container.x;
        this.tweens.add({
          targets: container,
          x: x + 4,
          duration: 40,
          yoyo: true,
          repeat: 2,
          onComplete: () => container.setX(x),
        });
      }
      return;
    }
    const visual = this.cards.get(id);
    this.cards.delete(id);
    if (visual) {
      visual.disableInteractive();
      visual.setDepth(250);
      const p = this.activePosition();
      this.tweens.add({
        targets: visual.getContainer(),
        x: p.x,
        y: p.y,
        angle: 8,
        duration: 190,
        ease: 'Cubic.out',
        onComplete: () => visual.destroy(),
      });
    }
    this.locked = true;
    this.time.delayedCall(120, () => {
      this.locked = false;
    });
    this.renderCards();
    this.handleEvents(result.events);
    this.syncActors();
    this.refreshHUD();
  }
  private refreshHUD(): void {
    const state = castleManager().state!,
      player = state.run.player,
      chain = state.run.battle!.chain.length;
    const { width: w } = viewport(this),
      y = this.layout.playerHudTop + 5;
    this.hp
      .clear()
      .fillStyle(0x3b153d)
      .fillRoundedRect(12, y, w * 0.58, 22, 11);
    this.hp
      .fillStyle(player.hp / player.maxHp < 0.3 ? 0xff4f61 : 0x67dcc3)
      .fillRoundedRect(14, y + 2, Math.max(0, ((w * 0.58 - 4) * player.hp) / player.maxHp), 18, 9);
    this.hpText.setText(`CASTLE ${Math.ceil(player.hp)} / ${player.maxHp}`);
    this.coins.setText(String(state.siege.coins + player.gold));
    this.status.setText(`ARMOR ${player.armor}\nENEMIES ${state.siege.enemies.length}`);
    const danger = state.siege.enemies.some((e) => e.progress >= 0.72);
    this.status.setColor(danger ? '#ff6b84' : '#bff5ff');
    this.chainText.setText(
      state.siege.started ? `CHAIN ${chain} · DRAW TO DEPLOY` : 'FIRST MOVE STARTS THE SIEGE'
    );
    this.steps.forEach((box, i) =>
      box
        .setFillStyle(chain > i ? 0x936335 : 0x25193e)
        .setStrokeStyle(chain > i ? 2 : 1, chain > i ? 0xffda64 : 0x8862ba)
    );
    const left = state.run.battle!.tableau.reduce((n, col) => n + col.cards.length, 0);
    this.stockText.setText(
      `${chain ? 'DRAW TO DEPLOY' : 'No chain banked'}\n${state.run.battle!.deck.length} stock · ${left} cards left`
    );
    this.activeLabel.setText(
      state.run.battle!.wildActive
        ? 'WILD · ANY CARD'
        : state.run.battle!.activeCard?.joker === 'red'
          ? 'RED NEXT'
          : state.run.battle!.activeCard?.joker === 'black'
            ? 'BLACK NEXT'
            : 'ACTIVE · ±1'
    );
  }
  private syncActors(): void {
    const state = castleManager().state!;
    for (const enemy of state.siege.enemies) {
      let view = this.invaders.get(enemy.id);
      if (!view) {
        const p = this.enemyPosition(enemy),
          root = this.add.container(p.x, p.y).setDepth(39 - (enemy.id % 4));
        const size = Math.min(enemy.boss ? 90 : 59, this.layout.arenaHeight * 0.6);
        const body = this.add
          .sprite(0, 0, `enemy-${enemy.sprite}`)
          .setDisplaySize(size, size)
          .setOrigin(0.5, 1);
        body.play(`${enemy.sprite}-idle`);
        const hp = this.add.graphics(),
          label = this.text(0, -size - 9, enemy.boss ? 'BOSS' : '', 10, '#ffe1a0');
        root.add([body, hp, label]);
        view = { root, body, hp, label };
        this.invaders.set(enemy.id, view);
      }
      const size = view.body.displayHeight,
        width = enemy.boss ? 46 : 28;
      view.hp
        .clear()
        .fillStyle(0x211631)
        .fillRoundedRect(-width / 2 - 1, -size - 2, width + 2, 6, 3);
      view.hp
        .fillStyle(enemy.boss ? 0xffab4d : 0xee536a)
        .fillRect(-width / 2, -size, (width * enemy.hp) / enemy.maxHp, 3);
      view.label.setText(enemy.boss ? 'BOSS' : enemy.progress >= 0.72 ? '!' : '');
      if (enemy.progress >= 0.72) view.body.setTint(0xff9f9f);
      else if (enemy.hp / enemy.maxHp < 0.3) view.body.setTint(enemy.boss ? 0xffbba0 : 0xd2b8ff);
      else view.body.clearTint();
    }
    const ids = new Set(state.siege.units.map((u) => u.id));
    for (const [id, view] of this.defenders)
      if (!ids.has(id)) {
        view.root.destroy();
        this.defenders.delete(id);
      }
    for (const unit of state.siege.units) {
      let view = this.defenders.get(unit.id);
      if (!view) {
        const p = this.unitPosition(unit),
          root = this.add.container(p.x, p.y).setDepth(42);
        let body: Phaser.GameObjects.Sprite | undefined;
        if (unit.kind === 'soldier' || unit.kind === 'knight') {
          const sprite = unit.kind === 'knight' ? 'c_angel2' : 'c_angel1';
          body = this.add
            .sprite(0, 0, `enemy-${sprite}`)
            .setOrigin(0.5, 1)
            .setDisplaySize(unit.kind === 'knight' ? 56 : 47, unit.kind === 'knight' ? 56 : 47)
            .setFlipX(true);
          body.play(`${sprite}-idle`);
          root.add(body);
        } else root.add(weaponArt(this, unit.kind === 'mortar'));
        const label = this.text(0, 9, '', 9, '#bff5ff');
        root.add(label);
        root.setAlpha(0).setScale(0.45);
        this.tweens.add({ targets: root, alpha: 1, scale: 1, duration: 260, ease: 'Back.out' });
        view = { root, body, label };
        this.defenders.set(unit.id, view);
      }
      view.label.setText(
        unit.kind === 'turret' || unit.kind === 'mortar'
          ? String(unit.ammo)
          : `${unit.hp}/${unit.maxHp} HP`
      );
    }
  }
  private handleEvents(events: SiegeEvent[]): void {
    for (const event of events)
      switch (event.type) {
        case 'card':
          AudioSystem.playCardSound(event.chain);
          for (const e of event.events) {
            if (e.type === 'power_activated') {
              AudioSystem.playPower(e.powerType);
              const p = this.activePosition();
              playCombatVFX(
                this,
                e.powerType === 'HEAL' ? 'heal' : e.powerType === 'GUARD' ? 'shield' : 'magic',
                p.x + 25,
                p.y + 40,
                80
              );
            }
            if (e.type === 'joker_activated')
              AudioSystem.playPower(e.color === 'red' ? 'RED_JOKER' : 'BLACK_JOKER');
          }
          this.tweens.add({ targets: this.chainText, scale: 1.12, duration: 90, yoyo: true });
          break;
        case 'draw':
          AudioSystem.play('card_draw');
          if (event.recycled) this.callout('STOCK RECYCLED', '#ffe3a4');
          break;
        case 'spawn':
          if (event.enemy.boss) this.callout('SUPERMONSTER!', '#ffce6e');
          break;
        case 'deploy': {
          const unit = castleManager().state!.siege.units.find((u) => u.id === event.id);
          if (unit) {
            const p = this.unitPosition(unit);
            playCombatVFX(this, 'smoke', p.x, p.y - 18, 60);
          }
          AudioSystem.play('shield', {
            volume: 0.18,
            pitchShift: event.kind === 'turret' ? 0.2 : 0,
          });
          break;
        }
        case 'shot':
          this.shot(event);
          break;
        case 'unit_killed': {
          const view = this.defenders.get(event.unit.id);
          if (!view) break;
          this.defenders.delete(event.unit.id);
          view.body?.play(`${event.unit.kind === 'knight' ? 'c_angel2' : 'c_angel1'}-dead`);
          this.tweens.add({
            targets: view.root,
            alpha: 0,
            duration: 400,
            onComplete: () => view.root.destroy(),
          });
          break;
        }
        case 'killed': {
          const view = this.invaders.get(event.enemy.id);
          if (!view) break;
          this.invaders.delete(event.enemy.id);
          view.hp.destroy();
          view.label.destroy();
          view.body.play(`${event.enemy.sprite}-dead`);
          this.tweens.add({
            targets: view.root,
            alpha: 0,
            y: view.root.y + 8,
            duration: 520,
            onComplete: () => view.root.destroy(),
          });
          playCombatVFX(this, 'reward', view.root.x, view.root.y - 24, 48);
          this.number(view.root.x, view.root.y - 40, event.enemy.boss ? '+5' : '+1', '#ffe35a');
          break;
        }
        case 'castle_hit':
          this.actorAnimation(event.enemy, 'attack');
          if (event.damage > 0) {
            AudioSystem.play('player_hit', { volume: 0.35 });
            this.number(this.castle.x, this.castle.y - 70, `−${event.damage}`, '#ff6b84');
            if (!isShakeReduced()) this.cameras.main.shake(130, 0.003);
          } else {
            AudioSystem.play('shield', { volume: 0.18 });
            playCombatVFX(this, 'shield', this.castle.x - 25, this.castle.y - 40, 65);
          }
          break;
        case 'laser':
          this.laserEffect(event.final);
          break;
        case 'ended':
          this.endPopup();
          break;
      }
  }
  private shot(event: Extract<SiegeEvent, { type: 'shot' }>): void {
    const unit = this.defenders.get(event.unit),
      enemy = this.invaders.get(event.target);
    if (!unit || !enemy) return;
    const x = unit.root.x,
      y = unit.root.y - 20,
      tx = enemy.root.x,
      ty = enemy.root.y - 23;
    this.actorAnimation(event.target, 'hurt');
    if (unit.body) {
      const sprite = event.kind === 'knight' ? 'c_angel2' : 'c_angel1';
      unit.body.play(`${sprite}-attack`, true);
      unit.body.once('animationcomplete', () => {
        if (unit.body?.active) unit.body.play(`${sprite}-idle`);
      });
    }
    if (event.kind === 'soldier' || event.kind === 'knight')
      playCombatVFX(this, 'slash', tx, ty, 44, 0xaffaff);
    else {
      const projectile = this.add
        .circle(
          x,
          y,
          event.kind === 'mortar' ? 5 : 2,
          event.kind === 'mortar' ? 0x94efff : 0xffe579
        )
        .setDepth(100);
      this.tweens.add({
        targets: projectile,
        x: tx,
        y: ty,
        duration: event.kind === 'mortar' ? 250 : 100,
        onComplete: () => {
          projectile.destroy();
          playCombatVFX(
            this,
            event.kind === 'mortar' ? 'smoke' : 'slash',
            tx,
            ty,
            event.kind === 'mortar' ? 60 : 24
          );
        },
      });
    }
    if (this.time.now >= this.nextShotSound) {
      AudioSystem.play('enemy_hit', { volume: 0.09 });
      this.nextShotSound = this.time.now + 180;
    }
    if (event.kind !== 'turret') this.number(tx, ty - 8, String(event.damage), '#fff4d2');
  }
  private actorAnimation(id: number, action: 'attack' | 'hurt') {
    const view = this.invaders.get(id),
      enemy = castleManager().state!.siege.enemies.find((e) => e.id === id);
    if (!view || !enemy || view.body.anims.currentAnim?.key === `${enemy.sprite}-${action}`) return;
    view.body.play(`${enemy.sprite}-${action}`);
    view.body.once('animationcomplete', () => {
      if (this.invaders.get(id) === view) view.body.play(`${enemy.sprite}-idle`);
    });
  }
  private laserEffect(final: boolean): void {
    const { width: w } = viewport(this),
      y = this.groundY() - 32;
    const beam = this.add.graphics().setDepth(180);
    beam.lineStyle(24, 0x27cbea, 0.35).lineBetween(w * 0.9, y, -20, y);
    beam.lineStyle(10, 0x8cffff, 0.8).lineBetween(w * 0.9, y, -20, y);
    beam.lineStyle(3, 0xffffff).lineBetween(w * 0.9, y, -20, y);
    this.tweens.add({ targets: beam, alpha: 0, duration: 500, onComplete: () => beam.destroy() });
    playCombatVFX(this, 'magic', this.castle.x, this.castle.y - 78, 100, 0x77ffff);
    AudioSystem.playPower('BOMB');
    if (!isShakeReduced()) this.cameras.main.shake(170, 0.004);
    this.callout(final ? 'SOLITAIRE COMPLETE!' : 'LASER SWEEP!', '#a8ffff');
  }
  private number(x: number, y: number, value: string, color: string) {
    const text = this.text(x, y, value, 15, color).setStroke('#211631', 3).setDepth(190);
    this.tweens.add({
      targets: text,
      y: y - 22,
      alpha: 0,
      duration: 600,
      onComplete: () => text.destroy(),
    });
  }
  private callout(value: string, color: string) {
    const text = this.text(viewport(this).width / 2, this.layout.arenaTop + 22, value, 20, color)
      .setStroke('#211631', 5)
      .setDepth(190);
    this.tweens.add({
      targets: text,
      alpha: 0,
      y: text.y - 8,
      delay: 800,
      duration: 350,
      onComplete: () => text.destroy(),
    });
  }
  private bankAbandoned(): void {
    const manager = castleManager();
    if (!manager.state) return;
    manager.state.run = { ...manager.state.run, phase: 'defeat' };
    manager.save();
    manager.service.settle(manager.state);
  }
  private endPopup(): void {
    if (this.ended) return;
    this.ended = true;
    this.paused = true;
    const manager = castleManager(),
      state = manager.state!,
      won = state.run.phase === 'victory';
    const banked = manager.service.settle(state);
    manager.save();
    AudioSystem.setMusicScene(won ? 'victory' : 'defeat');
    AudioSystem.play(won ? 'victory' : 'defeat');
    const modal = gamePopup(
      this,
      won ? 'CASTLE SAVED!' : 'CASTLE FALLEN',
      won
        ? 'You completed the solitaire and broke the siege.'
        : 'Your defenders held the line. Build a stronger castle.',
      400
    );
    modal.root.setDepth(3000);
    modal.content.add(this.text(0, modal.top + 120, `${state.siege.kills} ENEMIES DEFEATED`, 21));
    modal.content.add(
      this.text(
        0,
        modal.top + 157,
        `+${earnedCoins(state)} COINS ${banked ? 'BANKED' : 'TO SAVE'}`,
        22,
        '#ffe35a'
      )
    );
    modal.content.add(
      this.text(
        0,
        modal.top + 190,
        `${Math.floor(state.siege.elapsed)}s · ${state.siege.spawned} invaders`,
        13,
        '#d9c8ed'
      )
    );
    popupButton(this, modal.content, 63, modal.width - 36, 'NEW SIEGE', () => {
      manager.start();
      this.scene.restart();
    });
    popupButton(
      this,
      modal.content,
      125,
      modal.width - 36,
      'CASTLE & WORKSHOP',
      () => this.scene.start('StartScene'),
      true
    );
  }
}
