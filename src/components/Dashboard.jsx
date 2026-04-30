import React, { useState, useCallback, useRef } from 'react';
import { Layers, ChevronDown } from 'lucide-react';
import SantaBarbaraMap from './SantaBarbaraMap';
import heatmapData from '../data/heatmap_data.json';
import imsData from '../data/ims_data.json';
import affordabilityData from '../data/affordability_data.json';
import vacancyData from '../data/vacancy_data.json';

/**
 * Main application dashboard containing the interactive map, 
 * data visualization layers, AI advisor chat, and the Scenario Explorer.
 */
const Dashboard = () => {
    const [activeLayer, setActiveLayer] = useState('none');
    const [selectedRegion, setSelectedRegion] = useState(null);
    const [infoOpen, setInfoOpen] = useState(false);
    const [imsInfoOpen, setImsInfoOpen] = useState(false);
    const [imsCycle, setImsCycle] = useState('cycle6');
    const [cbSubLayer, setCbSubLayer] = useState('owner');
    const [cbYear, setCbYear] = useState('2019');
    const [cbInfoOpen, setCbInfoOpen] = useState(false);
    const [availSubLayer, setAvailSubLayer] = useState('overall');
    const [availInfoOpen, setAvailInfoOpen] = useState(false);

    // Scenario Explorer configuration and debounced prediction state
    const [scenarioOpen, setScenarioOpen] = useState(false);
    const [scenarioRegion, setScenarioRegion] = useState('');
    const [scenarioVars, setScenarioVars] = useState({
        population: 50000,
        very_low: 10,
        low: 20,
        moderate: 30,
        above_moderate: 40,
    });
    const [scenarioPrediction, setScenarioPrediction] = useState(null);
    const [scenarioLoading, setScenarioLoading] = useState(false);
    const debounceRef = useRef(null);

    const API_URL = 'http://localhost:8000';

    const fetchPrediction = useCallback(async (vars, region) => {
        setScenarioLoading(true);
        try {
            const res = await fetch(`${API_URL}/predict`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jurisdiction: region || 'Custom', ...vars }),
            });
            const data = await res.json();
            setScenarioPrediction(data.predicted_burden);
        } catch (e) {
            console.error('API error:', e);
            setScenarioPrediction(null);
        } finally {
            setScenarioLoading(false);
        }
    }, []);

    // Calculate slider maxes dynamically based on selected region's estimated households.
    // If no region or data, use default large numbers.
    const scenarioMaxes = React.useMemo(() => {
        let baseMaxPop = 200000;
        let baseMaxTier = 500;
        let baseMaxAbove = 2000;

        if (scenarioRegion && vacancyData[scenarioRegion]) {
            const vac = vacancyData[scenarioRegion];
            const estHouseholds = (vac.occupied || 0) + (vac.totalVacant || 0);
            if (estHouseholds > 0) {
                // Population is roughly households * 2.8. Let's add padding (e.g., 2.5x the estimate).
                baseMaxPop = Math.ceil((estHouseholds * 2.8 * 2.5) / 1000) * 1000;
                // RHNA/Permit totals scale with households. We'll set the max to around 4% of households as padding.
                baseMaxTier = Math.max(100, Math.ceil((estHouseholds * 0.04) / 50) * 50);
                // Above moderate is larger, so ~12% padding.
                baseMaxAbove = Math.max(200, Math.ceil((estHouseholds * 0.12) / 100) * 100);
            }
        }

        return {
            population: baseMaxPop,
            very_low: baseMaxTier,
            low: baseMaxTier,
            moderate: baseMaxTier,
            above_moderate: baseMaxAbove,
        };
    }, [scenarioRegion]);

    const handleScenarioChange = (key, value) => {
        const updated = { ...scenarioVars, [key]: Number(value) };
        setScenarioVars(updated);
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => fetchPrediction(updated, scenarioRegion), 220);
    };

    const frictionRegionData = selectedRegion ? heatmapData[selectedRegion] : null;
    const imsRegionData = selectedRegion ? imsData[selectedRegion] : null;
    const imsLayerData = imsRegionData && imsCycle ? imsRegionData[imsCycle] : null;
    const cbRegionData = selectedRegion ? affordabilityData[selectedRegion]?.[cbYear] : null;
    const vacRegionData = selectedRegion ? vacancyData[selectedRegion] : null;

    const handleRegionSelect = (regionName) => {
        setSelectedRegion(selectedRegion === regionName ? null : regionName);
    };

    const cardStyle = {
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '10px',
        padding: '16px',
    };

    // Subcomponent: TierRow for rendering affordable housing metrics cleanly
    const TierRow = ({ label, alloc, gen, gap, color }) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '8px 10px', background: 'rgba(255,255,255,0.04)', borderRadius: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600 }}>{label}</span>
                <span style={{ color: gap > 0 ? '#ff828f' : '#7dd9a8', fontSize: '0.78rem', fontWeight: 700 }}>
                    {gap > 0 ? `−${gap.toLocaleString()} shortage` : 'Met'}
                </span>
            </div>
            <div style={{ display: 'flex', gap: '12px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                <span>Allocated: <strong style={{ color: 'var(--text-secondary)' }}>{alloc.toLocaleString()}</strong></span>
                <span>Produced: <strong style={{ color: 'var(--text-secondary)' }}>{gen.toLocaleString()}</strong></span>
            </div>
            <div style={{ height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.1)', marginTop: '2px' }}>
                <div style={{ height: '100%', borderRadius: '2px', background: color, width: `${Math.min((gen / Math.max(alloc, 1)) * 100, 100)}%`, transition: 'width 0.3s' }} />
            </div>
        </div>
    );

    return (
        <div className="app-container">

            <aside className="sidebar glass-panel">
                <div className="sidebar-header">
                    <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: '2px' }}>Santa Barbara</h1>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 500, lineHeight: 1.2, letterSpacing: '0.02em' }}>Housing Explorer</p>
                </div>

                {/* Layer Controls */}
                <div className="layer-controls" style={{ marginTop: '8px' }}>
                    <h2 style={{ color: 'var(--text-muted)', fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <Layers size={11} /> Map Layers
                    </h2>

                    <div className="layer-options" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {/* Base Map */}
                        <button
                            className={`layer-btn ${activeLayer === 'none' ? 'active' : ''}`}
                            onClick={() => { setActiveLayer('none'); setSelectedRegion(null); }}
                        >
                            Base Map Only
                        </button>

                        {/* Housing Friction Rate */}
                        <button
                            className={`layer-btn ${activeLayer === 'permits' ? 'active' : ''}`}
                            onClick={() => setActiveLayer('permits')}
                            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                        >
                            <span>Housing Friction Rate Map</span>
                            <ChevronDown
                                size={14}
                                onClick={(e) => { e.stopPropagation(); setInfoOpen(o => !o); }}
                                style={{
                                    transition: 'transform 0.2s ease',
                                    transform: infoOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                                    opacity: 0.7,
                                    cursor: 'pointer',
                                    flexShrink: 0
                                }}
                            />
                        </button>
                        {infoOpen && (
                            <div style={{ ...cardStyle, fontSize: '0.78rem', lineHeight: 1.6, color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <p style={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.8rem' }}>What is the Housing Friction Rate?</p>
                                <p>
                                    This metric measures how difficult it is to successfully build housing in each jurisdiction.
                                    It tracks the share of the housing pipeline — from entitlements through permits to final certificates of
                                    occupancy — that <em>never reaches completion</em>.
                                </p>
                                <p>
                                    A rate near <span style={{ color: '#ffd1d6', fontWeight: 600 }}>0</span> means nearly every
                                    project approved was built and occupied. A rate near <span style={{ color: '#e03c41', fontWeight: 600 }}>1</span> means
                                    the system is approving housing that never gets built.
                                </p>
                                <p style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '10px', color: 'var(--text-muted)', fontSize: '0.74rem' }}>
                                    This visualization is part of the <strong style={{ color: 'var(--text-secondary)' }}>Data4Good</strong> initiative —
                                    applying open civic data to expose structural barriers to housing access. Understanding where friction
                                    is highest helps policymakers, researchers, and communities identify which jurisdictions need
                                    regulatory reform, infrastructure investment, or targeted intervention to unlock housing production.
                                </p>
                            </div>
                        )}

                        {/* IMS — single button with toggle and dropdown inside */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <button
                                className={`layer-btn ${activeLayer === 'ims' ? 'active' : ''}`}
                                onClick={() => setActiveLayer('ims')}
                                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                            >
                                <span>Income Mismatch Score Map</span>
                                <ChevronDown
                                    size={14}
                                    onClick={(e) => { e.stopPropagation(); setImsInfoOpen(o => !o); }}
                                    style={{
                                        transition: 'transform 0.2s ease',
                                        transform: imsInfoOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                                        opacity: 0.7,
                                        cursor: 'pointer',
                                        flexShrink: 0
                                    }}
                                />
                            </button>

                            {/* Cycle toggle — always visible when IMS is active */}
                            {activeLayer === 'ims' && (
                                <div style={{ display: 'flex', background: 'rgba(255,255,255,0.06)', borderRadius: '8px', padding: '3px', gap: '2px' }}>
                                    {[{ key: 'cycle5', label: 'Cycle 5', sub: '2014–2022' }, { key: 'cycle6', label: 'Cycle 6', sub: '2023–2031' }].map(({ key, label, sub }) => (
                                        <button
                                            key={key}
                                            onClick={() => setImsCycle(key)}
                                            style={{
                                                flex: 1,
                                                padding: '5px 4px',
                                                borderRadius: '6px',
                                                border: 'none',
                                                cursor: 'pointer',
                                                fontSize: '0.72rem',
                                                fontWeight: imsCycle === key ? 700 : 400,
                                                background: imsCycle === key ? 'rgba(183,234,255,0.18)' : 'transparent',
                                                color: imsCycle === key ? '#b7eaff' : 'var(--text-muted)',
                                                transition: 'all 0.15s',
                                                lineHeight: 1.3
                                            }}
                                        >
                                            <div>{label}</div>
                                            <div style={{ fontSize: '0.65rem', opacity: 0.7 }}>{sub}</div>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Info dropdown */}
                            {imsInfoOpen && (
                                <div style={{ ...cardStyle, fontSize: '0.78rem', lineHeight: 1.6, color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <p style={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.8rem' }}>What is the Income Mismatch Score?</p>
                                    <p>
                                        The IMS quantifies the gap between what each jurisdiction was <em>required</em> to plan for under California's
                                        Regional Housing Needs Allocation (RHNA) and what was actually <em>produced</em>, weighted by income tier.
                                    </p>
                                    <p>
                                        Higher IMS indicates a greater structural mismatch — particularly when affordable tiers (VLI, LI, MI) are severely underproduced
                                        relative to market-rate (AMI) housing. This reflects where the housing system is producing for affluence while neglecting need.
                                    </p>
                                    <p style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '10px', fontSize: '0.74rem' }}>
                                        This is a <strong style={{ color: 'var(--text-secondary)' }}>Data4Good</strong> metric — surfacing housing inequity data to support
                                        evidence-based advocacy and policy reform.
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Cost Burden — single button with subtabs, year slider, and info dropdown */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <button
                                className={`layer-btn ${activeLayer === 'costburden' ? 'active' : ''}`}
                                onClick={() => setActiveLayer('costburden')}
                                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                            >
                                <span>Cost Burden Map</span>
                                <ChevronDown
                                    size={14}
                                    onClick={(e) => { e.stopPropagation(); setCbInfoOpen(o => !o); }}
                                    style={{ transition: 'transform 0.2s ease', transform: cbInfoOpen ? 'rotate(180deg)' : 'rotate(0deg)', opacity: 0.7, cursor: 'pointer', flexShrink: 0 }}
                                />
                            </button>

                            {/* Owner / Renter subtab toggle */}
                            {activeLayer === 'costburden' && (
                                <div style={{ display: 'flex', background: 'rgba(255,255,255,0.06)', borderRadius: '8px', padding: '3px', gap: '2px' }}>
                                    {[{ key: 'owner', label: 'Owner', color: '#fbc02d' }, { key: 'renter', label: 'Renter', color: '#4caf50' }].map(({ key, label, color }) => (
                                        <button
                                            key={key}
                                            onClick={() => setCbSubLayer(key)}
                                            style={{
                                                flex: 1,
                                                padding: '6px 4px',
                                                borderRadius: '6px',
                                                border: 'none',
                                                cursor: 'pointer',
                                                fontSize: '0.75rem',
                                                fontWeight: cbSubLayer === key ? 700 : 400,
                                                background: cbSubLayer === key ? `${color}22` : 'transparent',
                                                color: cbSubLayer === key ? color : 'var(--text-muted)',
                                                transition: 'all 0.15s',
                                            }}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Year slider */}
                            {activeLayer === 'costburden' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '6px 2px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Year</span>
                                        <span style={{ color: cbSubLayer === 'owner' ? '#fbc02d' : '#4caf50', fontWeight: 700, fontSize: '0.85rem' }}>{cbYear}</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="2017"
                                        max="2021"
                                        step="1"
                                        value={parseInt(cbYear)}
                                        onChange={e => setCbYear(String(e.target.value))}
                                        style={{
                                            width: '100%',
                                            accentColor: cbSubLayer === 'owner' ? '#fbc02d' : '#4caf50',
                                            cursor: 'pointer',
                                        }}
                                    />
                                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.65rem' }}>
                                        <span>2017</span><span>2018</span><span>2019</span><span>2020</span><span>2021</span>
                                    </div>
                                </div>
                            )}

                            {/* Info dropdown */}
                            {cbInfoOpen && (
                                <div style={{ ...cardStyle, fontSize: '0.78rem', lineHeight: 1.6, color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <p style={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.8rem' }}>What is Cost Burden?</p>
                                    <p>
                                        A household is <em>cost burdened</em> when it spends more than 30% of its gross income on housing — rent or mortgage. This is HUD's standard threshold for measuring housing affordability.
                                    </p>
                                    <p>
                                        <strong style={{ color: '#fbc02d' }}>Owner burden</strong> tracks homeowners spending over 30% on mortgage, taxes, and insurance.
                                        {' '}<strong style={{ color: '#4caf50' }}>Renter burden</strong> tracks renters spending over 30% on rent and utilities.
                                    </p>
                                    <p style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '10px', fontSize: '0.74rem' }}>
                                        Income is measured in HAMFI bands — HUD Area Median Family Income — ranging from &lt;30% (very low) to &gt;100% (above median).
                                        Data covers <strong style={{ color: 'var(--text-secondary)' }}>2017–2021</strong> from the ACS/CHAS.
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Availability — single button with subtabs and info dropdown */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <button
                                className={`layer-btn ${activeLayer === 'availability' ? 'active' : ''}`}
                                onClick={() => setActiveLayer('availability')}
                                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                            >
                                <span>Availability Map</span>
                                <ChevronDown
                                    size={14}
                                    onClick={(e) => { e.stopPropagation(); setAvailInfoOpen(o => !o); }}
                                    style={{ transition: 'transform 0.2s ease', transform: availInfoOpen ? 'rotate(180deg)' : 'rotate(0deg)', opacity: 0.7, cursor: 'pointer', flexShrink: 0 }}
                                />
                            </button>

                            {/* Overall / Owner / Renter subtab toggle */}
                            {activeLayer === 'availability' && (
                                <div style={{ display: 'flex', background: 'rgba(255,255,255,0.06)', borderRadius: '8px', padding: '3px', gap: '2px' }}>
                                    {[
                                        { key: 'overall', label: 'Overall', color: '#8fa3bf' },
                                        { key: 'owner', label: 'Owner', color: '#fbc02d' },
                                        { key: 'renter', label: 'Renter', color: '#4caf50' },
                                    ].map(({ key, label, color }) => (
                                        <button
                                            key={key}
                                            onClick={() => setAvailSubLayer(key)}
                                            style={{
                                                flex: 1,
                                                padding: '6px 4px',
                                                borderRadius: '6px',
                                                border: 'none',
                                                cursor: 'pointer',
                                                fontSize: '0.72rem',
                                                fontWeight: availSubLayer === key ? 700 : 400,
                                                background: availSubLayer === key ? `${color}22` : 'transparent',
                                                color: availSubLayer === key ? color : 'var(--text-muted)',
                                                transition: 'all 0.15s',
                                            }}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Info dropdown */}
                            {availInfoOpen && (
                                <div style={{ ...cardStyle, fontSize: '0.78rem', lineHeight: 1.6, color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <p style={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.8rem' }}>What is Housing Availability?</p>
                                    <p>
                                        Availability measures how much of the housing stock is vacant and accessible for occupancy.
                                        High rates may signal speculative or seasonal holding; low rates indicate a tight supply.
                                    </p>
                                    <p>
                                        <strong style={{ color: '#fbc02d' }}>Owner:</strong> For Sale Only / Total Vacant.<br />
                                        <strong style={{ color: '#4caf50' }}>Renter:</strong> For Rent / Total Vacant.<br />
                                        <strong style={{ color: '#8fa3bf' }}>Overall:</strong> Total Vacant / Total Housing Units.
                                    </p>
                                    <p style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '10px', fontSize: '0.74rem' }}>
                                        Data from the <strong style={{ color: 'var(--text-secondary)' }}>2020 ACS 5-Year estimates</strong> for Santa Barbara County.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── Scenario Explorer Panel ───────────────────────── */}
                <div style={{ marginTop: '20px' }}>
                    <div
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: '8px' }}
                        onClick={() => setScenarioOpen(!scenarioOpen)}
                    >
                        <h2 style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                            Scenario Explorer <span style={{ fontSize: '0.6rem', background: 'var(--accent-purple)', padding: '2px 6px', borderRadius: '4px', color: 'white', marginLeft: '6px' }}>Beta</span>
                        </h2>
                        <ChevronDown size={14} style={{ color: 'var(--text-muted)', transform: scenarioOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
                    </div>

                    {scenarioOpen && (
                        <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4, margin: 0 }}>
                                Tweak variables to predict housing cost burden in real-time.
                            </p>

                            <select
                                value={scenarioRegion}
                                onChange={(e) => {
                                    setScenarioRegion(e.target.value);
                                    if (e.target.value) fetchPrediction(scenarioVars, e.target.value);
                                }}
                                style={{
                                    width: '100%',
                                    padding: '6px',
                                    borderRadius: '4px',
                                    background: 'rgba(0,0,0,0.2)',
                                    color: 'white',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    fontSize: '0.8rem',
                                    outline: 'none'
                                }}
                            >
                                <option value="">Select a region...</option>
                                {Object.keys(affordabilityData).sort().map(r => (
                                    <option key={r} value={r}>{r}</option>
                                ))}
                            </select>

                            {[
                                { key: 'population', label: 'Population' },
                                { key: 'very_low', label: 'Very Low Income' },
                                { key: 'low', label: 'Low Income' },
                                { key: 'moderate', label: 'Moderate Income' },
                                { key: 'above_moderate', label: 'Above Moderate Income' },
                            ].map(({ key, label }) => {
                                const max = scenarioMaxes[key];
                                return (
                                    <div key={key}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px' }}>
                                            <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                                            <span style={{ color: 'white', fontWeight: 600 }}>{scenarioVars[key]}</span>
                                        </div>
                                        <input
                                            type="range"
                                            min={0}
                                            max={max}
                                            value={scenarioVars[key]}
                                            onChange={(e) => handleScenarioChange(key, e.target.value)}
                                            style={{ width: '100%', cursor: 'pointer', accentColor: 'var(--accent-purple)' }}
                                        />
                                    </div>
                                );
                            })}

                            <div style={{ marginTop: '4px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Predicted Burden:</span>
                                {scenarioLoading ? (
                                    <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>...</span>
                                ) : scenarioPrediction !== null ? (
                                    <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent-purple)' }}>{(scenarioPrediction * 100).toFixed(1)}%</span>
                                ) : (
                                    <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>--</span>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Region Analysis Panel ─────────────────────────── */}
                <div style={{ marginTop: '20px' }}>
                    <h2 style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
                        Region Analysis
                    </h2>

                    {/* FRICTION RATE PANEL */}
                    {activeLayer === 'permits' && (
                        !selectedRegion ? (
                            <div style={{ ...cardStyle, color: 'var(--text-muted)', fontSize: '0.82rem', lineHeight: 1.5, textAlign: 'center' }}>
                                Click a region on the map to view its friction rate breakdown.
                            </div>
                        ) : !frictionRegionData || frictionRegionData.frictionRate === null ? (
                            <div style={cardStyle}>
                                <p style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: '6px', fontSize: '0.95rem' }}>{selectedRegion}</p>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>No pipeline data available for this region.</p>
                            </div>
                        ) : (
                            <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                <div>
                                    <p style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '1.05rem', marginBottom: '2px' }}>{selectedRegion}</p>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Housing Pipeline Breakdown</p>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {[
                                        { label: 'Entitlements', value: frictionRegionData.entitlements, desc: 'Units approved to proceed' },
                                        { label: 'Permits Issued', value: frictionRegionData.permits, desc: 'Building permits authorized' },
                                        { label: 'Cert. of Occupancy', value: frictionRegionData.cos, desc: 'Units completed & habitable' },
                                    ].map(({ label, value, desc }) => (
                                        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: 'rgba(255,255,255,0.04)', borderRadius: '8px' }}>
                                            <div>
                                                <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600 }}>{label}</div>
                                                <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>{desc}</div>
                                            </div>
                                            <div style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '1rem' }}>{value.toLocaleString()}</div>
                                        </div>
                                    ))}
                                </div>
                                <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Friction Rate Calculation</p>
                                    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '6px', padding: '8px 10px' }}>
                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginBottom: '2px' }}>Pipeline Start = max(E, P, CO)</div>
                                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontFamily: 'monospace' }}>
                                            max({frictionRegionData.entitlements}, {frictionRegionData.permits}, {frictionRegionData.cos}) = <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{Math.max(frictionRegionData.entitlements, frictionRegionData.permits, frictionRegionData.cos).toLocaleString()}</span>
                                        </div>
                                    </div>
                                    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '6px', padding: '8px 10px' }}>
                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginBottom: '2px' }}>Completion Rate = CO / Pipeline Start</div>
                                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontFamily: 'monospace' }}>
                                            {frictionRegionData.cos} / {Math.max(frictionRegionData.entitlements, frictionRegionData.permits, frictionRegionData.cos)} = <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{(frictionRegionData.cos / Math.max(frictionRegionData.entitlements, frictionRegionData.permits, frictionRegionData.cos)).toFixed(4)}</span>
                                        </div>
                                    </div>
                                    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255, 130, 143, 0.25)', borderRadius: '6px', padding: '8px 10px' }}>
                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginBottom: '2px' }}>Friction Rate = 1 − Completion Rate</div>
                                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontFamily: 'monospace' }}>
                                            1 − {(frictionRegionData.cos / Math.max(frictionRegionData.entitlements, frictionRegionData.permits, frictionRegionData.cos)).toFixed(4)} = <span style={{ color: frictionRegionData.frictionRate < 0.25 ? '#ffd1d6' : frictionRegionData.frictionRate < 0.5 ? '#ff828f' : frictionRegionData.frictionRate < 0.75 ? '#ff5a5f' : '#e03c41', fontWeight: 700, fontSize: '1rem' }}>{frictionRegionData.frictionRate.toFixed(4)}</span>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                                        <div style={{ width: '12px', height: '12px', borderRadius: '3px', flexShrink: 0, background: frictionRegionData.frictionRate < 0.25 ? '#ffd1d6' : frictionRegionData.frictionRate < 0.5 ? '#ff828f' : frictionRegionData.frictionRate < 0.75 ? '#ff5a5f' : '#e03c41' }} />
                                        <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                                            {frictionRegionData.frictionRate < 0.25 ? 'Low friction — most projects completed' :
                                                frictionRegionData.frictionRate < 0.5 ? 'Moderate friction — notable attrition' :
                                                    frictionRegionData.frictionRate < 0.75 ? 'High friction — significant drop-off' :
                                                        'Very high friction — most projects did not complete'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )
                    )}

                    {/* IMS PANEL */}
                    {activeLayer === 'ims' && (
                        !selectedRegion ? (
                            <div style={{ ...cardStyle, color: 'var(--text-muted)', fontSize: '0.82rem', lineHeight: 1.5, textAlign: 'center' }}>
                                Click a region to view its RHNA allocation vs. production breakdown.
                            </div>
                        ) : !imsLayerData ? (
                            <div style={cardStyle}>
                                <p style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: '6px' }}>{selectedRegion}</p>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>No IMS data available for this region in this cycle.</p>
                            </div>
                        ) : (
                            <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                <div>
                                    <p style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '1.05rem', marginBottom: '2px' }}>{selectedRegion}</p>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        RHNA {imsCycle === 'cycle5' ? 'Cycle 5 (2014–2022)' : 'Cycle 6 (2023–2031)'}
                                    </p>
                                </div>

                                {/* Income tier breakdowns */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>Allocation vs. Production by Tier</p>
                                    <TierRow label="Very Low Income (VLI)" alloc={imsLayerData.vliAlloc} gen={imsLayerData.vliGen} gap={imsLayerData.vliGap} color="#ff828f" />
                                    <TierRow label="Low Income (LI)" alloc={imsLayerData.liAlloc} gen={imsLayerData.liGen} gap={imsLayerData.liGap} color="#ffb347" />
                                    <TierRow label="Median Income (MI)" alloc={imsLayerData.miAlloc} gen={imsLayerData.miGen} gap={imsLayerData.miGap} color="#ffe066" />
                                    <TierRow label="Above Median (AMI)" alloc={imsLayerData.amiAlloc} gen={imsLayerData.amiGen} gap={imsLayerData.amiGap} color="#7dd9a8" />
                                </div>

                                {/* Totals */}
                                <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>Total Allocated</span>
                                        <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{imsLayerData.totalAllocated.toLocaleString()}</span>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', textAlign: 'right' }}>
                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>Total Produced</span>
                                        <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{imsLayerData.totalGenerated.toLocaleString()}</span>
                                    </div>
                                </div>

                                {/* Share Above Moderate */}
                                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '6px', padding: '8px 10px' }}>
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginBottom: '4px' }}>Share of production that was above-moderate income</div>
                                    <div style={{ height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px' }}>
                                        <div style={{ height: '100%', borderRadius: '3px', background: '#7dd9a8', width: `${(imsLayerData.shareAboveModerate * 100).toFixed(1)}%` }} />
                                    </div>
                                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 700, marginTop: '4px' }}>{(imsLayerData.shareAboveModerate * 100).toFixed(1)}% above-moderate</div>
                                </div>

                                {/* IMS score */}
                                <div style={{ background: 'rgba(183, 234, 255, 0.07)', border: '1px solid rgba(183,234,255,0.2)', borderRadius: '6px', padding: '10px 12px' }}>
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Income Mismatch Score</div>
                                    <div style={{ color: '#b7eaff', fontSize: '1.4rem', fontWeight: 800, fontFamily: 'monospace' }}>
                                        {imsLayerData.ims.toFixed(2)}
                                    </div>
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: '2px' }}>
                                        {imsLayerData.ims < 10 ? 'Low mismatch — affordable production tracks allocation' :
                                            imsLayerData.ims < 100 ? 'Moderate mismatch — affordable tiers partially underserved' :
                                                imsLayerData.ims < 500 ? 'High mismatch — significant affordable housing deficit' :
                                                    'Severe mismatch — critical shortfall at affordable tiers'}
                                    </div>
                                </div>
                            </div>
                        )
                    )}

                    {/* COST BURDEN PANEL */}
                    {activeLayer === 'costburden' && (
                        !selectedRegion ? (
                            <div style={{ ...cardStyle, color: 'var(--text-muted)', fontSize: '0.82rem', lineHeight: 1.5, textAlign: 'center' }}>
                                Click a region to view its cost burden breakdown.
                            </div>
                        ) : !cbRegionData ? (
                            <div style={cardStyle}>
                                <p style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: '6px' }}>{selectedRegion}</p>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>No cost burden data available for {selectedRegion} in {cbYear}.</p>
                            </div>
                        ) : (
                            <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                <div>
                                    <p style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '1.05rem', marginBottom: '2px' }}>{selectedRegion}</p>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cost Burden — {cbYear} ({cbSubLayer === 'owner' ? 'Homeowners' : 'Renters'})</p>
                                </div>

                                {/* Main burden rate */}
                                {(() => {
                                    const rate = cbSubLayer === 'owner' ? cbRegionData.ownerRate : cbRegionData.renterRate;
                                    const total = cbSubLayer === 'owner' ? cbRegionData.ownerTotal : cbRegionData.renterTotal;
                                    const burdened = cbSubLayer === 'owner' ? cbRegionData.ownerBurdened : cbRegionData.renterBurdened;
                                    const color = cbSubLayer === 'owner' ? '#fbc02d' : '#4caf50';
                                    const pct = rate !== null ? (rate * 100).toFixed(1) : 'N/A';
                                    return (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                                <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>Cost Burdened (&gt;30% income on housing)</span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <div style={{ flex: 1, height: '10px', background: 'rgba(255,255,255,0.08)', borderRadius: '5px' }}>
                                                    <div style={{ height: '100%', borderRadius: '5px', background: color, width: rate !== null ? `${Math.min(rate * 100, 100)}%` : '0%', transition: 'width 0.4s ease' }} />
                                                </div>
                                                <span style={{ color, fontWeight: 800, fontSize: '1.1rem', width: '52px', textAlign: 'right' }}>{pct}%</span>
                                            </div>
                                            <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                                                {burdened.toLocaleString()} of {total.toLocaleString()} {cbSubLayer === 'owner' ? 'owner' : 'renter'} households
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* All-years trend */}
                                {(() => {
                                    const allYears = affordabilityData[selectedRegion];
                                    if (!allYears) return null;
                                    const color = cbSubLayer === 'owner' ? '#fbc02d' : '#4caf50';
                                    return (
                                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>Trend (2017–2021)</p>
                                            {['2017', '2018', '2019', '2020', '2021'].map(yr => {
                                                const yd = allYears[yr];
                                                const r = yd ? (cbSubLayer === 'owner' ? yd.ownerRate : yd.renterRate) : null;
                                                return (
                                                    <div key={yr} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span style={{ color: yr === cbYear ? color : 'var(--text-muted)', fontSize: '0.72rem', fontWeight: yr === cbYear ? 700 : 400, width: '32px', flexShrink: 0 }}>{yr}</span>
                                                        <div style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px' }}>
                                                            {r !== null && <div style={{ height: '100%', borderRadius: '3px', background: yr === cbYear ? color : 'rgba(255,255,255,0.25)', width: `${Math.min(r * 100, 100)}%` }} />}
                                                        </div>
                                                        <span style={{ color: yr === cbYear ? color : 'var(--text-muted)', fontSize: '0.72rem', width: '38px', textAlign: 'right', flexShrink: 0 }}>{r !== null ? `${(r * 100).toFixed(1)}%` : 'N/A'}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                })()}
                            </div>
                        )
                    )}

                    {/* AVAILABILITY PANEL */}
                    {activeLayer === 'availability' && (
                        !selectedRegion ? (
                            <div style={{ ...cardStyle, color: 'var(--text-muted)', fontSize: '0.82rem', lineHeight: 1.5, textAlign: 'center' }}>
                                Click a region to view its vacancy breakdown.
                            </div>
                        ) : !vacRegionData ? (
                            <div style={cardStyle}>
                                <p style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: '6px' }}>{selectedRegion}</p>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>No availability data for {selectedRegion}.</p>
                            </div>
                        ) : (
                            <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                <div>
                                    <p style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '1.05rem', marginBottom: '2px' }}>{selectedRegion}</p>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Housing Availability</p>
                                </div>

                                {/* Main rate bar */}
                                {(() => {
                                    const rate = availSubLayer === 'owner' ? vacRegionData.ownerRate
                                        : availSubLayer === 'renter' ? vacRegionData.renterRate
                                            : vacRegionData.overallRate;
                                    const color = availSubLayer === 'owner' ? '#fbc02d'
                                        : availSubLayer === 'renter' ? '#4caf50'
                                            : '#8fa3bf';
                                    const label = availSubLayer === 'owner' ? 'For Sale / Vacant'
                                        : availSubLayer === 'renter' ? 'For Rent / Vacant'
                                            : 'Vacant / Total Units';
                                    const pct = rate !== null ? (rate * 100).toFixed(1) : 'N/A';
                                    return (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>{label}</span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <div style={{ flex: 1, height: '10px', background: 'rgba(255,255,255,0.08)', borderRadius: '5px' }}>
                                                    <div style={{ height: '100%', borderRadius: '5px', background: color, width: rate !== null ? `${Math.min(rate * 100, 100)}%` : '0%', transition: 'width 0.4s ease' }} />
                                                </div>
                                                <span style={{ color, fontWeight: 800, fontSize: '1.1rem', width: '52px', textAlign: 'right' }}>{pct}%</span>
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* Vacancy breakdown */}
                                <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Vacant Unit Breakdown</p>
                                    {[
                                        { label: 'For Rent', value: vacRegionData.forRent, color: '#4caf50' },
                                        { label: 'For Sale', value: vacRegionData.forSaleOnly, color: '#fbc02d' },
                                        { label: 'Other Vacant', value: vacRegionData.totalVacant - vacRegionData.forRent - vacRegionData.forSaleOnly, color: 'rgba(255,255,255,0.4)' },
                                    ].map(({ label, value, color }) => {
                                        const pct = vacRegionData.totalVacant > 0 ? value / vacRegionData.totalVacant : 0;
                                        return (
                                            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', width: '80px', flexShrink: 0 }}>{label}</span>
                                                <div style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px' }}>
                                                    <div style={{ height: '100%', borderRadius: '3px', background: color, width: `${Math.min(pct * 100, 100)}%` }} />
                                                </div>
                                                <span style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', width: '38px', textAlign: 'right', flexShrink: 0 }}>{value.toLocaleString()}</span>
                                            </div>
                                        );
                                    })}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.7rem', marginTop: '4px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '6px' }}>
                                        <span>Total Vacant</span>
                                        <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{vacRegionData.totalVacant.toLocaleString()}</span>
                                    </div>
                                    {vacRegionData.occupied && (
                                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                                            <span>Occupied</span>
                                            <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{vacRegionData.occupied.toLocaleString()}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    )}
                </div>
            </aside>

            <main className="map-container glass-panel">
                <SantaBarbaraMap
                    activeLayer={activeLayer}
                    selectedRegion={selectedRegion}
                    onRegionSelect={handleRegionSelect}
                    imsCycle={imsCycle}
                    cbSubLayer={cbSubLayer}
                    cbYear={cbYear}
                    availSubLayer={availSubLayer}
                    scenarioOverride={scenarioPrediction !== null && scenarioRegion
                        ? { region: scenarioRegion, burden: scenarioPrediction }
                        : null}
                />
            </main>
        </div>
    );
};

export default Dashboard;
