import { getRenderDensity } from './viewport';
import Phaser from 'phaser';
import { gamePopup, popupButton } from './GamePopup';
const KEY = 'golf_rogue_rules_v2';
export function hasSeenRules(): boolean { try { return localStorage.getItem(KEY) === 'yes'; } catch { return false; } }

export function showRules(scene: Phaser.Scene, onClose?: () => void): void {
  const modal = gamePopup(scene, 'HOW TO FIGHT', 'ONE SOLITAIRE → MONSTERS → BOSS', 490);
  modal.root.setDepth(2000);
  const { content, width, top } = modal;
  const rules = [
    ['1 · TAKE AN OPEN CARD', 'Tap the bottom card of a column. Its rank must be ±1 from your active card.'],
    ['5 → 6 → 7 → 6', 'Build a chain to deal more damage. A ↔ K also works. WILD allows any next card. Gold outlines show valid moves.'],
    ['2 · DRAW / END TURN', 'Bank your damage and draw. A chain of 3+ cards stops the enemy; with 0–2 cards it acts.'],
    ['3 · FINISH THE SOLITAIRE', 'Enemies change; your cards stay. Clear all columns to face the boss with collected cards. Red joker heals 30%; black joker gives ×5 damage.'],
  ];
  rules.forEach(([title, text], i) => {
    content.add(scene.add.text(-width / 2 + 20, top + 108 + i * 77, title, { resolution: getRenderDensity(), fontFamily: 'Lilita One', fontSize: '17px', color: '#ffe35a' }));
    content.add(scene.add.text(-width / 2 + 20, top + 133 + i * 77, text, { resolution: getRenderDensity(), fontFamily: 'Fredoka', fontSize: '13px', color: '#f4e9ff', wordWrap: { width: width - 40 } }));
  });
  popupButton(scene, content, modal.height / 2 - 38, width - 40, 'GOT IT — LET’S PLAY', () => {
    try { localStorage.setItem(KEY, 'yes'); } catch { /* Private mode. */ }
    scene.tweens.add({ targets: modal.root, alpha: 0, duration: 150, onComplete: () => { modal.root.destroy(); onClose?.(); } });
  });
}
