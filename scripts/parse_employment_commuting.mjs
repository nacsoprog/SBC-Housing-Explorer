#!/usr/bin/env node
/**
 * parse_employment_commuting.mjs
 * Parses employment_industry_datathon.csv, employment_percent_datathon.csv,
 * and commuting_datathon.csv into src/data/employment_data.json and
 * src/data/commuting_data.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ── helpers ──────────────────────────────────────────────────────────────────

function parseNum(v) {
    if (!v || v === '' || v === 'N/A' || v === '-') return 0;
    return parseFloat(String(v).replace(/[,%]/g, '').trim()) || 0;
}

function parsePct(v) {
    if (!v || v === '' || v === 'N/A' || v === '-') return null;
    const s = String(v).replace('%', '').trim();
    return parseFloat(s) / 100 || null;
}

/** Naïve CSV parser that handles quoted fields with commas */
function parseCSV(raw) {
    const lines = raw.split('\n').filter(l => l.trim());
    const rows = lines.map(line => {
        const cols = [];
        let cur = '', inQ = false;
        for (let i = 0; i < line.length; i++) {
            if (line[i] === '"') { inQ = !inQ; continue; }
            if (line[i] === ',' && !inQ) { cols.push(cur.trim()); cur = ''; continue; }
            cur += line[i];
        }
        cols.push(cur.trim());
        return cols;
    });
    return rows;
}

/** Normalise place name to match existing JSON keys */
function normaliseName(raw) {
    if (!raw) return null;
    return raw
        .replace(/, California$/, '')
        .replace(/ CDP$/, '')
        .replace(/ city$/, '')
        .trim();
}

// ── Parse employment_percent_datathon.csv ─────────────────────────────────

const percentRaw = fs.readFileSync(
    path.join(ROOT, 'employment_percent_datathon.csv'), 'utf8');
const percentRows = parseCSV(percentRaw);
const percentHeader = percentRows[0];

console.log('Employment percent columns:', percentHeader.length);

const employmentData = {};

for (let i = 1; i < percentRows.length; i++) {
    const row = percentRows[i];
    if (row.length < 10) continue;

    const rawPlace = row[0];
    const name = normaliseName(rawPlace);
    if (!name) continue;

    // Column indices (0-indexed per header):
    // 0 Place, 1 Geography, 2 Pop 16+, 3 In labor force %, 4 Civilian labor force %,
    // 5 Employed %, 6 Unemployed %, 7 Armed Forces %, 8 Not in labor force %
    // 9 Workers 16+, 10 drove alone %, 11 carpool %, 12 transit %, 13 walked %, 14 other %, 15 WFH %
    // 16 Civilian employed pop, 
    // 17 Mgmt/biz/sci/arts %, 18 Service %, 19 Sales/office %, 20 NatRes/Const/Maint %, 21 Prod/Trans/MatMove %
    // 22 Agriculture %, 23 Construction %, 24 Manufacturing %, 25 Wholesale %,
    // 26 Retail %, 27 Transport/util %, 28 Information %, 29 Finance/RE %, 
    // 30 Professional/scientific %, 31 Education/healthcare %, 32 Arts/entertainment %,
    // 33 Other services %, 34 Public admin %
    // 35 Private wage %, 36 Govt %, 37 Self-employed %, 38 Unpaid %
    // 39 Total HH, 40 <10k %, 41 10-15k %, 42 15-25k %, 43 25-35k %, 44 35-50k %,
    // 45 50-75k %, 46 75-100k %, 47 100-150k %, 48 150-200k %, 49 200k+ %

    employmentData[name] = {
        // Occupation breakdown (for pie chart)
        occupations: {
            'Management & Business': parsePct(row[17]),
            'Service': parsePct(row[18]),
            'Sales & Office': parsePct(row[19]),
            'Natural Resources & Construction': parsePct(row[20]),
            'Production & Transportation': parsePct(row[21]),
        },
        // Industry breakdown
        industries: {
            'Agriculture': parsePct(row[22]),
            'Construction': parsePct(row[23]),
            'Manufacturing': parsePct(row[24]),
            'Wholesale': parsePct(row[25]),
            'Retail': parsePct(row[26]),
            'Transportation & Utilities': parsePct(row[27]),
            'Information': parsePct(row[28]),
            'Finance & Real Estate': parsePct(row[29]),
            'Professional & Scientific': parsePct(row[30]),
            'Education & Healthcare': parsePct(row[31]),
            'Arts & Entertainment': parsePct(row[32]),
            'Other Services': parsePct(row[33]),
            'Public Administration': parsePct(row[34]),
        },
        // Labor stats
        laborForce: parsePct(row[3]),
        employed: parsePct(row[5]),
        unemployed: parsePct(row[6]),
        wfhPct: parsePct(row[15]),
        // Income distribution (for cost burden context)
        incomeBands: {
            '<$10k': parsePct(row[40]),
            '$10–15k': parsePct(row[41]),
            '$15–25k': parsePct(row[42]),
            '$25–35k': parsePct(row[43]),
            '$35–50k': parsePct(row[44]),
            '$50–75k': parsePct(row[45]),
            '$75–100k': parsePct(row[46]),
            '$100–150k': parsePct(row[47]),
            '$150–200k': parsePct(row[48]),
            '$200k+': parsePct(row[49]),
        },
    };
}

