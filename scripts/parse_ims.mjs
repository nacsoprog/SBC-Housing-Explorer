import fs from 'fs';
import csv from 'csv-parser';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CSV_PATH = join(__dirname, '../IMS_Calc_5+6.csv');
const OUTPUT_PATH = join(__dirname, '../src/data/ims_data.json');

// Map CSV place names to canonical GeoJSON NAME values
const placeNameMap = {
    'carpinteria': 'Carpinteria',
    'santa barbara': 'Santa Barbara',
    'goleta': 'Goleta',
    'solvang': 'Solvang',
    'buellton': 'Buellton',
    'lompoc': 'Lompoc',
    'santa maria': 'Santa Maria',
    'guadalupe': 'Guadalupe',
    // Aggregate sub-regions — no GeoJSON match, stored but not mapped to map regions
    'north county': null,
    'north uninc.': null,
    'south county': null,
    'south uninc.': null,
    'unincorporated county': null,
};

const data = {};

fs.createReadStream(CSV_PATH)
    .pipe(csv())
    .on('data', (row) => {
        const rawPlace = (row['Place'] || '').trim();
        const rawCycle = (row['RHNA Cycle'] || '').trim(); // '5th' or '6th'
        const cycleKey = rawCycle === '5th' ? 'cycle5' : rawCycle === '6th' ? 'cycle6' : null;

        if (!rawPlace || !cycleKey) return;

        const canonicalName = placeNameMap[rawPlace.toLowerCase()];
        if (canonicalName === undefined) {
            console.warn(`Unmapped place: "${rawPlace}"`);
            return;
        }
        // null = aggregate region, skip for map data
        if (canonicalName === null) {
            console.log(`Skipping aggregate region: "${rawPlace}"`);
            return;
        }

        const parse = (v) => {
            const n = parseFloat((v || '').replace(',', ''));
            return isNaN(n) ? 0 : n;
        };

        if (!data[canonicalName]) data[canonicalName] = {};

        data[canonicalName][cycleKey] = {
            vliAlloc: parse(row['VLI Allocation']),
            vliGen: parse(row['VLI Units Generated']),
            vliGap: parse(row['VLI Gap']),
            liAlloc: parse(row['LI Allocation']),
            liGen: parse(row['LI Units Generated']),
            liGap: parse(row['LI Gap']),
            miAlloc: parse(row['MI Allocation']),
            miGen: parse(row['MI Units Generated']),
            miGap: parse(row['MI Gap']),
            amiAlloc: parse(row['AMI Allocation']),
            amiGen: parse(row['AMI Units Generated']),
            amiGap: parse(row['AMI Gap']),
            totalGenerated: parse(row['Total Generated']),
            totalAllocated: parse(row['Total Allocated']),
            shareAboveModerate: parse(row['Share Above Moderate']),
            ims: parse(row['IMS']),
        };

        const d = data[canonicalName][cycleKey];
        const cycleLabel = cycleKey === 'cycle5' ? '5th (2014-2022)' : '6th (2023-2031)';
        console.log(`${canonicalName} [${cycleLabel}]: IMS=${d.ims.toFixed(4)}`);
    })
    .on('end', () => {
        fs.writeFileSync(OUTPUT_PATH, JSON.stringify(data, null, 2));
        console.log(`\nIMS data written to ${OUTPUT_PATH}`);
        console.log(`Regions included: ${Object.keys(data).join(', ')}`);
    });
