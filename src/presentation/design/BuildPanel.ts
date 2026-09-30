import Phaser from 'phaser';
import type { Relic } from '../../core/types';
import { relicIcon } from './relicInfo';

/** Readable, paged collection; never covers live input without blocking the board. */
export function showBuildPanel(scene: Phaser.Scene, relics: Relic[], onClose: () => void): Phaser.GameObjects.Container {
  const width = scene.scale.width;
  const height = scene.scale.height;
  const container = scene.add.container(0, 0).setDepth(300);
  const overlay = scene.add.rectangle(width / 2, height / 2, width, height, 0x100a22, 0.9).setInteractive();
  container.add(overlay);
  const panelWidth = Math.min(width - 28, 380);
  const panelHeight = Math.min(height - 40, 520);
  const left = (width - panelWidth) / 2;
  const top = (height - panelHeight) / 2;
  const bg = scene.add.rectangle(width / 2, height / 2, panelWidth, panelHeight, 0x2b1c48).setStrokeStyle(2, 0xab83e0);
  container.add(bg);
  container.add(scene.add.text(width / 2, top + 25, 'YOUR BUILD', { fontFamily: 'Lilita One', fontSize: '24px', color: '#ffe1a0' }).setOrigin(0.5));
  let page = 0;
  const pageSize = Math.max(1, Math.floor((panelHeight - 130) / 58));
  let rows: Phaser.GameObjects.Container | null = null;
  const pages = Math.max(1, Math.ceil(relics.length / pageSize));
  const draw = () => {
    rows?.destroy();
    rows = scene.add.container(0, 0);
    container.add(rows);
    if (!relics.length) rows.add(scene.add.text(width / 2, top + 90, 'Choose relics after victories.\nTheir effects last for this run.', {
      fontFamily: 'Fredoka', fontSize: '15px', color: '#ddd1ed', align: 'center',
    }).setOrigin(0.5, 0));
    relics.slice(page * pageSize, (page + 1) * pageSize).forEach((relic, i) => {
      const y = top + 64 + i * 58;
      rows!.add(scene.add.text(left + 12, y + 12, relicIcon(relic), { fontFamily: 'Lilita One', fontSize: '22px', color: '#ffe1a0' }));
      rows!.add(scene.add.text(left + 52, y, relic.name, { fontFamily: 'Fredoka', fontSize: '14px', fontStyle: 'bold', color: '#ffffff' }));
      rows!.add(scene.add.text(left + 52, y + 20, relic.description, { fontFamily: 'Fredoka', fontSize: '12px', color: '#d3c4e7', wordWrap: { width: panelWidth - 68 } }));
    });
    rows.add(scene.add.text(width / 2, top + panelHeight - 63, `${page + 1} / ${pages}`, { fontFamily: 'Fredoka', fontSize: '13px', color: '#ba9dde' }).setOrigin(0.5));
  };
  const button = (x: number, text: string, callback: () => void) => {
    const box = scene.add.rectangle(x, top + panelHeight - 30, 88, 38, 0x65439c).setInteractive();
    box.on('pointerup', callback);
    container.add([box, scene.add.text(x, box.y, text, { fontFamily: 'Fredoka', fontSize: '14px', color: '#fff' }).setOrigin(0.5)]);
  };
  button(width / 2 - 100, 'PREV', () => { page = (page + pages - 1) % pages; draw(); });
  button(width / 2, 'CLOSE', () => { container.destroy(); onClose(); });
  button(width / 2 + 100, 'NEXT', () => { page = (page + 1) % pages; draw(); });
  draw();
  return container;
}
