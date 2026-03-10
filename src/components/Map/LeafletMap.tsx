import { MapContainer, TileLayer } from 'react-leaflet';

export default function LeafletMap() {
  return (
    <MapContainer
      center={[-23.5505, -46.6333]}
      zoom={15}
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
    </MapContainer>
  );
}
