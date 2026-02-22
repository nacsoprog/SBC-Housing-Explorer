import fs from 'fs';
import csv from 'csv-parser';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CSV_PATH = join(__dirname, '../Affordability-Datathon.csv');
const OUTPUT_PATH = join(__dirname, '../src/data/affordability_data.json');

// Strip trailing spaces, remove suffixes, normalize to canonical map name
function normalizeName(raw) {
    const s = raw.trim();
    // Only include individual places (cities and CDPs), skip aggregates
    const cityMatch = s.match(/^(.+?) city, California$/);
    if (cityMatch) return cityMatch[1];
    const cdpMatch = s.match(/^(.+?) CDP, California$/);
    if (cdpMatch) return cdpMatch[1];
    // Skip CCDs, county-level, and other aggregates
    return null;
}

function parseNum(v) {
    if (!v) return 0;
    const n = parseFloat(String(v).replace(/,/g, '').replace('%', ''));
    return isNaN(n) ? 0 : n;
}

// Structure: { placeName: { "2017": { ownerBurdened, ownerTotal, renterBurdened, renterTotal }, ... } }
const accumulator = {};

fs.createReadStream(CSV_PATH)
    .pipe(csv())
    .on('data', (row) => {
        const place = normalizeName(row['Place']);
        if (!place) return;

        const year = String(parseNum(row['Year']));
        if (!year || year === '0') return;

        if (!accumulator[place]) accumulator[place] = {};
        if (!accumulator[place][year]) {
            accumulator[place][year] = { ownerBurdened: 0, ownerTotal: 0, renterBurdened: 0, renterTotal: 0 };
        }

        const d = accumulator[place][year];
        d.ownerBurdened += parseNum(row['Cost Burden >30% (Owner)']);
        d.ownerTotal += parseNum(row['Owner Total']);
        d.renterBurdened += parseNum(row['Cost Burden >30% (Renter)']);
        d.renterTotal += parseNum(row['Renter Total']);
    })
    .on('end', () => {
        const output = {};

        for (const [place, years] of Object.entries(accumulator)) {
            output[place] = {};
            for (const [year, d] of Object.entries(years)) {
                const ownerRate = d.ownerTotal > 0 ? d.ownerBurdened / d.ownerTotal : null;
                const renterRate = d.renterTotal > 0 ? d.renterBurdened / d.renterTotal : null;

                // Exclude places with no meaningful data
                if (ownerRate === null && renterRate === null) continue;

                output[place][year] = {
                    ownerBurdened: d.ownerBurdened,
                    ownerTotal: d.ownerTotal,
                    ownerRate: ownerRate !== null ? parseFloat(ownerRate.toFixed(4)) : null,
                    renterBurdened: d.renterBurdened,
                    renterTotal: d.renterTotal,
                    renterRate: renterRate !== null ? parseFloat(renterRate.toFixed(4)) : null,
                };

                console.log(`${place} [${year}]: owner=${ownerRate !== null ? (ownerRate * 100).toFixed(1) + '%' : 'N/A'}, renter=${renterRate !== null ? (renterRate * 100).toFixed(1) + '%' : 'N/A'}`);
            }
            // Remove places with no years of data
            if (Object.keys(output[place]).length === 0) delete output[place];
        }

        fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));
        console.log(`\nAffordability data written to ${OUTPUT_PATH}`);
        console.log(`Places included: ${Object.keys(output).join(', ')}`);
    });