// ── Parse commuting_datathon.csv ──────────────────────────────────────────

const commuteRaw = fs.readFileSync(
    path.join(ROOT, 'commuting_datathon.csv'), 'utf8');
const commuteRows = parseCSV(commuteRaw);
// header row:
// 0 Place, 1 Total, 2 No vehicle, 3 1 vehicle, 4 2 vehicles, 5 3+ vehicles
// 6 Drove alone, 7 Carpool, 8 Transit, 9 Walked, 10 Other, 11 WFH, 12 Workers16+, 13 WFH pct

const commuteData = {};

for (let i = 1; i < commuteRows.length; i++) {
    const row = commuteRows[i];
    if (row.length < 11) continue;

    const rawPlace = row[0];
    const name = normaliseName(rawPlace);
    if (!name) continue;

    const total = parseNum(row[1]) || 1;
    const droveAlone = parseNum(row[6]);
    const carpool = parseNum(row[7]);
    const transit = parseNum(row[8]);
    const walked = parseNum(row[9]);
    const other = parseNum(row[10]);
    const wfh = parseNum(row[11]);

    commuteData[name] = {
        total,
        modes: {
            'Drove Alone': droveAlone,
            'Carpool': carpool,
            'Transit': transit,
            'Walked': walked,
            'Other': other,
            'Work from Home': wfh,
        },
        pcts: {
            'Drove Alone': total > 0 ? droveAlone / total : 0,
            'Carpool': total > 0 ? carpool / total : 0,
            'Transit': total > 0 ? transit / total : 0,
            'Walked': total > 0 ? walked / total : 0,
            'Other': total > 0 ? other / total : 0,
            'Work from Home': total > 0 ? wfh / total : 0,
        },
        wfhPct: parsePct(row[13]),
        vehicles: {
            'No vehicle': parseNum(row[2]),
            '1 vehicle': parseNum(row[3]),
            '2 vehicles': parseNum(row[4]),
            '3+ vehicles': parseNum(row[5]),
        },
    };
}

// ── Write outputs ─────────────────────────────────────────────────────────

const OUT = path.join(ROOT, 'src', 'data');
fs.writeFileSync(path.join(OUT, 'employment_data.json'), JSON.stringify(employmentData, null, 2));
fs.writeFileSync(path.join(OUT, 'commuting_data.json'), JSON.stringify(commuteData, null, 2));

console.log(`✅ employment_data.json: ${Object.keys(employmentData).length} places`);
console.log(`✅ commuting_data.json:  ${Object.keys(commuteData).length} places`);
