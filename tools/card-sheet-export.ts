import Phaser from 'phaser';
import { CardVisual } from '../src/presentation/design/CardVisual';
import { loadFonts } from '../src/presentation/design/fontLoader';
import { setRenderDensity } from '../src/presentation/design/viewport';
import { getCardMetrics, applyConfiguredColors } from '../src/presentation/design/tokens';
import { loadAssetConfig } from '../src/configurator/runtime';
import type { Card, PowerType, Suit } from '../src/core/types';

const cellWidth = 256;
const cellHeight = 416;
const inset = 16;
const cardWidth = 224;
const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const suits: Suit[] = ['spades', 'hearts', 'clubs', 'diamonds'];

await loadAssetConfig();
applyConfiguredColors();
await loadFonts();
setRenderDensity(1);

class ExportScene extends Phaser.Scene {
  create() {
    const scene = this;
    const metrics = getCardMetrics(390, 844);
    const sharpText = (object: Phaser.GameObjects.GameObject) => {
      if (object instanceof Phaser.GameObjects.Text) object.setResolution(5);
      if (object instanceof Phaser.GameObjects.Container) object.list.forEach(sharpText);
    };
    const render = async (cards: { card: Card; power?: PowerType }[], columns: number, rows: number) => {
      const texture = scene.add.renderTexture(0, 0, columns * cellWidth, rows * cellHeight);
      const visuals = cards.map(({ card, power }, index) => {
        const visual = new CardVisual(scene, 0, 0, card, power ?? null);
        const container = visual.getContainer();
        sharpText(container);
        container.setScale(cardWidth / metrics.cw);
        container.setPosition((index % columns) * cellWidth + inset,
          Math.floor(index / columns) * cellHeight + inset);
        texture.draw(container);
        return visual;
      });
      const data = await new Promise<string>((resolve) => {
        texture.snapshot((image) => resolve((image as HTMLImageElement).src));
      });
      visuals.forEach((visual) => visual.destroy());
      texture.destroy();
      return data;
    };
    const validateHeaders = () => {
      const checks: Record<string, unknown>[] = [];
      for (const power of [null, 'WILD', 'ECHO', 'BOMB'] as const) {
        for (const rank of [1, 10, 11, 12, 13]) {
          const visual = new CardVisual(scene, 0, 0, { id: 'qa', rank, suit: 'spades' }, power);
          const texts = visual.getContainer().list.filter(
            (object): object is Phaser.GameObjects.Text => object instanceof Phaser.GameObjects.Text
          );
          const [value, suit] = texts;
          const right = suit.x + suit.displayWidth;
          const limit = metrics.cw * (power ? 0.67 : 0.96);
          if (!suit.visible || suit.x <= value.x + value.displayWidth || right > limit) {
            throw new Error(`Header overlaps on ${rank} ${power ?? 'normal'}: ${right}/${limit}`);
          }
          checks.push({ rank, power, suitSize: suit.style.fontSize,
            scale: suit.scaleX, right, limit });
          visual.destroy();
        }
      }
      return checks;
    };
    const renderMobilePreview = async () => {
      const texture = scene.add.renderTexture(0, 0, 390, 286);
      const sampleRanks = [9, 12, 7, 7, 10, 12, 7, 2, 4, 6, 4, 5, 1, 4,
        4, 13, 3, 1, 3, 9, 10, 5, 3, 5, 11, 13, 8, 1, 6, 13, 12, 11, 10, 8, 3];
      const sampleSuits: Suit[] = ['clubs', 'diamonds', 'hearts', 'diamonds', 'clubs', 'clubs', 'spades',
        'diamonds', 'spades', 'hearts', 'diamonds', 'spades', 'diamonds', 'hearts',
        'clubs', 'spades', 'diamonds', 'clubs', 'clubs', 'hearts', 'spades',
        'clubs', 'spades', 'diamonds', 'hearts', 'diamonds', 'spades', 'spades',
        'clubs', 'hearts', 'spades', 'diamonds', 'hearts', 'clubs', 'hearts'];
      const visuals = sampleRanks.map((rank, index) => {
        const visual = new CardVisual(scene, 10 + (index % 7) * 53,
          10 + Math.floor(index / 7) * 45,
          { id: `sample-${index}`, rank, suit: sampleSuits[index] }, index === 33 ? 'WILD' : null);
        if (index === 28) visual.setState('playable');
        sharpText(visual.getContainer());
        texture.draw(visual.getContainer());
        return visual;
      });
      const data = await new Promise<string>((resolve) =>
        texture.snapshot((image) => resolve((image as HTMLImageElement).src)));
      visuals.forEach((visual) => visual.destroy());
      texture.destroy();
      return data;
    };
    Object.assign(window, {
      cardSheetExport: {
        async run() {
          const headerChecks = validateHeaders();
          const files: Record<string, string> = {};
          const frames: Record<string, unknown> = {};
          for (const suit of suits) {
            files[`${suit}.png`] = await render(ranks.map((_, index) => ({
              card: { id: `${suit}-${ranks[index]}`, rank: index + 1, suit },
            })), 4, 4);
            frames[suit] = ranks.map((rank, index) => ({
              name: `${rank}-${suit}`,
              frame: { x: (index % 4) * cellWidth, y: Math.floor(index / 4) * cellHeight,
                w: cellWidth, h: cellHeight },
            }));
          }
          for (const joker of ['black', 'red'] as const) {
            files[`joker-${joker}.png`] = await render([{ card: {
              id: `joker-${joker}`, rank: 1, suit: joker === 'red' ? 'hearts' : 'spades', joker,
            } }], 1, 1);
          }
          files['powers-preview.png'] = await render(
            (['WILD', 'ECHO', 'BOMB'] as const).map((power) => ({
              card: { id: power, rank: 10, suit: 'clubs' }, power,
            })), 3, 1);
          files['mobile-preview.png'] = await renderMobilePreview();
          return { files, manifest: { cardCount: 54, columns: 4, rows: 4,
            cellWidth, cellHeight, rankOrder: ranks, frames,
            cardBounds: { x: inset, y: inset, width: cardWidth,
              height: Number((metrics.ch * cardWidth / metrics.cw).toFixed(2)) },
            anchor: { x: inset, y: inset }, headerChecks } };
        },
      },
    });
  }
}

new Phaser.Game({ type: Phaser.WEBGL, width: 390, height: 844, transparent: true,
  audio: { noAudio: true }, render: { antialias: true, roundPixels: false },
  scene: [ExportScene], parent: 'export-canvas' });
