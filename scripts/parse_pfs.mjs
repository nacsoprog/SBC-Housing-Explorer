import fs from 'fs';
import csv from 'csv-parser';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CSV_PATH = join(__dirname, '../PFS_Datathon.csv');
const OUTPUT_PATH = join(__dirname, '../src/data/heatmap_data.json');

const cityBuckets = {
    "SANTA BARBARA": "Santa Barbara",
    "GOLETA": "Goleta",
    "SANTA MARIA": "Santa Maria",
    "ORCUTT": "Orcutt",
    "SOLVANG": "Solvang",
    "BUELLTON": "Buellton",
    "LOMPOC": "Lompoc",
    "CARPINTERIA": "Carpinteria",
    "MONTECITO": "Montecito",
    "ISLA VISTA": "Isla Vista",
    "SANTA YNEZ": "Santa Ynez",
    "LOS OLIVOS": "Los Olivos",
    "LOS ALAMOS": "Los Alamos",
    "MISSION CANYON": "Mission Canyon",
    "SUMMERLAND": "Summerland",
    "VANDENBERG VILLAGE": "Vandenberg Village",
    "MISSION HILLS": "Mission Hills",
    "NEW CUYAMA": "New Cuyama",
    "CUYAMA": "Cuyama",
    "GAREY": "Garey",
    "SISQUOC": "Sisquoc",
    "CASMALIA": "Casmalia",
    "TORO CANYON": "Toro Canyon",
    "VANDENBERG AFB": "Vandenberg AFB",
    "GUADALUPE": "Guadalupe",
    "EASTERN GOLETA VALLEY": "Eastern Goleta Valley"
};

const results = {};
for (const val of Object.values(cityBuckets)) {
    results[val] = { entitlements: 0, permits: 0, cos: 0 };
}

fs.createReadStream(CSV_PATH)
    .pipe(csv())
    .on('data', (data) => {
        let cityRaw = data['Jurisdiction'] ? data['Jurisdiction'].toUpperCase() : '';

        // If UNINCORPORATED, try to parse address
        if (cityRaw === 'SANTA BARBARA COUNTY') {
            const addr = data['Street Address'];
            if (addr && addr.includes(',')) {
                const parts = addr.split(',');
                if (parts.length >= 2) {
                    // Usually address format: "123 Main St, Santa Barbara, CA 93101"
                    cityRaw = parts[parts.length - 2].trim().toUpperCase();
                }
            }
        }

        let mappedRegion = null;
        for (const key of Object.keys(cityBuckets)) {
            // Exact match or contains
            if (cityRaw.includes(key)) {
                mappedRegion = cityBuckets[key];
                break;
            }
        }

        if (mappedRegion) {
            const entitlements = parseFloat(data['Total Entitlements']) || 0;
            const permits = parseFloat(data['Total Number of Building Permits']) || 0;
            const cos = parseFloat(data['Total Number of Units Issued Cert. of Occupancy']) || 0;
            results[mappedRegion].entitlements += entitlements;
            results[mappedRegion].permits += permits;
            results[mappedRegion].cos += cos;
        }
    })
    .on('end', () => {
        console.log('--- Housing Friction Rate by Region ---');
        const finalData = {};

        for (const [region, d] of Object.entries(results)) {
            // pipelineStart = highest point in the funnel (entitlements, or permits if more permits were issued, etc.)
            const pipelineStart = Math.max(d.entitlements, d.permits, d.cos);

            // frictionRate: 0 = smooth (COs ≈ pipeline start), 1 = total friction (no units completed)
            // Only set for regions with any real activity
            let frictionRate = null;
            if (pipelineStart > 0) {
                frictionRate = parseFloat((1 - (d.cos / pipelineStart)).toFixed(4));
            }

            finalData[region] = {
                entitlements: d.entitlements,
                permits: d.permits,
                cos: d.cos,
                frictionRate
            };

            if (frictionRate !== null) {
                console.log(`${region}: friction=${frictionRate} (E:${d.entitlements} P:${d.permits} CO:${d.cos})`);
            }
        }

        fs.writeFileSync(OUTPUT_PATH, JSON.stringify(finalData, null, 2));
        console.log(`\nAggregated metrics written to ${OUTPUT_PATH}`);
    });
