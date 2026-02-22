import React, { useState, useMemo } from 'react';
import { ComposableMap, Geographies, Geography, ZoomableGroup, Annotation } from 'react-simple-maps';
import { ZoomIn, ZoomOut, Search, X } from 'lucide-react';
import { geoCentroid } from "d3-geo";
import { scaleLinear } from 'd3-scale';
import countyData from '../data/santa_barbara_county.json';
import placesData from '../data/santa_barbara_places.json';
import heatmapData from '../data/heatmap_data.json';

// Friction rate scale: 0 (easy to build) → 1 (very hard to build)
// frictionRate = 1 - (COs / max(entitlements, permits, COs))
const colorScale = scaleLinear().domain([0, 0.25, 0.5, 0.75, 1]).range([
    "#ffd1d6", // light fiery-orange pink (low friction = easy)
    "#ffb0b9", // medium-light
    "#ff828f", // medium
    "#ff5a5f", // fiery-orange pink
    "#e03c41"  // darker fiery-orange pink (high friction = hard)
]);

// Helper to get region data from heatmapData
const getRegionData = (name) => {
    const d = heatmapData[name];
    if (!d || typeof d !== 'object') return null;
    if (d.frictionRate === null) return null;
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

const SantaBarbaraMap = ({ activeLayer = 'permits' }) => {
    const [position, setPosition] = useState({ coordinates: [-120.0, 34.73], zoom: 0.95 });
    const [searchTerm, setSearchTerm] = useState("");
    const [highlightedRegion, setHighlightedRegion] = useState(null);
    const [hoveredRegion, setHoveredRegion] = useState(null);
    const [isAnimatingZoom, setIsAnimatingZoom] = useState(false);

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
        return allPlaces.length;
    }, [activeLayer, allPlaces]);

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
                            <span>Easy (0%)</span>
                            <span>Hard (100%)</span>
                        </div>
                    </div>
                )}
            </div>

            <div className="map-metric glass-panel" style={{
                position: 'absolute',
                bottom: '15px',
                left: '15px',
                zIndex: 50,
                padding: '10px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px'
            }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 400, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Regions</span>
                <span style={{ color: 'var(--text-primary)', fontSize: '0.8rem', fontWeight: 600 }}>{visibleRegionsCount}</span>
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
                                    const isHighlighted = (highlightedRegion === name) || (hoveredRegion === name);

                                    const regionData = getRegionData(name);
                                    const hasData = regionData !== null;
                                    const frictionRate = hasData ? regionData.frictionRate : 0;

                                    let fillStyle = "var(--map-place-fill)";
                                    let hoverFillStyle = "var(--map-place-hover)";

                                    if (activeLayer === 'permits' && hasData) {
                                        fillStyle = colorScale(frictionRate);
                                        hoverFillStyle = fillStyle;
                                    }

                                    if (isHighlighted && (activeLayer === 'none' || !hasData)) {
                                        fillStyle = "var(--accent-purple)";
                                        hoverFillStyle = "var(--accent-purple)";
                                    }

                                    const onEnter = () => handleMouseEnter(name);

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
                                                fill={fillStyle}
                                                stroke={isHighlighted ? "#fff" : "var(--map-place-stroke)"}
                                                strokeWidth={isHighlighted ? 1.0 : 0.5}
                                                style={{
                                                    default: { outline: "none" },
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
                                                        fontSize={8.5}
                                                        fontWeight={500}
                                                        onMouseEnter={onEnter}
                                                        onMouseLeave={handleMouseLeave}
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
        </div>
    );
};

export default SantaBarbaraMap;
