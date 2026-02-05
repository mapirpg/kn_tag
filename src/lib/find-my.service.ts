import { appleAuthService, AppleAuthService } from './apple-auth.service';
import axios from 'axios';
import * as crypto from 'crypto';
import * as elliptic from 'elliptic';

const ec224 = new elliptic.ec('p224');

export class FindMyService {
  constructor(private appleAuthService: AppleAuthService) {}

  async fetchReports(hashedPublicKey: string, password: string) {
    const anisetteHeaders = await this.appleAuthService.getAnisetteHeaders();
    const authHeaders = this.appleAuthService.getAuthHeaders(password);

    const url = 'https://gateway.icloud.com/searchd/findme/location';

    // Fetch only the last 24 hours to be more reasonable
    const oneDayInMs = 24 * 60 * 60 * 1000;
    const startTime = Date.now() - oneDayInMs;
    const endTime = Date.now();

    const body = {
      search: [
        {
          startDate: startTime,
          endDate: endTime,
          ids: [hashedPublicKey],
        },
      ],
    };

    try {
      const response = await axios.post(url, body, {
        timeout: 20000,
        headers: {
          ...anisetteHeaders,
          ...authHeaders,
          'Content-Type': 'application/json',
          'Accept': '*/*',
          'User-Agent': anisetteHeaders['X-Mme-Client-Info'] || 'FindMy/376 CFNetwork/1240.0.4 Darwin/20.6.0',
          'X-Apple-App-Bundle-Id': 'com.apple.findmy',
          'X-Apple-I-MD-Rinfo': anisetteHeaders['X-Apple-I-MD-Rinfo'],
          'X-Apple-Search-Session-Id': crypto.randomUUID(),
        },
      });

      return response.data.results || [];
    } catch (error: any) {
      if (error.response) {
        console.error('Apple API Error Response:', JSON.stringify(error.response.data, null, 2));
      }
      console.error(
        'Failed to fetch reports from Apple:',
        error.message
      );
      throw error;
    }
  }

  decryptReport(encryptedPayloadBase64: string, privateKeyBase64: string) {
    try {
      const payload = Buffer.from(encryptedPayloadBase64, 'base64');
      const privateKey = Buffer.from(privateKeyBase64, 'base64');

      const ephPubKeyBytes = payload.slice(0, 57);
      const authTag = payload.slice(57, 57 + 16);
      const ciphertext = payload.slice(57 + 16);

      const tagPrivKey = ec224.keyFromPrivate(privateKey);
      const ephPubKey = ec224.keyFromPublic(ephPubKeyBytes);
      const sharedSecret = tagPrivKey.derive(ephPubKey.getPublic());

      const sharedSecretBuffer = Buffer.from(sharedSecret.toArray());

      const kdfOutput = crypto
        .createHash('sha256')
        .update(sharedSecretBuffer)
        .digest();
      const aesKey = kdfOutput.slice(0, 16);

      const decipher = crypto.createDecipheriv(
        'aes-128-gcm',
        aesKey,
        Buffer.alloc(12, 0),
      );
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(ciphertext);
      decrypted = Buffer.concat([decrypted, decipher.final()]);

      const timestamp = decrypted.readUInt32BE(0);
      const latitude = decrypted.readInt32BE(4) / 10000000.0;
      const longitude = decrypted.readInt32BE(8) / 10000000.0;
      const accuracy = decrypted.readUInt8(12);

      return {
        timestamp: new Date(timestamp * 1000),
        latitude,
        longitude,
        accuracy,
      };
    } catch (error: any) {
      console.error('Decryption failed:', error.message);
      return null;
    }
  }
}

export const findMyService = new FindMyService(appleAuthService);
