import axios from 'axios';

export class AppleAuthService {
  async getAnisetteHeaders() {
    const anisetteUrl = process.env.ANISETTE_SERVER_URL;
    if (!anisetteUrl) {
      throw new Error('ANISETTE_SERVER_URL is not defined in .env');
    }
    try {
      const response = await axios.get(anisetteUrl, { timeout: 10000 });
      const data = response.data;

      // Ensure case-insensitive access to data keys
      const getVal = (key: string) => {
        const foundKey = Object.keys(data).find(
          (k) => k.toLowerCase() === key.toLowerCase()
        );
        return foundKey ? data[foundKey] : undefined;
      };

      return {
        'X-Apple-I-MD': getVal('X-Apple-I-MD'),
        'X-Apple-I-MD-M': getVal('X-Apple-I-MD-M'),
        'X-Apple-I-MD-Rinfo': getVal('X-Apple-I-MD-Rinfo') || getVal('X-Apple-I-MD-RINFO'),
        'X-Apple-I-MD-LU': getVal('X-Apple-I-MD-LU'),
        'X-Apple-I-SRL-NO': getVal('X-Apple-I-SRL-NO'),
        'X-Mme-Device-Id': getVal('X-Mme-Device-Id'),
        'X-Apple-I-Client-Time': getVal('X-Apple-I-Client-Time'),
        'X-Apple-I-TimeZone': getVal('X-Apple-I-TimeZone') || 'UTC',
        'X-Apple-Locale': getVal('X-Apple-Locale') || 'en_US',
        'X-Mme-Client-Info': getVal('X-Mme-Client-Info') || getVal('X-MMe-Client-Info'),
      };
    } catch (error: any) {
      console.error('Failed to fetch Anisette headers:', error.message);
      throw new Error(
        'Anisette server unreachable. Please make sure the Docker container is running.',
      );
    }
  }

  getAuthHeaders(password: string) {
    const appleId = (process.env.APPLE_ID || '').replace(/['"]/g, '').trim();
    const auth = Buffer.from(`${appleId}:${password}`).toString('base64');
    return {
      Authorization: `Basic ${auth}`,
    };
  }
}

export const appleAuthService = new AppleAuthService();
