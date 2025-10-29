import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

type MapPickerProps = {
  latitude: number | null;
  longitude: number | null;
  onChange: (lat: number, lng: number) => void;
  height?: number;
};

// Default center (Accra) when no coords available
const DEFAULT_CENTER: [number, number] = [5.6037, -0.1870];

export function MapPicker({ latitude, longitude, onChange, height = 260 }: MapPickerProps) {
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Ensure default marker icons are visible under Vite bundling
  // (Leaflet's CSS expects these images to be resolvable at runtime)
  // This configuration sets absolute URLs based on the current module location.
  // If the images are already loading correctly, this is a harmless no-op.
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore - accessing internals for icon configuration
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).toString(),
    iconUrl: new URL('leaflet/dist/images/marker-icon.png', import.meta.url).toString(),
    shadowUrl: new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).toString(),
  });

  useEffect(() => {
    if (!containerRef.current) return;
    if (mapRef.current) return; // init once

    const center: [number, number] = [
      typeof latitude === 'number' ? latitude : DEFAULT_CENTER[0],
      typeof longitude === 'number' ? longitude : DEFAULT_CENTER[1],
    ];

    const map = L.map(containerRef.current).setView(center, 13);
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    const marker = L.marker(center, { draggable: true }).addTo(map);
    markerRef.current = marker;

    marker.on('dragend', () => {
      const pos = marker.getLatLng();
      onChange(pos.lat, pos.lng);
    });

    // Allow clicking to place marker
    map.on('click', (e: any) => {
      marker.setLatLng(e.latlng);
      onChange(e.latlng.lat, e.latlng.lng);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  // Update marker if external coords change
  useEffect(() => {
    if (!markerRef.current || !mapRef.current) return;
    if (typeof latitude === 'number' && typeof longitude === 'number') {
      const latlng = L.latLng(latitude, longitude);
      markerRef.current.setLatLng(latlng);
      mapRef.current.setView(latlng);
    }
  }, [latitude, longitude]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: `${height}px`, borderRadius: 8, overflow: 'hidden' }}
    />
  );
}