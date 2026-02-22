import { execSync } from 'child_process';
import fs from 'fs';
import shapefile from 'shapefile';

const targetPlaces = [
    "Ballard", "Buellton", "Carpinteria", "Casmalia", "Cuyama", "Eastern Goleta Valley",
    "Garey", "Gaviota", "Goleta", "Guadalupe", "Hope Ranch", "Isla Vista", "Lompoc",
    "Los Alamos", "Los Olivos", "Mission Canyon", "Mission Hills", "Montecito", "New Cuyama",
    "Orcutt", "Santa Barbara", "Santa Maria", "Santa Ynez", "Sisquoc", "Solvang", "Summerland",
    "Toro Canyon", "University of California-Santa Barbara", "University of California Santa Barbara", "UCSB",
    "Vandenberg SFB", "Vandenberg AFB", "Vandenberg Village", "Vandenberg"
];

async function main() {
    console.log('Downloading places shapefile...');
    execSync('curl -sL https://www2.census.gov/geo/tiger/GENZ2022/shp/cb_2022_06_place_500k.zip -o places.zip');
    execSync('unzip -o places.zip -d temp_places | tail -n 5');

    console.log('Downloading counties shapefile...');
    execSync('curl -sL https://www2.census.gov/geo/tiger/GENZ2022/shp/cb_2022_us_county_500k.zip -o county.zip');
    execSync('unzip -o county.zip -d temp_county | tail -n 5');

    console.log('Parsing shapefiles...');

    // Parse Places
    const placesGeoJSON = { type: "FeatureCollection", features: [] };
    const placesCollection = await shapefile.read("temp_places/cb_2022_06_place_500k.shp", "temp_places/cb_2022_06_place_500k.dbf");

    placesGeoJSON.features = placesCollection.features.filter(f => {
        const name = f.properties.NAME;
        // We only care about matching places in CA, specifically checking their names.
        // If multiple places have the same name in CA, they both get added (very rare for these unique names).
        return targetPlaces.includes(name) || name.includes("Cuyama") || name.includes("Goleta") || name.includes("University of California");
    });

    const foundNames = placesGeoJSON.features.map(f => f.properties.NAME);
    console.log("Found Places:", foundNames);

    // Parse County
    const countyGeoJSON = { type: "FeatureCollection", features: [] };
    const countyCollection = await shapefile.read("temp_county/cb_2022_us_county_500k.shp", "temp_county/cb_2022_us_county_500k.dbf");

    countyGeoJSON.features = countyCollection.features.filter(f => {
        return f.properties.NAME === "Santa Barbara" && f.properties.STATEFP === "06"; // 06 is CA
    });

    fs.mkdirSync('./src/data', { recursive: true });
    fs.writeFileSync('./src/data/santa_barbara_places.json', JSON.stringify(placesGeoJSON));
    fs.writeFileSync('./src/data/santa_barbara_county.json', JSON.stringify(countyGeoJSON));

    console.log(`Wrote geojson: ${placesGeoJSON.features.length} places, ${countyGeoJSON.features.length} county.`);

    // Cleanup
    execSync('rm -rf places.zip county.zip temp_places temp_county');
    console.log('Cleanup complete.');
}

main().catch(console.error);
