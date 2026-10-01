/**
 * Rasterises the brand mark into the PNG sizes the web manifest, Apple touch
 * icon and Open Graph tag need.
 *
 * Run after editing public/logo.svg:
 *   node scripts/build-icons.mjs
 *
 * Kept as a build step rather than committed binaries so the mark has exactly
 * one source of truth. Checked-in PNGs would silently drift from the SVG the
 * way duplicated design files always do.
 */
import { readFile, mkdir, stat } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = join(root, 'public');

/** Square app icons. */
const ICON_SIZES = [
  { file: 'apple-touch-icon.png', size: 180, opaque: true },
  { file: 'icon-192.png', size: 192, opaque: true },
  { file: 'icon-512.png', size: 512, opaque: true },
];

/**
 * Open Graph image, 1200x630.
 *
 * This is the preview that appears when the site is shared in a chat or on
 * social, and on a cluttered search result page it is often the only thing
 * anyone reads. So it carries the two facts that matter: the flat rate, and
 * that the call-out is free.
 *
 * Authored as SVG and flattened by sharp rather than designed in a graphics app
 * so it stays in version control as reviewable text.
 */
export const OG_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0f3d7d"/>
      <stop offset="0.55" stop-color="#146dd5"/>
      <stop offset="1" stop-color="#0097cf"/>
    </linearGradient>
    <linearGradient id="mark" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="1" stop-color="#cfe4ff"/>
    </linearGradient>
  </defs>

  <rect width="1200" height="630" fill="url(#bg)"/>
  <!-- soft depth so the flat colour does not band on large displays -->
  <circle cx="1080" cy="120" r="260" fill="#ffffff" opacity="0.06"/>
  <circle cx="90" cy="560" r="220" fill="#ffffff" opacity="0.05"/>

  <g transform="translate(80 78)">
    <rect width="86" height="86" rx="20" fill="url(#mark)"/>
    <g transform="translate(19 18) scale(1.28)">
      <rect x="8" y="11" width="24" height="15" rx="2.5" fill="none" stroke="#146dd5" stroke-width="2.4"/>
      <path d="M15 31h10" stroke="#146dd5" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M13.6 24.2a3.2 3.2 0 0 0 4.5 0l4-4a3.6 3.6 0 0 0 .2-5.1l-2 2-2-.4-.4-2 2-2a3.6 3.6 0 0 0-5.1.2z" fill="#146dd5"/>
    </g>
  </g>

  <text x="190" y="122" font-family="Segoe UI, Arial, Helvetica, sans-serif"
        font-size="30" font-weight="600" fill="#ffffff" opacity="0.92">Fix My Home Computer</text>
  <text x="190" y="160" font-family="Segoe UI, Arial, Helvetica, sans-serif"
        font-size="22" font-weight="400" fill="#ffffff" opacity="0.75">Brisbane &#183; 7 days &#183; no surcharge</text>

  <text x="80" y="330" font-family="Segoe UI, Arial, Helvetica, sans-serif"
        font-size="86" font-weight="800" fill="#ffffff">Computer repairs</text>
  <text x="80" y="424" font-family="Segoe UI, Arial, Helvetica, sans-serif"
        font-size="86" font-weight="800" fill="#ffffff">in Brisbane.</text>

  <text x="80" y="510" font-family="Segoe UI, Arial, Helvetica, sans-serif"
        font-size="44" font-weight="700" fill="#9ee6ff">$150 flat rate &#183; $0 call-out</text>

  <text x="80" y="566" font-family="Segoe UI, Arial, Helvetica, sans-serif"
        font-size="26" font-weight="400" fill="#ffffff" opacity="0.8">Same price to Aspley, Burleigh Heads and Woombye.</text>
</svg>`;

async function main() {
  await mkdir(publicDir, { recursive: true });
  const logo = await readFile(join(publicDir, 'logo.svg'), 'utf8');

  for (const { file, size, opaque } of ICON_SIZES) {
    // Apple refuses to round-mask its touch icon and will composite it onto
    // black, so that one gets a solid background rather than transparency.
    let pipeline = sharp(Buffer.from(logo)).resize(size, size);
    if (opaque) pipeline = pipeline.flatten({ background: '#146dd5' });

    await pipeline
      .png({ compressionLevel: 9, palette: false })
      .toFile(join(publicDir, file));

    console.log(`  ${file}  ${size}x${size}`);
  }

  await mkdir(join(publicDir, 'og'), { recursive: true });
  const ogPath = join(publicDir, 'og', 'default.png');

  /**
   * Note the absence of a `quality` option here. That is deliberate and it cost
   * an hour to work out: on PNG output sharp/libvips treats `quality` as a
   * request for *palette quantisation*, not as lossy compression. Passing
   * `quality: 92` silently flattened the 7,445-colour render down to 65 - the
   * file still looked like a valid PNG, still had the right dimensions, and
   * still contained no text at all. `effort`/`compressionLevel` are the real
   * PNG knobs; `quality` is a JPEG concept and does not belong on a PNG.
   */
  await sharp(Buffer.from(OG_SVG))
    .png({ compressionLevel: 9, effort: 10, palette: false })
    .toFile(ogPath);

  const ogCheck = await assertTextRendered(ogPath, 'OG image');
  const { size } = await stat(ogPath);
  console.log(
    `  og/default.png  1200x630  ${(size / 1024).toFixed(0)} KB  ${ogCheck.colours} colours`,
  );

  console.log('\nDone. Icon files are in public/.');
}

/**
 * Guards against the class of failure above: a PNG that encodes successfully
 * but has quietly lost its content.
 *
 * There is no way to tell a blank OG image from a correct one by checking that
 * the build succeeded or that the file is a valid PNG of the right size - both
 * were true while every glyph was missing. The reliable signal is colour
 * variance: rendered text antialiases, so a real render produces thousands of
 * distinct colours, whereas a silently-broken one collapses to a handful.
 *
 * @param {string} file
 * @param {string} label
 */
async function assertTextRendered(file, label) {
  const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });

  const seen = new Set();
  for (let i = 0; i < data.length; i += info.channels) {
    seen.add((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]);
  }

  // Flat gradient with no glyphs lands around 60-100 colours. Anything with
  // text on it is in the thousands. 1000 is a safe midpoint.
  if (seen.size < 1000) {
    throw new Error(
      `${label} (${file}) rasterised to only ${seen.size} unique colours, which means the ` +
        `text layer did not render. This is the failure mode where sharp silently drops ` +
        `fonts - check that the font-family in the SVG resolves on this machine, and that no ` +
        `palette/quality option has crept into the .png() call.`,
    );
  }

  return { colours: seen.size };
}

// Only build when run directly, so this module can be imported for testing.
// Compared as file URLs because on Windows import.meta.url is "file:///C:/..."
// while process.argv[1] is "C:\...", so a string comparison never matches.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}
