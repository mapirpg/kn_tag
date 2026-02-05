import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class AppleAuthService {
  private readonly logger = new Logger(AppleAuthService.name);

  constructor(private configService: ConfigService) {}

  async getAnisetteHeaders() {
    const anisetteUrl = this.configService.get<string>('ANISETTE_SERVER_URL');
    if (!anisetteUrl) {
      throw new Error('ANISETTE_SERVER_URL is not defined in .env');
    }
    try {
      const response = await axios.get(anisetteUrl);
      const data = response.data;

      return {
        'X-Apple-I-MD': data['X-Apple-I-MD'],
        'X-Apple-I-MD-M': data['X-Apple-I-MD-M'],
        'X-Apple-I-MD-RLU': data['X-Apple-I-MD-RLU'],
        'X-Apple-I-MD-LU': data['X-Apple-I-MD-LU'],
        'X-Apple-I-SRL-NO': data['X-Apple-I-SRL-NO'],
        'X-Apple-I-TimeZone': 'UTC',
        'X-Apple-Locale': 'en_US',
        'X-Mme-Client-Info':
          '<iPhone13,2> <iPhone OS;14.8.1;18H107> <com.apple.icloud.searchd/1.0 (com.apple.findmy/1.0)>',
      };
    } catch (error) {
      this.logger.error('Failed to fetch Anisette headers:', error.message);
      throw new Error(
        'Anisette server unreachable. Please make sure the Docker container is running.',
      );
    }
  }

  // To fetch reports, we might need a session token or auth headers.
  // For Macless Haystack, usually we use a specific authorization header.
  getAuthHeaders(password: string) {
    const appleId = this.configService.get<string>('APPLE_ID');
    const auth = Buffer.from(`${appleId}:${password}`).toString('base64');
    return {
      Authorization: `Basic ${auth}`,
    };
  }
}
