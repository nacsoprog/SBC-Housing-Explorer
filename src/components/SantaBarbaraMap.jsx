import React, { useState, useMemo } from 'react';
import { ComposableMap, Geographies, Geography, ZoomableGroup, Annotation } from 'react-simple-maps';
import { ZoomIn, ZoomOut, Search, X } from 'lucide-react';
import { geoCentroid } from "d3-geo";
import { scaleLinear, scaleLog } from 'd3-scale';
import countyData from '../data/santa_barbara_county.json';
import placesData from '../data/santa_barbara_places.json';
import heatmapData from '../data/heatmap_data.json';
import imsData from '../data/ims_data.json';
import affordabilityData from '../data/affordability_data.json';
import vacancyData from '../data/vacancy_data.json';
import employmentData from '../data/employment_data.json';
import commuteData from '../data/commuting_data.json';
import MapTooltip from './MapTooltip';

// Friction rate scale: 0 (easy) → 1 (very hard)
const colorScale = scaleLinear().domain([0, 0.25, 0.5, 0.75, 1]).range([
    "#ffd1d6", "#ffb0b9", "#ff828f", "#ff5a5f", "#e03c41"
]);

// IMS color scale: log scale (IMS spans 0.002 → ~1675)
// Using a teal-to-deep-purple ramp to distinguish from the friction layer
const IMS_MIN = 0.01;
const IMS_MAX = 2000;
const imsColorScale = scaleLog().domain([IMS_MIN, IMS_MAX]).range(["#fde8c8", "#c75000"]).clamp(true);

// Helper to get friction region data
const getRegionData = (name) => {
    const d = heatmapData[name];
    if (!d || typeof d !== 'object') return null;
    if (d.frictionRate === null) return null;
    return d;
};

// Helper to get IMS data for a given cycle key ('cycle5' or 'cycle6')
const getImsData = (name, cycleKey) => {
    const d = imsData[name];
    if (!d || !d[cycleKey]) return null;
    return d[cycleKey];
};

// Cost burden color scales: 0 (no burden) → 1 (fully burdened)
const ownerColorScale = scaleLinear().domain([0, 0.5, 1]).range(["#fffde7", "#fbc02d", "#e65100"]).clamp(true);
const renterColorScale = scaleLinear().domain([0, 0.5, 1]).range(["#e8f5e9", "#4caf50", "#1b5e20"]).clamp(true);

// Helper to get cost burden data for a region and year
const getCbData = (name, year) => {
    const d = affordabilityData[name];
    if (!d || !d[year]) return null;
    return d[year];
};

// Helper to get vacancy data
const getVacancyData = (name) => {
    const d = vacancyData[name];
    if (!d) return null;
    return d;
};

const ANNOTATED_PLACES = {
    "Isla Vista": { dx: -10, dy: 30 },
    "University of California-Santa Barbara": { dx: 15, dy: 13, label: "UCSB", subjectOffset: [5, 2] },
    "Goleta": { dx: -30, dy: 17 },
    "Eastern Goleta Valley": { dx: -3, dy: -35 },
    "Mission Canyon": { dx: 0, dy: -40 },
    "Santa Barbara": { dx: 0, dy: 50 },
    "Montecito": { dx: 48, dy: -40 },
    "Summerland": { dx: 30, dy: 60 },
    "Toro Canyon": { dx: 70, dy: -20 },
    "Carpinteria": { dx: 40, dy: 10 },
    "Guadalupe": { dx: -10, dy: -30 },
    "Santa Maria": { dx: -5, dy: -60 },
    "Orcutt": { dx: 30, dy: 30 },
    "Casmalia": { dx: -1, dy: -30 },
    "Garey": { dx: 20, dy: -10 },
    "Sisquoc": { dx: 20, dy: 10 },
    "Vandenberg AFB": { dx: 30, dy: -20 },
    "Vandenberg Village": { dx: 30, dy: 8 },
    "Mission Hills": { dx: 25, dy: 25 },
    "Lompoc": { dx: -20, dy: 10 },
    "Los Alamos": { dx: 18, dy: -10 },
    "Los Olivos": { dx: 5, dy: -20 },
    "Ballard": { dx: 20, dy: -10 },
    "Solvang": { dx: 15, dy: 15 },
    "Buellton": { dx: -5, dy: 14 },
    "Santa Ynez": { dx: 20, dy: 1 },
    "New Cuyama": { dx: -30, dy: 20 },
    "Cuyama": { dx: -10, dy: 30 }
};

