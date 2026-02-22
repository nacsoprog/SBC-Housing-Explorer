import React, { useState } from 'react';
import { Layers, ChevronDown } from 'lucide-react';
import SantaBarbaraMap from './SantaBarbaraMap';
import heatmapData from '../data/heatmap_data.json';

const Dashboard = () => {
    const [activeLayer, setActiveLayer] = useState('permits');
    const [selectedRegion, setSelectedRegion] = useState(null);
    const [infoOpen, setInfoOpen] = useState(false);

    const regionData = selectedRegion ? heatmapData[selectedRegion] : null;

    const handleRegionSelect = (name) => {
        setSelectedRegion(prev => prev === name ? null : name);
    };

    return (
        <div className="app-container">

            <aside className="sidebar glass-panel">
                <div className="sidebar-header">
                    <h1 className="heading-main">Santa Barbara</h1>
                    <p className="text-subtitle">Housing &amp; Demographics Explorer</p>
                </div>

                <div className="layer-controls" style={{ marginTop: '24px' }}>
                    <h2 style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Layers size={14} /> Map Layers
                    </h2>

                    <div className="layer-options" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <button
                            className={`layer-btn ${activeLayer === 'none' ? 'active' : ''}`}
                            onClick={() => { setActiveLayer('none'); setSelectedRegion(null); }}
                        >
                            Base Map Only
                        </button>
                        <button
                            className={`layer-btn ${activeLayer === 'permits' ? 'active' : ''}`}
                            onClick={() => setActiveLayer('permits')}
                            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                        >
                            <span>Housing Friction Rate</span>
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
                            <div style={{
                                background: 'rgba(255,255,255,0.04)',
                                border: '1px solid rgba(255,255,255,0.08)',
                                borderRadius: '10px',
                                padding: '14px',
                                fontSize: '0.78rem',
                                lineHeight: 1.6,
                                color: 'var(--text-muted)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '10px'
                            }}>
                                <p style={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.8rem' }}>What is the Housing Friction Rate?</p>
                                <p>
                                    This metric measures how difficult it is to successfully build housing in each jurisdiction.
                                    It tracks the share of the housing pipeline — from entitlements through permits to final certificates of
                                    occupancy — that <em>never reaches completion</em>.
                                </p>
                                <p>
                                    A rate near <span style={{ color: '#ffd1d6', fontWeight: 600 }}>0%</span> means nearly every
                                    project approved was eventually built and occupied. A rate near <span style={{ color: '#e03c41', fontWeight: 600 }}>100%</span> means
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
                    </div>
                </div>

                {/* Friction Rate Detail Panel */}
                {activeLayer === 'permits' && (
                    <div style={{ marginTop: '28px' }}>
                        <h2 style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
                            Region Analysis
                        </h2>

                        {!selectedRegion ? (
                            <div style={{
                                background: 'rgba(255,255,255,0.04)',
                                border: '1px solid rgba(255,255,255,0.08)',
                                borderRadius: '10px',
                                padding: '16px',
                                color: 'var(--text-muted)',
                                fontSize: '0.82rem',
                                lineHeight: 1.5,
                                textAlign: 'center'
                            }}>
                                Click a region on the map to view its friction rate breakdown.
                            </div>
                        ) : !regionData || regionData.frictionRate === null ? (
                            <div style={{
                                background: 'rgba(255,255,255,0.04)',
                                border: '1px solid rgba(255,255,255,0.08)',
                                borderRadius: '10px',
                                padding: '16px',
                            }}>
                                <p style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: '6px', fontSize: '0.95rem' }}>{selectedRegion}</p>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>No pipeline data available for this region.</p>
                            </div>
                        ) : (
                            <div style={{
                                background: 'rgba(255,255,255,0.04)',
                                border: '1px solid rgba(255,255,255,0.08)',
                                borderRadius: '10px',
                                padding: '16px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '14px'
                            }}>
                                {/* Region Name */}
                                <div>
                                    <p style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '1.05rem', marginBottom: '2px' }}>{selectedRegion}</p>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Housing Pipeline Breakdown</p>
                                </div>

                                {/* Pipeline steps */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {[
                                        { label: 'Entitlements', value: regionData.entitlements, desc: 'Units approved to proceed' },
                                        { label: 'Permits Issued', value: regionData.permits, desc: 'Building permits authorized' },
                                        { label: 'Cert. of Occupancy', value: regionData.cos, desc: 'Units completed & habitable' },
                                    ].map(({ label, value, desc }) => (
                                        <div key={label} style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            padding: '8px 10px',
                                            background: 'rgba(255,255,255,0.04)',
                                            borderRadius: '8px',
                                        }}>
                                            <div>
                                                <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600 }}>{label}</div>
                                                <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>{desc}</div>
                                            </div>
                                            <div style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '1rem' }}>{value.toLocaleString()}</div>
                                        </div>
                                    ))}
                                </div>

                                {/* Equation */}
                                <div style={{
                                    borderTop: '1px solid rgba(255,255,255,0.08)',
                                    paddingTop: '12px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '6px'
                                }}>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Friction Rate Calculation</p>

                                    {/* Step 1 */}
                                    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '6px', padding: '8px 10px' }}>
                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginBottom: '2px' }}>Pipeline Start = max(E, P, CO)</div>
                                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontFamily: 'monospace' }}>
                                            max({regionData.entitlements}, {regionData.permits}, {regionData.cos}) = <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{Math.max(regionData.entitlements, regionData.permits, regionData.cos).toLocaleString()}</span>
                                        </div>
                                    </div>

                                    {/* Step 2 */}
                                    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '6px', padding: '8px 10px' }}>
                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginBottom: '2px' }}>Completion Rate = CO ÷ Pipeline Start</div>
                                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontFamily: 'monospace' }}>
                                            {regionData.cos} ÷ {Math.max(regionData.entitlements, regionData.permits, regionData.cos)} = <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{(regionData.cos / Math.max(regionData.entitlements, regionData.permits, regionData.cos)).toFixed(4)}</span>
                                        </div>
                                    </div>

                                    {/* Step 3 / Result */}
                                    <div style={{
                                        background: 'rgba(255,255,255,0.03)',
                                        border: '1px solid rgba(255, 130, 143, 0.25)',
                                        borderRadius: '6px',
                                        padding: '8px 10px'
                                    }}>
                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginBottom: '2px' }}>Friction Rate = 1 − Completion Rate</div>
                                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontFamily: 'monospace' }}>
                                            1 − {(regionData.cos / Math.max(regionData.entitlements, regionData.permits, regionData.cos)).toFixed(4)} = <span style={{ color: regionData.frictionRate < 0.25 ? '#ffd1d6' : regionData.frictionRate < 0.5 ? '#ff828f' : regionData.frictionRate < 0.75 ? '#ff5a5f' : '#e03c41', fontWeight: 700, fontSize: '1rem' }}>{regionData.frictionRate.toFixed(4)}</span>
                                        </div>
                                    </div>

                                    {/* Interpretation */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                                        <div style={{
                                            width: '12px', height: '12px', borderRadius: '3px', flexShrink: 0,
                                            background: regionData.frictionRate < 0.25 ? '#ffd1d6' :
                                                regionData.frictionRate < 0.5 ? '#ff828f' :
                                                    regionData.frictionRate < 0.75 ? '#ff5a5f' : '#e03c41'
                                        }} />
                                        <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                                            {regionData.frictionRate < 0.25 ? 'Low friction — most projects completed' :
                                                regionData.frictionRate < 0.5 ? 'Moderate friction — notable attrition' :
                                                    regionData.frictionRate < 0.75 ? 'High friction — significant drop-off' :
                                                        'Very high friction — most projects did not complete'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </aside>

            <main className="map-container glass-panel">
                <SantaBarbaraMap
                    activeLayer={activeLayer}
                    selectedRegion={selectedRegion}
                    onRegionSelect={handleRegionSelect}
                />
            </main>
        </div>
    );
};

export default Dashboard;
