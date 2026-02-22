import fs from 'fs';
import csv from 'csv-parser';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CSV_PATH = join(__dirname, '../Vacancy_Datathon.csv');
const AFFORDABILITY_PATH = join(__dirname, '../src/data/affordability_data.json');
const OUTPUT_PATH = join(__dirname, '../src/data/vacancy_data.json');

function normalizeName(raw) {
    const s = raw.trim();
    const cityMatch = s.match(/^(.+?) city, California$/);
    if (cityMatch) return cityMatch[1];
    const cdpMatch = s.match(/^(.+?) CDP, California$/);
    if (cdpMatch) return cdpMatch[1];
    return null;
}

function parseNum(v) {
    if (!v) return 0;
    const n = parseFloat(String(v).replace(/,/g, '').replace('%', '').trim());
    return isNaN(n) ? 0 : n;
}

// Get total occupied HH from affordability data (use 2021 as most recent year)
const affordabilityData = JSON.parse(fs.readFileSync(AFFORDABILITY_PATH, 'utf8'));

function getOccupied(placeName) {
    const d = affordabilityData[placeName];
    if (!d) return null;
    // Pick most recent year available
    for (const yr of ['2021', '2020', '2019', '2018', '2017']) {
        const y = d[yr];
        if (y && (y.ownerTotal > 0 || y.renterTotal > 0)) {
            return y.ownerTotal + y.renterTotal;
        }
    }
    return null;
}

const output = {};

fs.createReadStream(CSV_PATH)
    .pipe(csv())
    .on('data', (row) => {
        const place = normalizeName(row['Place']);
        if (!place) return;

        const totalVacant = parseNum(row['Total Vacant']);
        const forRent = parseNum(row['For rent']);
        const forSaleOnly = parseNum(row['For sale only']);
        const occupied = getOccupied(place);

        // Skip places with zero total vacant and no occupied data
        if (totalVacant === 0 && occupied === null) return;

        const overallRate = occupied !== null && (occupied + totalVacant) > 0
            ? totalVacant / (occupied + totalVacant)
            : null;

        const renterRate = totalVacant > 0
            ? forRent / totalVacant
            : null;

        const ownerRate = totalVacant > 0
            ? forSaleOnly / totalVacant
            : null;

        output[place] = {
            totalVacant,
            forRent,
            forSaleOnly,
            occupied: occupied ?? null,
            overallRate: overallRate !== null ? parseFloat(overallRate.toFixed(4)) : null,
            renterRate: renterRate !== null ? parseFloat(renterRate.toFixed(4)) : null,
            ownerRate: ownerRate !== null ? parseFloat(ownerRate.toFixed(4)) : null,
        };

        console.log(`${place}: overall=${overallRate !== null ? (overallRate * 100).toFixed(1) + '%' : 'N/A'}, renter=${renterRate !== null ? (renterRate * 100).toFixed(1) + '%' : 'N/A'}, owner=${ownerRate !== null ? (ownerRate * 100).toFixed(1) + '%' : 'N/A'}`);
    })
    .on('end', () => {
        fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));
        console.log(`\nVacancy data written to ${OUTPUT_PATH}`);
        console.log(`Places included: ${Object.keys(output).join(', ')}`);
    });