const SantaBarbaraMap = ({ activeLayer = 'permits', selectedRegion = null, onRegionSelect = () => { }, imsCycle = 'cycle6', cbSubLayer = 'owner', cbYear = '2019', availSubLayer = 'overall', scenarioOverride = null }) => {
    const [position, setPosition] = useState({ coordinates: [-119.97, 34.73], zoom: 0.95 });
    const [searchTerm, setSearchTerm] = useState("");
    const [highlightedRegion, setHighlightedRegion] = useState(null);
    const [hoveredRegion, setHoveredRegion] = useState(null);
    const [isAnimatingZoom, setIsAnimatingZoom] = useState(false);

    const handleClick = (name) => {
        onRegionSelect(name);
    };

    const handleMouseEnter = (name) => {
        setHoveredRegion(name);
    };

    const handleMouseLeave = () => {
        setHoveredRegion(null);
    };

    const handleZoomIn = () => {
        if (position.zoom >= 5) return;
        setIsAnimatingZoom(true);
        setPosition(pos => ({ ...pos, zoom: pos.zoom * 1.2 }));
        setTimeout(() => setIsAnimatingZoom(false), 300);
    };

    const handleZoomOut = () => {
        if (position.zoom <= 0.1) return;
        setIsAnimatingZoom(true);
        setPosition(pos => ({ ...pos, zoom: pos.zoom / 1.2 }));
        setTimeout(() => setIsAnimatingZoom(false), 300);
    };

    const handleMoveEnd = (position) => {
        setPosition(position);
    };

    // Make list of places for search
    const allPlaces = useMemo(() => {
        return placesData.features
            .map(f => f.properties.NAME)
            .filter(name => name !== 'University of California-Davis' && name !== 'University of California-Merced')
            .sort();
    }, []);

    const visibleRegionsCount = useMemo(() => {
        if (activeLayer === 'permits') {
            return allPlaces.filter(name => getRegionData(name) !== null).length;
        }
        if (activeLayer === 'ims') {
            return allPlaces.filter(name => getImsData(name, imsCycle) !== null).length;
        }
        if (activeLayer === 'costburden') {
            return allPlaces.filter(name => getCbData(name, cbYear) !== null).length;
        }
        if (activeLayer === 'availability') {
            return allPlaces.filter(name => getVacancyData(name) !== null).length;
        }
        return allPlaces.length;
    }, [activeLayer, imsCycle, cbYear, allPlaces]);

    const handleSearch = (e) => {
        const val = e.target.value;
        setSearchTerm(val);

        if (!val) {
            setHighlightedRegion(null);
            return;
        }

        const match = allPlaces.find(p => p.toLowerCase().includes(val.toLowerCase()));
        if (match) {
            setHighlightedRegion(match);
        } else {
            setHighlightedRegion(null);
        }
    };

    const clearSearch = () => {
        setSearchTerm("");
        setHighlightedRegion(null);
    };

    return (
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            {/* Fixed Title */}
            <h1 style={{
                position: 'absolute',
                top: '20px',
                left: '20%',
                transform: 'translateX(-50%)',
                zIndex: 40,
                margin: 0,
                fontSize: '1.8rem',
                fontWeight: 800,
                color: 'var(--text-primary)',
                letterSpacing: '-0.02em',
                pointerEvents: 'none',
                textShadow: '0 2px 10px rgba(0,0,0,0.5)'
            }}>
                Santa Barbara County
            </h1>

            {scenarioOverride && (
                <div style={{
                    position: 'absolute',
                    top: '60px',
                    left: '20%',
                    transform: 'translateX(-50%)',
                    zIndex: 40,
                    background: 'var(--accent-purple)',
                    color: 'white',
                    padding: '4px 10px',
                    borderRadius: '12px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    boxShadow: '0 4px 12px rgba(139,92,246,0.4)',
                    pointerEvents: 'none'
                }}>
                    Scenario Mode Active
                </div>
            )}

            <div className="map-controls">
                <div className="search-container glass-panel">
                    <Search size={18} className="search-icon" />
                    <input
                        type="text"
                        placeholder="Search regions..."
                        value={searchTerm}
                        onChange={handleSearch}
                        className="search-input"
                    />
                    {searchTerm && (
                        <button onClick={clearSearch} className="clear-search-btn">
                            <X size={16} />
                        </button>
                    )}
                </div>

                {activeLayer === 'permits' && (
                    <div className="map-legend glass-panel" style={{
                        padding: '15px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                    }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Housing Friction Rate</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '100%', height: '8px', background: 'linear-gradient(to right, #ffd1d6, #ffb0b9, #ff828f, #ff5a5f, #e03c41)', borderRadius: '4px' }}></div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 500 }}>
                            <span>Easy (0)</span>
                            <span>Hard (1)</span>
                        </div>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>Share of housing pipeline that never completed — lower is better</span>
                    </div>
                )}
                {activeLayer === 'costburden' && (
                    <div className="map-legend glass-panel" style={{ padding: '15px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {cbSubLayer === 'owner' ? 'Owner Cost Burden' : 'Renter Cost Burden'}
                        </span>
                        <div style={{
                            width: '100%', height: '8px', borderRadius: '4px', background: cbSubLayer === 'owner'
                                ? 'linear-gradient(to right, #fffde7, #fbc02d, #e65100)'
                                : 'linear-gradient(to right, #e8f5e9, #4caf50, #1b5e20)'
                        }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 500 }}>
                            <span>0%</span>
                            <span>50%</span>
                            <span>100%</span>
                        </div>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>Share of households spending &gt;30% of income on housing</span>
                    </div>
                )}
                {activeLayer === 'ims' && (
                    <div className="map-legend glass-panel" style={{
                        padding: '15px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                    }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Income Mismatch Score</span>
                        <div style={{ width: '100%', height: '8px', background: 'linear-gradient(to right, #fde8c8, #f5a94e, #e06e10, #c75000)', borderRadius: '4px' }}></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 500 }}>
                            <span>Low</span>
                            <span>High</span>
                        </div>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>Log scale — higher = greater housing shortage at affordable tiers</span>
                    </div>
                )}
                {activeLayer === 'availability' && (
                    <div className="map-legend glass-panel" style={{ padding: '15px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {availSubLayer === 'owner' ? 'Owner Vacancy Rate' : availSubLayer === 'renter' ? 'Renter Vacancy Rate' : 'Overall Vacancy Rate'}
                        </span>
                        <div style={{
                            width: '100%', height: '8px', borderRadius: '4px', background: availSubLayer === 'owner'
                                ? 'linear-gradient(to right, #fffde7, #fbc02d, #e65100)'
                                : availSubLayer === 'renter'
                                    ? 'linear-gradient(to right, #e8f5e9, #4caf50, #1b5e20)'
                                    : 'linear-gradient(to right, #e3e8f0, #8fa3bf, #1d3557)'
                        }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 500 }}>
                            <span>0%</span>
                            <span>50%</span>
                            <span>100%</span>
                        </div>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem', textAlign: 'center' }}>
                            {availSubLayer === 'overall'
                                ? 'Vacant / Total Housing Units'
                                : availSubLayer === 'renter'
                                    ? 'For Rent / Total Vacant Units'
                                    : 'For Sale / Total Vacant Units'}
                        </span>
                    </div>
                )}
            </div>

            <div className="map-metric glass-panel" style={{
                position: 'absolute',
                bottom: '15px',
                left: '15px',
                zIndex: 50,
                padding: '12px 18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                background: 'rgba(0,0,0,0.5)',
                borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.1)'
            }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Total Regions</span>
                <span style={{ color: 'var(--text-primary)', fontSize: '1.2rem', fontWeight: 800 }}>{visibleRegionsCount}</span>
            </div>

            <div
                style={{ width: '100%', height: '100%', cursor: 'grab' }}
            >
                <ComposableMap
                    projection="geoMercator"
                    projectionConfig={{
                        scale: 35000,
                        center: [-120.2, 34.65]
                    }}
                    className={`map-svg ${isAnimatingZoom ? 'animating-zoom' : ''}`}
                >
                    <ZoomableGroup
                        zoom={position.zoom}
                        center={position.coordinates}
                        onMoveEnd={handleMoveEnd}
                        minZoom={0.1}
                        maxZoom={5}
                    >
                        {/* Base County Boundaries */}
                        <Geographies geography={countyData}>
                            {({ geographies }) =>
                                geographies.map((geo) => (
                                    <Geography
                                        key={geo.rsmKey || geo.properties.GEOID}
                                        geography={geo}
                                        fill="var(--map-county-fill)"
                                        stroke="var(--map-county-stroke)"
                                        strokeWidth={0.5}
                                        style={{
                                            default: { outline: "none" },
                                            hover: { outline: "none" },
                                            pressed: { outline: "none" }
                                        }}
                                    />
                                ))
                            }
                        </Geographies>

                        {/* Places Map */}
                        <Geographies geography={placesData}>
                            {({ geographies, projection }) =>
                                geographies.map((geo) => {
                                    const name = geo.properties.NAME;
                                    const isSelected = selectedRegion === name;
                                    // Highlight only on hover or explicit search match. Selection (click) does not highlight.
                                    const isHighlighted = (highlightedRegion === name) || (hoveredRegion === name);

                                    // --- Friction layer ---
                                    const regionData = getRegionData(name);
                                    const hasFriction = regionData !== null;

                                    // --- IMS layer ---
                                    const isCycleKey = activeLayer === 'ims' ? imsCycle : null;
                                    const imsRegion = isCycleKey ? getImsData(name, isCycleKey) : null;
                                    const hasIms = imsRegion !== null;

                                    // --- Cost Burden layer ---
                                    const cbRegion = activeLayer === 'costburden' ? getCbData(name, cbYear) : null;
                                    const hasCb = cbRegion !== null;

                                    // --- Availability layer ---
                                    const vacRegion = activeLayer === 'availability' ? getVacancyData(name) : null;
                                    const hasVac = vacRegion !== null;

                                    const hasData = activeLayer === 'permits' ? hasFriction
                                        : activeLayer === 'ims' ? hasIms
                                            : activeLayer === 'costburden' ? hasCb
                                                : activeLayer === 'availability' ? hasVac
                                                    : false;

                                    let fillStyle = "var(--map-place-fill)";
                                    let hoverFillStyle = "var(--map-place-hover)";

                                    if (activeLayer === 'permits' && hasFriction) {
                                        fillStyle = colorScale(regionData.frictionRate);
                                        hoverFillStyle = fillStyle;
                                    }

                                    if (activeLayer === 'ims' && hasIms) {
                                        const imsVal = Math.max(imsRegion.ims, IMS_MIN);
                                        fillStyle = imsColorScale(imsVal);
                                        hoverFillStyle = fillStyle;
                                    }

                                    if (activeLayer === 'costburden' && hasCb) {
                                        const rate = cbSubLayer === 'owner'
                                            ? (cbRegion.ownerRate ?? 0)
                                            : (cbRegion.renterRate ?? 0);
                                        fillStyle = cbSubLayer === 'owner'
                                            ? ownerColorScale(rate)
                                            : renterColorScale(rate);
                                        hoverFillStyle = fillStyle;
                                    }

                                    if (activeLayer === 'availability' && hasVac) {
                                        const overallScale = scaleLinear().domain([0, 0.3, 0.7]).range(['#e3e8f0', '#8fa3bf', '#1d3557']).clamp(true);
                                        const rate = availSubLayer === 'owner'
                                            ? (vacRegion.ownerRate ?? 0)
                                            : availSubLayer === 'renter'
                                                ? (vacRegion.renterRate ?? 0)
                                                : (vacRegion.overallRate ?? 0);
                                        fillStyle = availSubLayer === 'owner'
                                            ? ownerColorScale(rate)
                                            : availSubLayer === 'renter'
                                                ? renterColorScale(rate)
                                                : overallScale(rate);
                                        hoverFillStyle = fillStyle;
                                    }

                                    if (scenarioOverride && scenarioOverride.region === name) {
                                        fillStyle = ownerColorScale(scenarioOverride.burden);
                                        hoverFillStyle = fillStyle;
                                    }

                                    if (isHighlighted && !scenarioOverride && (activeLayer === 'none' || !hasData)) {
                                        fillStyle = "var(--accent-purple)";
                                        hoverFillStyle = "var(--accent-purple)";
                                    }

                                    const onEnter = () => handleMouseEnter(name);
                                    const onClick = () => handleClick(name);

                                    let annotation = ANNOTATED_PLACES[name];
                                    if (activeLayer !== 'none' && !hasData) {
                                        annotation = null;
                                    }

                                    let subject = geoCentroid(geo);
                                    if (annotation && annotation.subjectOffset) {
                                        const screenCoords = projection(subject);
                                        subject = projection.invert([
                                            screenCoords[0] + annotation.subjectOffset[0],
                                            screenCoords[1] + annotation.subjectOffset[1]
                                        ]);
                                    }

                                    return (
                                        <g key={geo.rsmKey || geo.properties.GEOID}>
                                            <Geography
                                                geography={geo}
                                                className="geography-path"
                                                onMouseEnter={onEnter}
                                                onMouseLeave={handleMouseLeave}
                                                onClick={onClick}
                                                fill={fillStyle}
                                                stroke={isSelected ? "#fff" : isHighlighted ? "#fff" : "var(--map-place-stroke)"}
                                                strokeWidth={isSelected ? 1.5 : isHighlighted ? 1.0 : 0.5}
                                                style={{
                                                    default: { outline: "none", cursor: 'pointer' },
                                                    hover: {
                                                        fill: hoverFillStyle,
                                                        outline: "none"
                                                    },
                                                    pressed: {
                                                        fill: hoverFillStyle,
                                                        outline: "none"
                                                    }
                                                }}
                                            />
                                            {annotation && (
                                                <Annotation
                                                    subject={subject}
                                                    dx={annotation.dx}
                                                    dy={annotation.dy}
                                                    connectorProps={{
                                                        stroke: isHighlighted ? "#fff" : "rgba(255, 255, 255, 0.4)",
                                                        strokeWidth: 0.67,
                                                        strokeLinecap: "butt"
                                                    }}
                                                >
                                                    <text
                                                        x={annotation.dx < 0 ? -8 : 8}
                                                        textAnchor={annotation.dx < 0 ? "end" : "start"}
                                                        alignmentBaseline="middle"
                                                        fill={isHighlighted ? "#fff" : "var(--text-secondary)"}
                                                        fontSize={11}
                                                        fontWeight={500}
                                                        onMouseEnter={onEnter}
                                                        onMouseLeave={handleMouseLeave}
                                                        onClick={onClick}
                                                        style={{ cursor: "pointer", pointerEvents: "all", filter: "drop-shadow(0px 2px 4px rgba(0,0,0,0.6))" }}
                                                    >
                                                        {annotation.label || name}
                                                    </text>
                                                </Annotation>
                                            )}
                                        </g>
                                    );
                                })
                            }
                        </Geographies>
                    </ZoomableGroup>
                </ComposableMap>
            </div>

            {/* Metrics and Legend Overlays */}

            <div className="zoom-controls glass-panel" style={{
                position: 'absolute',
                bottom: '20px',
                right: '20px',
                zIndex: 50
            }}>
                <button onClick={handleZoomIn} className="zoom-btn" title="Zoom In">
                    <ZoomIn size={20} />
                </button>
                <div className="zoom-divider"></div>
                <button onClick={handleZoomOut} className="zoom-btn" title="Zoom Out">
                    <ZoomOut size={20} />
                </button>
            </div>

            {/* Hover tooltip — fixed center overlay */}
            <MapTooltip
                place={hoveredRegion}
                employmentData={employmentData}
                commuteData={commuteData}
                vacancyData={vacancyData}
                affordabilityData={affordabilityData}
                heatmapData={heatmapData}
                imsData={imsData}
                activeLayer={activeLayer}
                cbYear={cbYear}
                imsCycle={imsCycle}
                visible={!!hoveredRegion}
            />
        </div>
    );
};

export default SantaBarbaraMap;
