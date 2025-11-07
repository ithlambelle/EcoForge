// generate-icons.js - creates placeholder icons for the extension
// run with: node generate-icons.js

const fs = require('fs');
const path = require('path');

// simple base64 encoded 1x1 transparent PNG as fallback
// we'll create actual icons using canvas if available, otherwise use placeholders

function createPlaceholderIcon(size) {
  // create a simple SVG that we can convert, or use a data URI
  // for now, create a minimal valid PNG using a simple approach
  
  // minimal 16x16 PNG (1x1 pixel, scaled concept)
  // this is a very basic approach - in production use proper image generation
  
  console.log(`creating placeholder for icon${size}.png...`);
  
  // create a simple colored square as placeholder
  // we'll use a simple approach: create an SVG and note that user should replace it
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#grad)" rx="${size * 0.2}"/>
  <circle cx="${size/2}" cy="${size/2 - size*0.1}" r="${size*0.3}" fill="rgba(255,255,255,0.9)"/>
  <text x="${size/2}" y="${size/2 + size*0.15}" font-family="Arial" font-size="${size*0.4}" font-weight="bold" fill="#667eea" text-anchor="middle">W</text>
</svg>`;
  
  const svgPath = path.join(__dirname, 'icons', `icon${size}.svg`);
  fs.writeFileSync(svgPath, svg);
  console.log(`✓ created icon${size}.svg`);
  
  return svgPath;
}

// check if sharp or canvas is available for PNG generation
try {
  // try to use sharp if available
  const sharp = require('sharp');
  
  async function createPNGIcons() {
    const sizes = [16, 48, 128];
    const iconsDir = path.join(__dirname, 'icons');
    
    if (!fs.existsSync(iconsDir)) {
      fs.mkdirSync(iconsDir, { recursive: true });
    }
    
    for (const size of sizes) {
      const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad${size}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#grad${size})" rx="${size * 0.2}"/>
  <circle cx="${size/2}" cy="${size/2 - size*0.1}" r="${size*0.3}" fill="rgba(255,255,255,0.9)"/>
  <text x="${size/2}" y="${size/2 + size*0.15}" font-family="Arial" font-size="${size*0.4}" font-weight="bold" fill="#667eea" text-anchor="middle">W</text>
</svg>`;
      
      const pngPath = path.join(iconsDir, `icon${size}.png`);
      await sharp(Buffer.from(svg))
        .png()
        .toFile(pngPath);
      console.log(`✓ created icon${size}.png`);
    }
    
    console.log('\n✓ all icons created successfully!');
  }
  
  createPNGIcons().catch(() => {
    console.log('sharp not available, creating SVG placeholders instead');
    console.log('please convert SVGs to PNGs or use create-icons.html in browser');
    [16, 48, 128].forEach(createPlaceholderIcon);
  });
  
} catch (e) {
  // sharp not available, create SVG placeholders
  console.log('creating SVG placeholders (convert to PNG using create-icons.html)');
  const iconsDir = path.join(__dirname, 'icons');
  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
  }
  [16, 48, 128].forEach(createPlaceholderIcon);
  console.log('\n⚠️  PNG icons not created. Please:');
  console.log('   1. Open create-icons.html in your browser');
  console.log('   2. Download the PNG icons');
  console.log('   3. Place them in the icons/ folder');
}

