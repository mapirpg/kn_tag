export interface Location {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: string;
}

export interface Tag {
  id: string;
  name: string;
  publicKey: string;
  privateKey: string;
  hashedPublicKey: string;
  locations: Location[];
}