import React, { useMemo } from 'react';

// ── Colour palettes ───────────────────────────────────────────────────────────

const OCCUPATION_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#f97316', '#8b5cf6'];
const COMMUTE_COLORS = ['#3b82f6', '#06b6d4', '#22c55e', '#a3e635', '#ec4899', '#a78bfa'];

// ── SVG Pie Chart ─────────────────────────────────────────────────────────────

function PieChart({ data, colors, size = 90 }) {
    const segments = useMemo(() => {
        const total = data.reduce((s, d) => s + (d.value || 0), 0);
        if (total === 0) return [];
        let angle = -Math.PI / 2;
        const r = size / 2 - 2, cx = size / 2, cy = size / 2;
        return data.filter(d => d.value > 0).map((d, i) => {
            const slice = (d.value / total) * 2 * Math.PI;
            const start = angle; angle += slice;
            const x1 = cx + r * Math.cos(start), y1 = cy + r * Math.sin(start);
            const x2 = cx + r * Math.cos(angle), y2 = cy + r * Math.sin(angle);
            const path = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${slice > Math.PI ? 1 : 0} 1 ${x2} ${y2} Z`;
            return { path, color: colors[i % colors.length], label: d.label, pct: d.value / total };
        });
    }, [data, colors, size]);

    return (
        <svg width={size} height={size} style={{ overflow: 'visible', flexShrink: 0 }}>
            {segments.map((s, i) => (
                <path key={i} d={s.path} fill={s.color} stroke="rgba(0,0,0,0.3)" strokeWidth="0.5" />
            ))}
        </svg>
    );
}

// ── Legend ────────────────────────────────────────────────────────────────────

function Legend({ items, colors }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1, minWidth: 0 }}>
            {items.slice(0, 6).filter(d => d.value > 0.005).map((d, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: colors[i % colors.length] }} />
                    <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{d.label}</span>
                    <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', fontWeight: 600, flexShrink: 0 }}>{(d.value * 100).toFixed(0)}%</span>
                </div>
            ))}
        </div>
    );
}

// ── Generic fractional icon row ───────────────────────────────────────────────
// score 0‥1 → fills 0‥3 icons proportionally

function IconRating({ score, label, sublabel, renderIcon, emptyColor, fillColor }) {
    const filled = score != null ? Math.max(0, Math.min(3, score * 3)) : 0;
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
            <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
                {[0, 1, 2].map(i => renderIcon(
                    Math.max(0, Math.min(1, filled - i)),
                    emptyColor,
                    fillColor,
                    i,
                ))}
            </div>
            <span style={{ fontSize: '0.58rem', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.3, maxWidth: 72 }}>{label}</span>
            {sublabel && (
                <span style={{ fontSize: '0.52rem', color: 'rgba(255,255,255,0.22)', textAlign: 'center', lineHeight: 1.2, maxWidth: 72 }}>{sublabel}</span>
            )}
        </div>
    );
}

// ── Dollar icon ───────────────────────────────────────────────────────────────

function renderDollar(fillAmt, emptyColor, fillColor, key) {
    return (
        <div key={key} style={{ position: 'relative', width: 18, height: 22 }}>
            <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', lineHeight: 1, color: emptyColor, userSelect: 'none' }}>$</span>
            <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', lineHeight: 1, color: fillColor, userSelect: 'none', clipPath: `inset(${(1 - fillAmt) * 100}% 0 0 0)` }}>$</span>
        </div>
    );
}

// ── House icon ────────────────────────────────────────────────────────────────

function renderHouse(fillAmt, emptyColor, fillColor, key) {
    return (
        <svg key={key} width="18" height="20" viewBox="0 0 18 20" style={{ flexShrink: 0 }}>
            <polygon points="9,2 1,9 3,9 3,18 15,18 15,9 17,9" fill="none" stroke={emptyColor} strokeWidth="1.5" />
            <g style={{ clipPath: `inset(${(1 - fillAmt) * 100}% 0 0 0)` }}>
                <polygon points="9,2 1,9 3,9 3,18 15,18 15,9 17,9" fill={fillColor} />
            </g>
        </svg>
    );
}

// ── Section title ─────────────────────────────────────────────────────────────

function SectionTitle({ children }) {
    return (
        <p style={{ margin: 0, fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', paddingBottom: 6, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            {children}
        </p>
    );
}

// ── Context-aware year picker ─────────────────────────────────────────────────

function pickAffYear(affordData, activeLayer, cbYear, imsCycle) {
    if (!affordData) return null;
    const years = Object.keys(affordData).sort();
    if (!years.length) return null;
    const latest = years[years.length - 1];
    if (activeLayer === 'costburden') return years.includes(cbYear) ? cbYear : latest;
    if (activeLayer === 'ims') {
        const cy5 = '2020';
        return imsCycle === 'cycle5' ? (years.includes(cy5) ? cy5 : latest) : latest;
    }
    return latest;
}

// ── Main Tooltip ───────────────────────────────────────────────────────────────

export default function MapTooltip({
    place,
    employmentData, commuteData, vacancyData, affordabilityData, heatmapData, imsData,
    activeLayer = 'none',
    cbYear = '2021',
    imsCycle = 'cycle6',
    visible,
}) {
    if (!visible || !place) return null;

    const emp = employmentData?.[place];
    const com = commuteData?.[place];
    const vac = vacancyData?.[place];
    const aff = affordabilityData?.[place];
    const fr = heatmapData?.[place];
    const ims = imsData?.[place];

    // ── Affordability year ────────────────────────────────────────────────────
    const affYear = pickAffYear(aff, activeLayer, cbYear, imsCycle);
    const affData = aff?.[affYear] ?? {};
    const ownerBurden = affData.ownerRate ?? null;
    const renterBurden = affData.renterRate ?? null;

    // ── Availability (vacancy) score 0..1 → more = easier ────────────────────
    const vacRate = vac?.overallRate ?? null;
    const availScore = vacRate != null ? Math.min(vacRate * 4, 1) : null;

    // ── Friction score 0..1 → more friction = worse ───────────────────────────
    // House icons filled by friction: all 3 red = very hard to build
    const frRate = fr?.frictionRate ?? null;
    // Optionally penalise by IMS on IMS layer
    let frictionScore = frRate;
    if (activeLayer === 'ims' && ims) {
        const imsVal = ims[imsCycle]?.ims ?? null;
        if (imsVal != null && frictionScore != null) {
            frictionScore = Math.min(1, frictionScore + (imsVal / 2000) * 0.3);
        }
    }

    // ── Pie data ──────────────────────────────────────────────────────────────
    const occData = emp ? Object.entries(emp.occupations).map(([label, value]) => ({ label, value: value ?? 0 })) : [];
    const comData = com ? Object.entries(com.pcts).map(([label, value]) => ({ label, value: value ?? 0 })).filter(d => d.value > 0) : [];

    const hasAny = occData.length > 0 || comData.length > 0 || ownerBurden != null || renterBurden != null || availScore != null || frictionScore != null;
    if (!hasAny) return null;

    // ── Context badge ─────────────────────────────────────────────────────────
    const BADGE = {
        costburden: `Cost Burden · ${cbYear}`,
        ims: `IMS ${imsCycle === 'cycle5' ? 'Cycle 5 (2014–2022)' : 'Cycle 6 (2023–2031)'}`,
        permits: 'Housing Friction Rate',
        availability: 'Availability Layer',
    };

    return (
        <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(calc(-50% + 350px), calc(-50% - 0px))',
            zIndex: 2000, width: 680,
            background: 'linear-gradient(145deg,rgba(15,17,27,0.97),rgba(10,13,22,0.97))',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16,
            padding: '18px 24px', display: 'flex', flexDirection: 'column', gap: 14,
            pointerEvents: 'none',
            boxShadow: '0 10px 30px rgba(0,0,0,0.4),0 0 0 1px rgba(255,255,255,0.04)',
        }}>
            {/* ── Header ─────────────────────────────────────────────────────── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <p style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>{place}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Santa Barbara County</span>
                        {BADGE[activeLayer] && (
                            <span style={{ fontSize: '0.58rem', color: '#a78bfa', background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 4, padding: '1px 6px' }}>
                                {BADGE[activeLayer]}
                            </span>
                        )}
                    </div>
                </div>

                {/* ── 4 indicator columns ─────────────────────────────────── */}
                <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                    {/* Renter burden — green $ */}
                    <IconRating
                        score={renterBurden}
                        label="Renter Burden"
                        sublabel={affYear ? `ACS ${affYear}` : null}
                        renderIcon={renderDollar}
                        emptyColor="rgba(255,255,255,0.1)"
                        fillColor="#4ade80"
                    />
                    {/* Owner burden — yellow $ */}
                    <IconRating
                        score={ownerBurden}
                        label="Owner Burden"
                        sublabel={affYear ? `ACS ${affYear}` : null}
                        renderIcon={renderDollar}
                        emptyColor="rgba(255,255,255,0.1)"
                        fillColor="#fbbf24"
                    />
                    {/* Availability — blue house */}
                    <IconRating
                        score={availScore}
                        label="Availability"
                        sublabel={vacRate != null ? `${(vacRate * 100).toFixed(1)}% vacant` : null}
                        renderIcon={renderHouse}
                        emptyColor="rgba(255,255,255,0.12)"
                        fillColor="#60a5fa"
                    />
                    {/* Friction — red house */}
                    <IconRating
                        score={frictionScore}
                        label="Build Friction"
                        sublabel={frRate != null ? `${(frRate * 100).toFixed(0)}% rate` : null}
                        renderIcon={renderHouse}
                        emptyColor="rgba(255,255,255,0.12)"
                        fillColor="#f87171"
                    />
                </div>
            </div>

            {/* ── Pie charts ──────────────────────────────────────────────────── */}
            <div style={{ display: 'flex', gap: 14 }}>
                {occData.length > 0 && (
                    <div style={{ flex: 1, background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <SectionTitle>Occupation Types</SectionTitle>
                        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                            <PieChart data={occData} colors={OCCUPATION_COLORS} size={88} />
                            <Legend items={occData} colors={OCCUPATION_COLORS} />
                        </div>
                    </div>
                )}
                {comData.length > 0 && (
                    <div style={{ flex: 1, background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <SectionTitle>How People Commute</SectionTitle>
                        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                            <PieChart data={comData} colors={COMMUTE_COLORS} size={88} />
                            <Legend items={comData} colors={COMMUTE_COLORS} />
                        </div>
                    </div>
                )}
            </div>

            {/* ── Stats bar ───────────────────────────────────────────────────── */}
            {(emp || vac || fr) && (() => {
                const stats = [
                    emp?.unemployed != null && { label: 'Unemployment', value: `${(emp.unemployed * 100).toFixed(1)}%`, color: emp.unemployed > 0.07 ? '#f87171' : '#4ade80' },
                    emp?.wfhPct != null && { label: 'Work from Home', value: `${(emp.wfhPct * 100).toFixed(0)}%`, color: '#a78bfa' },
                    ownerBurden != null && { label: `Owner (${affYear ?? '—'})`, value: `${(ownerBurden * 100).toFixed(0)}%`, color: ownerBurden > 0.35 ? '#f87171' : '#fbbf24' },
                    renterBurden != null && { label: `Renter (${affYear ?? '—'})`, value: `${(renterBurden * 100).toFixed(0)}%`, color: renterBurden > 0.35 ? '#f87171' : '#4ade80' },
                    vacRate != null && { label: 'Vacancy Rate', value: `${(vacRate * 100).toFixed(1)}%`, color: '#60a5fa' },
                    frRate != null && { label: 'Friction Rate', value: `${(frRate * 100).toFixed(0)}%`, color: frRate > 0.5 ? '#f87171' : '#4ade80' },
                    activeLayer === 'ims' && ims?.[imsCycle]?.ims != null && { label: `IMS (${imsCycle === 'cycle5' ? 'C5' : 'C6'})`, value: ims[imsCycle].ims.toFixed(0), color: '#f97316' },
                ].filter(Boolean);

                if (!stats.length) return null;
                return (
                    <div style={{ display: 'flex', gap: 8, background: 'rgba(255,255,255,0.025)', borderRadius: 8, padding: '8px 14px' }}>
                        {stats.map(({ label, value, color }) => (
                            <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, gap: 2 }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color }}>{value}</span>
                                <span style={{ fontSize: '0.55rem', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.3 }}>{label}</span>
                            </div>
                        ))}
                    </div>
                );
            })()}
        </div>
    );
}
