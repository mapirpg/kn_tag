import { appleAuthService, AppleAuthService } from './apple-auth.service';
import axios from 'axios';
import * as crypto from 'crypto';
import * as elliptic from 'elliptic';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

const ec224 = new elliptic.ec('p224');
const execAsync = promisify(exec);

export class FindMyService {
  constructor(private appleAuthService: AppleAuthService) {}

  private parseBridgeOutput(stdout: string, stderr: string) {
    const trimmedStdout = stdout.trim();
    const marker = '---JSON_START---';
    const markerIndex = trimmedStdout.lastIndexOf(marker);
    const jsonPayload = markerIndex >= 0
      ? trimmedStdout.slice(markerIndex + marker.length).trim()
      : trimmedStdout.split(/\r?\n/).reverse().find((line) => line.trim().startsWith('{'))?.trim();

    if (!jsonPayload) {
      const details = [trimmedStdout, stderr.trim()].filter(Boolean).join('\n');
      throw new Error(details || 'Python bridge returned no JSON payload.');
    }

    try {
      return JSON.parse(jsonPayload);
    } catch {
      throw new Error(`Invalid bridge JSON payload: ${jsonPayload}`);
    }
  }

  async fetchReports(hashedPublicKey: string) {
    const appleId = (process.env.APPLE_ID || '').replace(/['"]/, '').trim();
    const password = (process.env.APPLE_PASSWORD || '').replace(/['"]/, '').trim();
    const anisetteUrl = process.env.ANISETTE_SERVER_URL || 'http://127.0.0.1:6970';

    if (!password) {
      throw new Error('APPLE_PASSWORD não está definido no .env');
    }

    // Path to the python bridge script
    const scriptPath = path.join(process.cwd(), 'src', 'lib', 'scripts', 'findmy_bridge.py');
    
    try {
      // Execute the python script
      // We use base64 for public key to avoid shell issues, findmy_bridge.py handles it
      const cmd = `"${process.env.PYTHON_BIN || 'python3'}" "${scriptPath}" "${appleId}" "${password}" "${anisetteUrl}" "${hashedPublicKey}"`;
      
      console.log('Executing FindMy bridge...');
      const { stdout, stderr } = await execAsync(cmd);

      if (stderr && !stdout) {
        console.error('Bridge Stderr:', stderr);
        throw new Error(`Bridge Error: ${stderr}`);
      }

      const result = this.parseBridgeOutput(stdout, stderr);
      
      if (result.status === 'error') {
        throw new Error(result.message);
      }

      return result.reports || [];
    } catch (error: any) {
      console.error('Failed to fetch reports via Python bridge:', error.message);
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
