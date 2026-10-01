/**
 * Generates src/data/suburbs.json - the master suburb dataset.
 *
 * Inputs (produced by scripts/scrape-legacy.mjs into .migration/):
 *   .migration/suburb-rows.txt  pipe-delimited: family|suburbKey|postcode|oldSlug
 *   .migration/qld-postcodes.csv  Postcode,Suburb,State,Lat,Lon
 *
 * Output: src/data/suburbs.json - one record per suburb with the set of
 * legacy slugs that pointed at it, so the redirect map can be generated.
 *
 * Run: node scripts/build-suburbs.mjs
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mig = path.join(root, '.migration');

/** Slug fixes for localities whose legacy slug is not a clean suburb name. */
const SLUG_OVERRIDES = {
  'berrinba-lc': { name: 'Berrinba', region: 'Lockyer Valley' },
  'wights-mountain': { name: 'Wights Mountain', postcode: '4305' },
  'cedar-creek': { name: 'Cedar Creek' },
  'summerset': { name: 'Summerset' },
  'upper-brookfield-2': { name: 'Upper Brookfield' },
  'chuwar-ui': { name: 'Chuwar' },
  'chuwar-qld-4306-2': { name: 'Chuwar' },
  'sinnamon-park-qld-4073-2': { name: 'Sinnamon Park' },
  'pacific-pines-2': { name: 'Pacific Pines' },
  'surfers-paradise-2': { name: 'Surfers Paradise' },
  'surfers-paradise-3': { name: 'Surfers Paradise' },
  'cedar-creek-2': { name: 'Cedar Creek' },
  'ridgewood-2': { name: 'Ridgewood' },
};

/**
 * The business advertises Brisbane, Logan and Ipswich. Suburbs are grouped into
 * those service rings (plus the wider reaches the legacy site also targeted) so
 * the /service-area/ index stays scannable.
 *
 * Grouping is by postcode, taken from the ABS-derived postcode reference rather
 * than hardcoded heuristics: Brisbane's 42xx band interleaves Logan and the Gold
 * Coast (4205 Logan vs 4209 Gold Coast), and centroid methods mis-assign
 * boundary suburbs such as Redland Bay.
 */
const REGION_POSTCODES = {
  'Brisbane Inner City': [4000, 4001, 4005, 4006, 4059, 4060, 4064, 4065, 4066, 4067, 4101, 4102, 4103, 4104, 4105, 4106, 4107, 4120, 4121, 4151, 4152, 4169, 4170, 4171],
  'Brisbane North': [4007, 4008, 4009, 4010, 4011, 4012, 4013, 4014, 4030, 4031, 4032, 4034, 4035, 4036, 4037, 4051, 4053, 4054, 4055],
  'Brisbane West': [4061, 4068, 4069, 4070, 4072, 4073, 4074, 4075, 4076, 4077, 4078],
  'Brisbane South': [4108, 4109, 4110, 4111, 4112, 4113, 4115, 4116, 4119, 4122, 4123, 4155, 4156, 4172, 4173, 4174, 4178, 4179],
  Redland: [4153, 4154, 4157, 4158, 4159, 4160, 4161, 4163, 4164, 4165],
  'Moreton Bay & Redcliffe': [4017, 4018, 4019, 4020, 4021, 4022, 4025, 4500, 4501, 4502, 4503, 4504, 4505, 4506, 4507, 4508, 4509, 4510, 4511, 4512, 4514, 4516, 4517, 4518, 4519, 4520, 4521],
  'Ipswich & West Moreton': [4114, 4117, 4118, 4124, 4125, 4127, 4128, 4129, 4130, 4131, 4132, 4133, 4300, 4301, 4303, 4304, 4305, 4306, 4307, 4340, 4346],
  'Logan & Beaudesert': [4205, 4207, 4208, 4280, 4285],
  'Gold Coast': [4209, 4210, 4211, 4212, 4213, 4214, 4215, 4216, 4217, 4218, 4220, 4221, 4223, 4224, 4225, 4226, 4227, 4228, 4270],
  Sunshine: [4550, 4551, 4552, 4553, 4554, 4555, 4556, 4557, 4558, 4559, 4560, 4561, 4562, 4563, 4564, 4565, 4566, 4567, 4568, 4569, 4570, 4571, 4572, 4573, 4574, 4575],
  'Stradbroke & Islands': [4183, 4184],
};

