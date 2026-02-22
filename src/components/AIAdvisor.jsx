import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Building2, User, Send, X, Loader2, Zap } from 'lucide-react';

const API = 'http://localhost:8000';

const CYAN = '#3ce1e7';
const CYAN_BORDER = 'rgba(125,212,239,0.35)';
const CYAN_BG = 'rgba(60,225,231,0.08)';

const cardStyle = {
    background: 'rgba(255,255,255,0.04)',
    border: `1px solid ${CYAN_BORDER}`,
    borderRadius: '10px',
    padding: '14px',
};

function WorkforceBadge({ text }) {
    if (!text) return null;
    return (
        <div style={{
            background: 'rgba(139,92,246,0.08)',
            border: '1px solid rgba(139,92,246,0.2)',
            borderRadius: '8px', padding: '10px 12px', marginTop: '10px',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '5px' }}>
                <Zap size={11} color="#a78bfa" />
                <span style={{
                    color: '#a78bfa', fontSize: '0.62rem', fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '0.08em'
                }}>
                    Live Workforce Signal
                </span>
            </div>
            <p style={{
                color: 'var(--text-muted)', fontSize: '0.72rem', lineHeight: 1.55,
                whiteSpace: 'pre-line', margin: 0
            }}>{text}</p>
        </div>
    );
}

function PlacePills({ places }) {
    if (!places?.length) return null;
    return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '10px' }}>
            <span style={{
                color: 'var(--text-muted)', fontSize: '0.62rem',
                width: '100%', textTransform: 'uppercase', letterSpacing: '0.05em'
            }}>
                Data retrieved from:
            </span>
            {places.map(p => (
                <span key={p} style={{
                    background: 'rgba(255,255,255,0.06)', borderRadius: '4px',
                    padding: '2px 8px', fontSize: '0.7rem', color: 'var(--text-secondary)',
                }}>{p}</span>
            ))}
        </div>
    );
}

