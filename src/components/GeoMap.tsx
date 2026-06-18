import React, { useEffect, useRef } from 'react';
import type { GeodesicResult, CapaGeografica } from '../types';

interface GeoMapProps {
  resultado: GeodesicResult | null;
  capas: CapaGeografica[];
  height?: number;
}

// Leaflet CSS injected once into the document head
let leafletCssInjected = false;
function injectLeafletCss() {
  if (leafletCssInjected || typeof document === 'undefined') return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
  link.crossOrigin = '';
  document.head.appendChild(link);
  leafletCssInjected = true;
}

/**
 * GeoMap — renders geographic layers and ST_Intersection result using Leaflet.
 * Uses CDN for Leaflet to avoid bundle bloat. CartoDB Dark Matter base tile.
 */
const GeoMap: React.FC<GeoMapProps> = ({ resultado, capas, height = 340 }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const layersRef = useRef<any[]>([]);

  useEffect(() => {
    injectLeafletCss();

    const loadLeaflet = async () => {
      if (!containerRef.current) return;

      // Dynamic import: leaflet from npm (installed via package.json)
      let L: any;
      try {
        L = (await import('leaflet')).default || (await import('leaflet'));
      } catch {
        return;
      }

      // Fix Leaflet default icon paths in Vite environment
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      // Initialize map if not already done
      if (!mapRef.current) {
        mapRef.current = L.map(containerRef.current, {
          center: [-20.5, -65.0], // Bolivia center (Tarija region)
          zoom: 7,
          zoomControl: true,
          attributionControl: true
        });

        // CartoDB Dark Matter base layer (free, no key needed)
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
          subdomains: 'abcd',
          maxZoom: 19
        }).addTo(mapRef.current);
      }

      // Remove existing overlay layers
      layersRef.current.forEach(layer => {
        if (mapRef.current) mapRef.current.removeLayer(layer);
      });
      layersRef.current = [];

      // Add intersection result layer (top priority)
      if (resultado?.intersectionGeoJSON) {
        try {
          const geoData = JSON.parse(resultado.intersectionGeoJSON);
          const intersectionLayer = L.geoJSON(geoData, {
            style: {
              color: '#ef4444',
              fillColor: getRiskColor(resultado.nivelRiesgo),
              fillOpacity: 0.55,
              weight: 2,
              dashArray: '3, 4'
            }
          }).addTo(mapRef.current);

          layersRef.current.push(intersectionLayer);

          // Fit map to intersection result bounds
          try {
            const bounds = intersectionLayer.getBounds();
            if (bounds.isValid()) {
              mapRef.current.fitBounds(bounds, { padding: [30, 30] });
            }
          } catch { /* bounds may not be valid for all geometries */ }
        } catch { /* invalid GeoJSON, skip */ }
      }
    };

    loadLeaflet();

    return () => {
      // Cleanup on unmount
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []); // initialize only once

  // Update layers when resultado changes without remounting map
  useEffect(() => {
    const updateLayers = async () => {
      if (!mapRef.current) return;
      let L: any;
      try {
        L = (await import('leaflet')).default || (await import('leaflet'));
      } catch { return; }

      // Remove old overlays
      layersRef.current.forEach(layer => mapRef.current?.removeLayer(layer));
      layersRef.current = [];

      if (resultado?.intersectionGeoJSON) {
        try {
          const geoData = JSON.parse(resultado.intersectionGeoJSON);
          const layer = L.geoJSON(geoData, {
            style: {
              color: '#dc2626',
              fillColor: getRiskColor(resultado.nivelRiesgo),
              fillOpacity: 0.5,
              weight: 2.5,
            }
          });
          layer.bindPopup(`
            <div style="font-family: monospace; font-size: 12px; line-height: 1.6">
              <b>🗺 ST_Intersection Result</b><br/>
              Área: <b>${resultado.areaInterseccionKm2.toFixed(2)} km²</b><br/>
              Afectación: <b>${resultado.porcentajeAfectacion.toFixed(1)}%</b><br/>
              Nivel Riesgo: <b style="color: ${getRiskColor(resultado.nivelRiesgo)}">${resultado.nivelRiesgo}</b><br/>
              SRID: EPSG:4326
            </div>
          `);
          layer.addTo(mapRef.current);
          layersRef.current.push(layer);

          try {
            const bounds = layer.getBounds();
            if (bounds.isValid()) {
              mapRef.current.fitBounds(bounds, { padding: [40, 40] });
            }
          } catch { /* non-fatal */ }
        } catch { /* invalid GeoJSON */ }
      }
    };

    updateLayers();
  }, [resultado]);

  return (
    <div className="geo-map-wrapper" style={{ position: 'relative' }}>
      <div
        ref={containerRef}
        style={{ height: `${height}px`, width: '100%', borderRadius: '10px', overflow: 'hidden' }}
      />
      {/* Legend overlay */}
      {resultado && (
        <div style={{
          position: 'absolute',
          bottom: 12,
          left: 12,
          background: 'rgba(10, 14, 26, 0.88)',
          backdropFilter: 'blur(8px)',
          borderRadius: 8,
          padding: '8px 12px',
          border: '1px solid rgba(255,255,255,0.1)',
          fontSize: 11,
          color: '#e2e8f0',
          zIndex: 1000,
          pointerEvents: 'none'
        }}>
          <div style={{ fontWeight: 700, marginBottom: 4, letterSpacing: '0.05em', textTransform: 'uppercase', fontSize: 10, color: '#94a3b8' }}>
            Leyenda
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 12, height: 12, background: getRiskColor(resultado.nivelRiesgo), borderRadius: 2, opacity: 0.8 }} />
            <span>Intersección ST — Nivel {resultado.nivelRiesgo}</span>
          </div>
          <div style={{ marginTop: 4, color: '#64748b', fontSize: 10 }}>EPSG:4326 | UTM 20S para áreas</div>
        </div>
      )}
      {!resultado && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(10, 14, 26, 0.55)',
          borderRadius: 10,
          pointerEvents: 'none',
          zIndex: 1000
        }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🗺</div>
          <div style={{ color: '#94a3b8', fontSize: 13, fontWeight: 500 }}>
            Ejecute el cruce ST_Intersection para visualizar el resultado geográfico
          </div>
          <div style={{ color: '#64748b', fontSize: 11, marginTop: 4 }}>
            {capas.length === 0 ? 'Sin capas cargadas' : `${capas.length} capa(s) cargadas`}
          </div>
        </div>
      )}
    </div>
  );
};

function getRiskColor(nivel: string): string {
  const colors: Record<string, string> = {
    'BAJO': '#22c55e',
    'MODERADO': '#eab308',
    'ALTO': '#f97316',
    'CRÍTICO': '#ef4444'
  };
  return colors[nivel] || '#6366f1';
}

export default GeoMap;