const POSTCODE_TO_REGION = new Map();
for (const [region, codes] of Object.entries(REGION_POSTCODES)) {
  for (const code of codes) POSTCODE_TO_REGION.set(code, region);
}

/**
 * Suburbs the ABS reference does not carry (delisted localities, PO-box-only
 * names, or names that appear only in the legacy slugs). Values here are
 * best-known and flagged `needsReview` so they get checked before launch.
 */
const POSTCODE_OVERRIDES = {
  buddine: '4570',
  'harper-creek': '4020',
  'noosa-national-park': '4565',
  'sinnamon-park-west': '4073',
  'southern-moreton-bay-islands': '4025',
  teewah: '4565',
};

/**
 * Guard against bad coordinates in the reference data - e.g. it places
 * Chandler (4155) in North Queensland rather than Mansfield. Anything outside
 * the serviced bounding box has its coordinates dropped rather than emitting a
 * geo in the wrong state.
 */
const BBOX = { minLat: -28.5, maxLat: -26.1, minLon: 152.3, maxLon: 153.8 };

/**
 * Coordinates the reference data gets wrong in ways a bounding-box check
 * cannot catch. `brisbane` (4001) is the metro-wide page - the reference
 * places it outside the city, so it gets the CBD centroid instead.
 */
const COORD_OVERRIDES = {
  brisbane: { lat: -27.4698, lon: 153.0251 },
};

function inServiceArea(lat, lon) {
  return (
    lat >= BBOX.minLat && lat <= BBOX.maxLat && lon >= BBOX.minLon && lon <= BBOX.maxLon
  );
}

function regionFor(postcode) {
  if (!postcode) return 'Brisbane & Greater Brisbane';
  return POSTCODE_TO_REGION.get(Number(postcode)) ?? 'Brisbane & Greater Brisbane';
}

function titleCase(slug) {
  return slug
    .split('-')
    .map((w) => (['qld', 'northeast', 'dc', 'mc'].includes(w) ? w : w[0].toUpperCase() + w.slice(1)))
    .join(' ');
}

/** Normalise a legacy slug fragment to a lookup key for the postcode CSV. */
function normaliseForLookup(s) {
  return s.replace(/-qld$/, '').toUpperCase().replace(/[^A-Z0-9 ]/g, '');
}

async function loadQldPostcodes() {
  const csvPath = path.join(mig, 'qld-postcodes.csv');
  if (!existsSync(csvPath)) {
    throw new Error(`Missing ${csvPath}. Run scripts/scrape-legacy.mjs first.`);
  }
  const raw = await readFile(csvPath, 'utf8');
  const lines = raw.split(/\r?\n/).slice(1).filter(Boolean);
  const rows = [];
  for (const line of lines) {
    const [postcode, suburb, state, lat, lon] = line.split(',');
    if (!postcode || !suburb || state !== 'QLD') continue;
    rows.push({
      postcode,
      suburb,
      lat: lat ? Number(lat) : null,
      lon: lon ? Number(lon) : null,
    });
  }
  // suburb (normalised) -> rows
  const byName = new Map();
  for (const row of rows) {
    const key = normaliseForLookup(row.suburb);
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key).push(row);
  }
  return byName;
}

