import Phaser from 'phaser';
import { gamePopup, popupButton } from './GamePopup';
const KEY = 'golf_rogue_rules_v1';
export function hasSeenRules(): boolean { try { return localStorage.getItem(KEY) === 'yes'; } catch { return false; } }

export function showRules(scene: Phaser.Scene, onClose?: () => void): void {
  const modal = gamePopup(scene, 'HOW TO FIGHT', 'Golf Solitaire turns into monster combat.', 490);
  modal.root.setDepth(2000);
  const { content, width, top } = modal;
  const rules = [
    ['1 · TAKE AN OPEN CARD', 'Tap the bottom card of a column. Its rank must be ±1 from your active card.'],
    ['5 → 6 → 7 → 6', 'Build a chain to deal more damage. A ↔ K also works. WILD allows any next card. Gold outlines show valid moves.'],
    ['2 · DRAW / END TURN', 'Bank your damage and draw. A chain of 3+ cards stops the enemy; with 0–2 cards it acts.'],
    ['3 · JOKERS', 'Red joker: 30% lifesteal, red cards next. Black joker: ×5 chain damage, black cards next. Jokers connect to each other.'],
  ];
  rules.forEach(([title, text], i) => {
    content.add(scene.add.text(-width / 2 + 20, top + 108 + i * 77, title, { fontFamily: 'Lilita One', fontSize: '17px', color: '#ffe35a' }));
    content.add(scene.add.text(-width / 2 + 20, top + 133 + i * 77, text, { fontFamily: 'Fredoka', fontSize: '13px', color: '#f4e9ff', wordWrap: { width: width - 40 } }));
  });
  popupButton(scene, content, modal.height / 2 - 38, width - 40, 'GOT IT — LET’S PLAY', () => {
    try { localStorage.setItem(KEY, 'yes'); } catch { /* Private mode. */ }
    scene.tweens.add({ targets: modal.root, alpha: 0, duration: 150, onComplete: () => { modal.root.destroy(); onClose?.(); } });
  });
}
