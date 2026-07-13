const { Jimp } = require('jimp');
const path = require('path');

const imagesToProcess = [
  {
    input: "C:\\Users\\user\\.gemini\\antigravity\\brain\\882b5835-b94f-4053-aaee-4c482ccf2b30\\carousel_liquor_white_1783950888562.png",
    output: "E:\\Ghumti Express\\public\\carousel_liquor.png"
  },
  {
    input: "C:\\Users\\user\\.gemini\\antigravity\\brain\\882b5835-b94f-4053-aaee-4c482ccf2b30\\carousel_coffee_white_1783950911837.png",
    output: "E:\\Ghumti Express\\public\\carousel_coffee.png"
  },
  {
    input: "C:\\Users\\user\\.gemini\\antigravity\\brain\\882b5835-b94f-4053-aaee-4c482ccf2b30\\carousel_grocery_white_1783950928472.png",
    output: "E:\\Ghumti Express\\public\\carousel_grocery.png"
  }
];

async function removeBackground(inputPath, outputPath) {
  const image = await Jimp.read(inputPath);
  
  // Scan all pixels
  image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
    const r = this.bitmap.data[idx + 0];
    const g = this.bitmap.data[idx + 1];
    const b = this.bitmap.data[idx + 2];
    
    // Calculate distance from white (255, 255, 255)
    const rDiff = 255 - r;
    const gDiff = 255 - g;
    const bDiff = 255 - b;
    const distance = Math.sqrt(rDiff * rDiff + gDiff * gDiff + bDiff * bDiff);
    
    // We adjust thresholds to accommodate lighting variations near edges
    const thresholdLow = 15;
    const thresholdHigh = 60;
    
    if (distance < thresholdLow) {
      this.bitmap.data[idx + 3] = 0; // fully transparent
    } else if (distance < thresholdHigh) {
      // Linear interpolation of transparency
      const fraction = (distance - thresholdLow) / (thresholdHigh - thresholdLow);
      const newAlpha = Math.round(fraction * 255);
      if (newAlpha < this.bitmap.data[idx + 3]) {
        this.bitmap.data[idx + 3] = newAlpha;
      }
    }
  });
  
  await image.write(outputPath);
  console.log(`Processed: ${path.basename(inputPath)} -> ${path.basename(outputPath)}`);
}

async function run() {
  for (const img of imagesToProcess) {
    try {
      await removeBackground(img.input, img.output);
    } catch (e) {
      console.error(`Error processing ${img.input}:`, e);
    }
  }
}

run();
