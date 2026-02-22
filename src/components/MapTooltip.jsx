import React from 'react';

const MapTooltip = ({ data, position, forceVisible }) => {
    // Determine if cursor is too close to right or bottom edges
    // position.x/y is clientX/clientY, so it's relative to the entire viewport, including the sidebar 
    const isNearRightEdge = position.x > window.innerWidth - 300;
    const isNearBottomEdge = position.y > window.innerHeight - 250;

    // Shift tooltip to the left if near right edge, otherwise put it to the right
    const xTransform = isNearRightEdge ? '-100%' : '0%';
    const xOffset = isNearRightEdge ? -350 : -500;

    // Shift tooltip up if near bottom edge, otherwise put it down
    const yTransform = isNearBottomEdge ? '-100%' : '0%';
    const yOffset = isNearBottomEdge ? -100 : 40;

    return (
        <div
            className={`map-tooltip ${data || forceVisible ? 'visible' : ''}`}
            style={{
                left: `${position.x + xOffset}px`,
                top: `${position.y + yOffset}px`,
                transform: `translate(${xTransform}, ${yTransform})`
            }}
        >
            {data && (
                <>
                    <div className="tooltip-title">{data.name}</div>
                    <div className="tooltip-data-row">
                        <span className="tooltip-data-label">Region Type:</span>
                        <span className="tooltip-data-value">{data.type}</span>
                    </div>
                    <div className="tooltip-data-row">
                        <span className="tooltip-data-label">Metrics:</span>
                        <span className="tooltip-data-value" style={{ color: 'var(--text-muted)' }}>Pending Data</span>
                    </div>
                </>
            )}
        </div>
    );
};

export default MapTooltip;
