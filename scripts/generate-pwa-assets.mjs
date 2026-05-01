import fs from "fs";
import path from "path";
import sharp from "sharp";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const svgPath = path.join(root, "public", "logo-mark.svg");

async function main() {
  const svg = fs.readFileSync(svgPath);
  const iconsDir = path.join(root, "public", "icons");
  fs.mkdirSync(iconsDir, { recursive: true });

  await sharp(svg).resize(192, 192).png().toFile(path.join(iconsDir, "icon-192.png"));
  await sharp(svg).resize(512, 512).png().toFile(path.join(iconsDir, "icon-512.png"));
  await sharp(svg).resize(180, 180).png().toFile(path.join(iconsDir, "apple-touch-icon.png"));

  const logo256 = await sharp(svg).resize(256, 256).png().toBuffer();
  await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 245, g: 241, b: 233, alpha: 1 },
    },
  })
    .composite([{ input: logo256, gravity: "center" }])
    .png()
    .toFile(path.join(iconsDir, "maskable-512.png"));

  const splashDir = path.join(root, "public", "splash");
  fs.mkdirSync(splashDir, { recursive: true });
  const logoSplash = await sharp(svg).resize(320, 320).png().toBuffer();
  await sharp({
    create: {
      width: 1170,
      height: 2532,
      channels: 4,
      background: { r: 245, g: 241, b: 233, alpha: 1 },
    },
  })
    .composite([{ input: logoSplash, gravity: "center" }])
    .png()
    .toFile(path.join(splashDir, "apple-splash.png"));

  console.log("PWA ikonları ve splash üretildi: public/icons, public/splash");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