function AnswerBlock({ result, mode }) {
    if (!result) return null;
    const accentColor = mode === 'build' ? '#a78bfa' : '#4ade80';
    const signal = result.workforce_summary || result.workforce_signal || '';

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            <div style={{ ...cardStyle, borderBottom: 'none', borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: accentColor }} />
                    <span style={{
                        color: 'var(--text-muted)', fontSize: '0.65rem',
                        textTransform: 'uppercase', letterSpacing: '0.06em'
                    }}>AI Recommendation</span>
                </div>
                <p style={{
                    color: 'var(--text-primary)', fontSize: '0.82rem',
                    lineHeight: 1.72, whiteSpace: 'pre-wrap', margin: 0
                }}>
                    {result.answer}
                </p>
            </div>
            <div style={{
                ...cardStyle,
                borderTop: 'none', borderTopLeftRadius: 0, borderTopRightRadius: 0,
                borderColor: 'rgba(255,255,255,0.08)',
            }}>
                {result.monthly_budget && (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginBottom: '8px' }}>
                        Budget used: <strong style={{ color: accentColor }}>${result.monthly_budget.toLocaleString()}/mo</strong> (30% of income)
                    </p>
                )}
                <WorkforceBadge text={signal} />
                <PlacePills places={result.retrieved_places} />
                <div style={{ marginTop: '10px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {['Groq · Llama 3.3 70B', 'RapidFire AI · RAG', 'Live Data Technologies'].map(l => (
                        <span key={l} style={{
                            background: 'rgba(255,255,255,0.04)', borderRadius: '3px',
                            padding: '1px 6px', fontSize: '0.58rem', color: 'var(--text-muted)',
                        }}>{l}</span>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default function AIAdvisor({ isOpen, onClose }) {
    const [mode, setMode] = useState('build');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    // Build advisor state
    const [question, setQuestion] = useState('');

    // Worker match state
    const [jobTitle, setJobTitle] = useState('');
    const [income, setIncome] = useState('');

    const bottomRef = useRef(null);

    useEffect(() => {
        if (result) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [result]);

    useEffect(() => {
        setResult(null);
        setError(null);
    }, [mode]);

    const askBuild = async () => {
        if (!question.trim()) return;
        setLoading(true); setResult(null); setError(null);
        try {
            const resp = await fetch(`${API}/api/build-advisor`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question }),
            });
            if (!resp.ok) throw new Error(`Server error ${resp.status}`);
            setResult(await resp.json());
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const askWorker = async () => {
        if (!jobTitle.trim() || !income) return;
        setLoading(true); setResult(null); setError(null);
        try {
            const resp = await fetch(`${API}/api/worker-match`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ job_title: jobTitle, annual_income: parseFloat(income) }),
            });
            if (!resp.ok) throw new Error(`Server error ${resp.status}`);
            setResult(await resp.json());
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const BUILD_PROMPTS = [
        'Where should the county build workforce housing for healthcare workers?',
        'Which communities have high housing need but low construction friction?',
        'Where is there the greatest mismatch between jobs and housing supply?',
    ];

    return (
        <div style={{
            position: 'fixed', right: 0, top: 0, bottom: 0, width: '440px',
            background: 'linear-gradient(180deg, #0f1117 0%, #0a0d14 100%)',
            borderLeft: '1px solid rgba(255,255,255,0.1)',
            zIndex: 1000, display: 'flex', flexDirection: 'column',
            fontFamily: 'inherit',
        }}>
            {/* Header */}
            <div style={{
                padding: '18px 20px 14px',
                borderBottom: '1px solid rgba(255,255,255,0.07)',
                flexShrink: 0,
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                            width: '28px', height: '28px', borderRadius: '8px',
                            background: CYAN_BG,
                            border: `1px solid ${CYAN_BORDER}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <MessageSquare size={14} color={CYAN} />
                        </div>
                        <div>
                            <p style={{ margin: 0, color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.92rem' }}>
                                AI Housing Advisor
                            </p>
                            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.64rem' }}>
                                Powered by Groq + Live Data Technologies
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{
                        background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: '6px',
                        width: '28px', height: '28px', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'var(--text-muted)',
                    }}>
                        <X size={14} />
                    </button>
                </div>

                {/* Mode tabs */}
                <div style={{
                    display: 'flex', background: 'rgba(255,255,255,0.05)',
                    borderRadius: '8px', padding: '3px', gap: '3px', marginTop: '12px',
                }}>
                    {[
                        { key: 'build', label: 'Where to Build', Icon: Building2 },
                        { key: 'worker', label: 'Match a Worker', Icon: User },
                    ].map(({ key, label, Icon }) => (
                        <button key={key} onClick={() => setMode(key)} style={{
                            flex: 1, padding: '7px 6px', borderRadius: '6px',
                            border: mode === key ? `1px solid ${CYAN_BORDER}` : '1px solid transparent',
                            cursor: 'pointer', fontSize: '0.75rem', fontWeight: mode === key ? 700 : 400,
                            background: mode === key ? CYAN_BG : 'transparent',
                            color: mode === key ? CYAN : 'var(--text-muted)',
                            transition: 'all 0.15s',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                        }}>
                            <Icon size={12} /> {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Scrollable content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

                {/* Build Advisor */}
                {mode === 'build' && (
                    <>
                        <p style={{ color: '#ffffff', fontSize: '0.78rem', lineHeight: 1.55, margin: 0 }}>
                            Ask where Santa Barbara County should prioritize new housing construction,
                            what types to build, and which communities have the greatest need.
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <span style={{
                                color: CYAN, fontSize: '0.64rem', fontWeight: 600,
                                textTransform: 'uppercase', letterSpacing: '0.08em',
                                opacity: 0.8,
                            }}>Pre-made questions</span>
                            {BUILD_PROMPTS.map(p => (
                                <button key={p} onClick={() => setQuestion(p)} style={{
                                    background: CYAN_BG,
                                    border: `1px solid ${CYAN_BORDER}`,
                                    borderRadius: '7px', padding: '8px 12px', cursor: 'pointer',
                                    color: '#e0f7fa', fontSize: '0.72rem', textAlign: 'left',
                                    transition: 'background 0.15s',
                                }}>
                                    {p}
                                </button>
                            ))}
                        </div>
                        <textarea
                            value={question}
                            onChange={e => setQuestion(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) askBuild(); }}
                            placeholder="Or type your own question…"
                            rows={3}
                            style={{
                                background: 'rgba(255,255,255,0.04)',
                                border: `1px solid ${CYAN_BORDER}`,
                                borderRadius: '8px', padding: '10px 12px',
                                color: 'var(--text-primary)', fontSize: '0.82rem',
                                resize: 'vertical', fontFamily: 'inherit', outline: 'none',
                            }}
                        />
                        <button
                            onClick={askBuild}
                            disabled={!question.trim() || loading}
                            style={{
                                background: loading ? CYAN_BG : 'rgba(60,225,231,0.18)',
                                border: `1px solid ${CYAN_BORDER}`,
                                borderRadius: '8px', padding: '10px', cursor: question.trim() && !loading ? 'pointer' : 'not-allowed',
                                color: CYAN, fontWeight: 700, fontSize: '0.82rem',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
                                transition: 'all 0.2s',
                            }}
                        >
                            {loading ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Analyzing…</> : <><Send size={13} /> Ask the Advisor</>}
                        </button>
                    </>
                )}

                {/* Worker Match */}
                {mode === 'worker' && (
                    <>
                        <p style={{ color: '#ffffff', fontSize: '0.78rem', lineHeight: 1.55, margin: 0 }}>
                            Enter your job title and income. We'll cross-reference housing
                            cost burden, vacancy rates, and real workforce data to find
                            where you can realistically afford to live in Santa Barbara County.
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ color: CYAN, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.8 }}>
                                Job Title
                            </label>
                            <input
                                value={jobTitle}
                                onChange={e => setJobTitle(e.target.value)}
                                placeholder="e.g. Registered Nurse, Teacher, Software Engineer"
                                style={{
                                    background: 'rgba(255,255,255,0.04)',
                                    border: `1px solid ${CYAN_BORDER}`,
                                    borderRadius: '8px', padding: '10px 12px',
                                    color: 'var(--text-primary)', fontSize: '0.82rem',
                                    fontFamily: 'inherit', outline: 'none',
                                }}
                            />
                            <label style={{ color: CYAN, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '4px', opacity: 0.8 }}>
                                Annual Income (USD)
                            </label>
                            <input
                                value={income}
                                onChange={e => setIncome(e.target.value)}
                                placeholder="e.g. 75000"
                                type="number"
                                min="1"
                                style={{
                                    background: 'rgba(255,255,255,0.04)',
                                    border: `1px solid ${CYAN_BORDER}`,
                                    borderRadius: '8px', padding: '10px 12px',
                                    color: 'var(--text-primary)', fontSize: '0.82rem',
                                    fontFamily: 'inherit', outline: 'none',
                                }}
                            />
                            {income && parseFloat(income) > 0 && (
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem', margin: 0 }}>
                                    Max monthly housing budget (30% rule):{' '}
                                    <strong style={{ color: '#4ade80' }}>
                                        ${Math.round(parseFloat(income) * 0.30 / 12).toLocaleString()}/mo
                                    </strong>
                                </p>
                            )}
                        </div>
                        <button
                            onClick={askWorker}
                            disabled={!jobTitle.trim() || !income || loading}
                            style={{
                                background: loading ? CYAN_BG : 'rgba(60,225,231,0.18)',
                                border: `1px solid ${CYAN_BORDER}`,
                                borderRadius: '8px', padding: '10px', cursor: jobTitle && income && !loading ? 'pointer' : 'not-allowed',
                                color: CYAN, fontWeight: 700, fontSize: '0.82rem',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
                                transition: 'all 0.2s',
                            }}
                        >
                            {loading ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Finding matches…</> : <><User size={13} /> Find My Match</>}
                        </button>
                    </>
                )}

                {/* Error state */}
                {error && (
                    <div style={{
                        background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
                        borderRadius: '8px', padding: '12px',
                        color: '#f87171', fontSize: '0.78rem',
                    }}>
                        <strong>Error:</strong> {error}
                        <br />
                        <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>
                            Make sure the backend is running: <code>uvicorn main:app --reload --port 8000</code>
                        </span>
                    </div>
                )}

                {/* Answer */}
                <AnswerBlock result={result} mode={mode} />

                <div ref={bottomRef} />
            </div>

            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}
