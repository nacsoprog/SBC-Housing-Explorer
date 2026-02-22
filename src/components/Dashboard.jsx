import React, { useState } from 'react';
import { Layers } from 'lucide-react';
import SantaBarbaraMap from './SantaBarbaraMap';

const Dashboard = () => {
    const [activeLayer, setActiveLayer] = useState('permits');
    return (
        <div className="app-container">

            <aside className="sidebar glass-panel">
                <div className="sidebar-header">
                    <h1 className="heading-main">Santa Barbara</h1>
                    <p className="text-subtitle">Housing & Demographics Explorer</p>
                </div>

                <div className="layer-controls" style={{ marginTop: '24px' }}>
                    <h2 style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Layers size={14} /> Map Layers
                    </h2>

                    <div className="layer-options" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <button
                            className={`layer-btn ${activeLayer === 'none' ? 'active' : ''}`}
                            onClick={() => setActiveLayer('none')}
                        >
                            Base Map Only
                        </button>
                        <button
                            className={`layer-btn ${activeLayer === 'permits' ? 'active' : ''}`}
                            onClick={() => setActiveLayer('permits')}
                        >
                            Total Building Permits
                        </button>
                    </div>
                </div>
            </aside>

            <main className="map-container glass-panel">
                <SantaBarbaraMap activeLayer={activeLayer} />
            </main>
        </div>
    );
};

export default Dashboard;
