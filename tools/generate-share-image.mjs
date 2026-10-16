import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'fs';

// Create a 1200x630 share image from the menu artwork
async function generateShareImage() {
  const width = 1200;
  const height = 630;
  
  // Load and resize the menu-wide image to fit
  const menuImage = await sharp('public/assets/menu-story-v1/menu-wide.png')
    .resize(width, height, { fit: 'cover', position: 'center' })
    .toBuffer();
  
  // Create overlay with title text (using SVG for text rendering)
  const overlay = `
    <svg width="${width}" height="${height}">
      <defs>
        <linearGradient id="textGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#FFE55C"/>
          <stop offset="50%" style="stop-color:#FFC21A"/>
          <stop offset="100%" style="stop-color:#E08600"/>
        </linearGradient>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#1B1030" flood-opacity="0.8"/>
        </filter>
        <linearGradient id="btnGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#FFE55C"/>
          <stop offset="50%" style="stop-color:#FFC21A"/>
          <stop offset="100%" style="stop-color:#E08600"/>
        </linearGradient>
      </defs>
      <!-- Semi-transparent overlay for text legibility -->
      <rect x="0" y="0" width="${width}" height="${height}" fill="rgba(20,38,56,0.55)"/>
      <!-- Title -->
      <text x="${width/2}" y="200" font-family="Arial Black, sans-serif" font-size="72" 
            fill="#fff1b3" text-anchor="middle" font-weight="bold" filter="url(#shadow)">CASTLE</text>
      <text x="${width/2}" y="290" font-family="Arial Black, sans-serif" font-size="84" 
            fill="url(#textGrad)" text-anchor="middle" font-weight="bold" filter="url(#shadow)">SOLITAIRE</text>
      <!-- Tagline -->
      <text x="${width/2}" y="370" font-family="Arial, sans-serif" font-size="28" 
            fill="#a2cbdc" text-anchor="middle">Build chains. Deploy defenders. Protect your castle.</text>
      <!-- CTA Button -->
      <rect x="${width/2 - 120}" y="440" width="240" height="60" rx="14" 
            fill="url(#btnGrad)" stroke="#1B1030" stroke-width="4"/>
      <text x="${width/2}" y="482" font-family="Arial Black, sans-serif" font-size="28" 
            fill="#1B1030" text-anchor="middle" font-weight="bold">PLAY FREE</text>
    </svg>
  `;
  
  // Composite the overlay onto the image
  const result = await sharp(menuImage)
    .composite([{
      input: Buffer.from(overlay),
      top: 0,
      left: 0,
    }])
    .png()
    .toBuffer();
  
  writeFileSync('public/share-image.png', result);
  console.log('Created share-image.png (1200x630)');
}

generateShareImage().catch(console.error);