async function main() {
  const qld = await loadQldPostcodes();
  const rowsRaw = await readFile(path.join(mig, 'suburb-rows.txt'), 'utf8');

  /** @type {Map<string, any>} */
  const suburbs = new Map();
  const stats = { matched: 0, postcodeFromLegacy: 0, unmatched: [], overridden: [], badCoords: [] };

  for (const line of rowsRaw.split(/\r?\n/).filter(Boolean)) {
    const [family, rawSub, legacyPc, slug] = line.split('|');
    let sub = rawSub;
    let pc = legacyPc || '';
    if (!pc && /^(.*)-qld-(\d{4})$/.test(sub)) {
      const m = /^(.*)-qld-(\d{4})$/.exec(sub);
      sub = m[1];
      pc = m[2];
    }

    const override = SLUG_OVERRIDES[sub];
    if (override) {
      pc = override.postcode || pc;
      sub = slugKeyFromOverride(override.name, sub);
    }

    if (!suburbs.has(sub)) {
      suburbs.set(sub, {
        key: sub,
        name: titleCase(sub),
        postcode: '',
        aliases: [],
        lat: null,
        lon: null,
        oldSlugs: [],
        families: new Set(),
      });
    }
    const rec = suburbs.get(sub);
    rec.families.add(family);
    rec.oldSlugs.push(slug);
    if (pc) rec.postcode = pc;
    if (override?.name) rec.name = override.name;
  }

  function slugKeyFromOverride(name, fallback) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  }

  // Resolve names, postcodes, coordinates
  for (const rec of suburbs.values()) {
    const candidates = qld.get(normaliseForLookup(rec.name)) || qld.get(normaliseForLookup(rec.key));
    if (candidates?.length) {
      stats.matched++;
      if (!rec.postcode) {
        rec.postcode = candidates[0].postcode;
      } else {
        // Prefer the candidate matching the legacy postcode - suburb names
        // repeat across the state (e.g. two Cedar Creeks, two Nambours).
        const exact = candidates.find((c) => c.postcode === rec.postcode);
        if (exact) {
          rec.lat = exact.lat;
          rec.lon = exact.lon;
        }
      }
      if (!rec.lat) {
        rec.lat = candidates[0].lat;
        rec.lon = candidates[0].lon;
      }
    } else if (rec.postcode) {
      stats.postcodeFromLegacy++;
    } else {
      stats.unmatched.push(rec.key);
    }

    if (POSTCODE_OVERRIDES[rec.key]) {
      rec.postcode = POSTCODE_OVERRIDES[rec.key];
      rec.needsReview = true;
      stats.overridden.push(rec.key);
    }

    // Drop coordinates that fall outside the serviced area.
    if (rec.lat != null && !inServiceArea(rec.lat, rec.lon)) {
      stats.badCoords.push(`${rec.name} (${rec.lat}, ${rec.lon})`);
      rec.lat = null;
      rec.lon = null;
    }

    if (COORD_OVERRIDES[rec.key]) {
      rec.lat = COORD_OVERRIDES[rec.key].lat;
      rec.lon = COORD_OVERRIDES[rec.key].lon;
    }

    if (!rec.postcode) rec.needsReview = true;
  }

  const out = [...suburbs.values()]
    .map((r) => ({
      key: r.key,
      name: r.name,
      postcode: r.postcode || null,
      region: regionFor(r.postcode),
      lat: r.lat,
      lon: r.lon,
      ...(r.needsReview ? { needsReview: true } : {}),
      families: [...r.families].sort(),
      oldSlugs: [...new Set(r.oldSlugs)].sort(),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'en-AU'));

  const dir = path.join(root, 'src', 'data');
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'suburbs.json'), JSON.stringify(out, null, 2));

  const byRegion = {};
  for (const s of out) byRegion[s.region] = (byRegion[s.region] || 0) + 1;

  console.log(`suburbs: ${out.length}`);
  console.log(`  matched in QLD dataset: ${stats.matched}`);
  console.log(`  postcode from legacy slug only: ${stats.postcodeFromLegacy}`);
  console.log(`  manual postcode overrides: ${stats.overridden.length} ${stats.overridden.join(', ')}`);
  console.log(`  coordinates dropped (outside service area): ${stats.badCoords.length}`);
  if (stats.badCoords.length) console.log(`    ${stats.badCoords.join(', ')}`);
  const flagged = out.filter((s) => s.needsReview);
  console.log(`  flagged needsReview: ${flagged.length} ${flagged.map((s) => s.key).join(', ')}`);
  console.log('by region:', byRegion);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
