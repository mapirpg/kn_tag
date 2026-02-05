import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet"
import { Tag } from "../types";

interface MapProps {
  tags: Tag[];
}

export const Map = ({
  tags
}: MapProps) => {

  const latestLocation = tags.flatMap(t => t.locations)[0];

  return (
    <main className="flex-1 p-6 relative">
      <MapContainer
        center={latestLocation ? [latestLocation.latitude, latestLocation.longitude] : [-23.5505, -46.6333]} 
        zoom={13} 
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {tags.map(tag => tag.locations?.[0] && (
          <Marker key={tag.id} position={[tag.locations[0].latitude, tag.locations[0].longitude]}>
            <Popup>
              <div className="p-2">
                <div className="font-bold text-slate-900">{tag.name}</div>
                <div className="text-xs text-slate-600">Accuracy: {tag.locations[0].accuracy}m</div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </main>
  )
}