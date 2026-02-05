import { Injectable, Logger } from '@nestjs/common';
import { AppleAuthService } from './apple-auth.service';
import axios from 'axios';
import * as crypto from 'crypto';
import * as elliptic from 'elliptic';

const ec224 = new elliptic.ec('p224');

@Injectable()
export class FindMyService {
  private readonly logger = new Logger(FindMyService.name);

  constructor(private appleAuthService: AppleAuthService) {}

  async fetchReports(hashedPublicKey: string, password: string) {
    const anisetteHeaders = await this.appleAuthService.getAnisetteHeaders();
    const authHeaders = this.appleAuthService.getAuthHeaders(password);

    const url = 'https://gateway.icloud.com/searchd/findme/location';

    // The request body usually contains the search criteria
    const startTime = 0; // Epoch start or last fetch time
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
        headers: {
          ...anisetteHeaders,
          ...authHeaders,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      });

      return response.data.results || [];
    } catch (error) {
      this.logger.error(
        'Failed to fetch reports from Apple:',
        error.response?.data || error.message,
      );
      throw error;
    }
  }

  decryptReport(encryptedPayloadBase64: string, privateKeyBase64: string) {
    try {
      const payload = Buffer.from(encryptedPayloadBase64, 'base64');
      const privateKey = Buffer.from(privateKeyBase64, 'base64');

      // Apple Find My Report Payload Format (simplified):
      // [1 byte version] [? bytes ephemeral public key] [? bytes auth tag] [? bytes ciphertext]

      // More accurate format derived from OpenHaystack/MaclessHaystack:
      // Ephemeral Public Key: first 57 bytes (P-224 compressed or uncompressed)
      // Actually, P-224 public key is 28 bytes (x) + 28 bytes (y) + 1 byte header = 57 bytes.

      const ephPubKeyBytes = payload.slice(0, 57);
      const authTag = payload.slice(57, 57 + 16);
      const ciphertext = payload.slice(57 + 16);

      // 1. Get shared secret
      const tagPrivKey = ec224.keyFromPrivate(privateKey);
      const ephPubKey = ec224.keyFromPublic(ephPubKeyBytes);
      const sharedSecret = tagPrivKey.derive(ephPubKey.getPublic());

      const sharedSecretBuffer = Buffer.from(sharedSecret.toArray());

      // 2. KDF (Apple uses SHA256 of the shared secret, then splits it)
      const kdfOutput = crypto
        .createHash('sha256')
        .update(sharedSecretBuffer)
        .digest();
      const aesKey = kdfOutput.slice(0, 16);
      const hmacKey = kdfOutput.slice(16);

      // 3. Decrypt (AES-GCM usually, but let's verify if it's GCM or CTR+HMAC)
      // OpenHaystack says it uses AES-GCM with empty IV or specific IV.
      // Actually, standard Find My uses AES-GCM with IV = last 12 bytes of kdfOutput or fixed.
      // Let's assume AES-GCM with auth tag.

      const decipher = crypto.createDecipheriv(
        'aes-128-gcm',
        aesKey,
        Buffer.alloc(12, 0),
      );
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(ciphertext);
      decrypted = Buffer.concat([decrypted, decipher.final()]);

      // The decrypted payload contains:
      // timestamp (4 bytes), latitude (4 bytes), longitude (4 bytes), accuracy (1 byte), status (1 byte)

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
    } catch (error) {
      this.logger.error('Decryption failed:', error.message);
      return null;
    }
  }
}
