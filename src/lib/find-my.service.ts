import { appleAuthService, AppleAuthService } from './apple-auth.service';
import axios from 'axios';
import * as crypto from 'crypto';
import * as elliptic from 'elliptic';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

const ec224 = new elliptic.ec('p224');
const execAsync = promisify(exec);
const HEX_RE = /^[0-9a-fA-F]+$/;

export class FindMyService {
  constructor(private appleAuthService: AppleAuthService) {}

  private decodeInput(value: string) {
    const normalized = (value || '').trim();
    const isHex = normalized.length % 2 === 0 && HEX_RE.test(normalized);
    return {
      bytes: Buffer.from(normalized, isHex ? 'hex' : 'base64'),
      encoding: isHex ? 'hex' : 'base64',
    };
  }

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

  private decryptWithParams(
    payload: Buffer,
    privateKey: Buffer,
    ephOffset: number,
    ephLen: number,
    authTagAtEnd: boolean,
  ) {
    const ephEnd = ephOffset + ephLen;
    if (ephEnd + 17 > payload.length) {
      throw new Error(`payload too short for ephOffset=${ephOffset} ephLen=${ephLen}`);
    }

    const ephPubKeyBytes = payload.slice(ephOffset, ephEnd);

    const afterEph = payload.slice(ephEnd);
    const authTag = authTagAtEnd ? afterEph.slice(-16) : afterEph.slice(0, 16);
    const ciphertext = authTagAtEnd ? afterEph.slice(0, -16) : afterEph.slice(16);

    if (ciphertext.length < 1) {
      throw new Error(`ciphertext too short (${ciphertext.length})`);
    }

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

    return decrypted;
  }

  async fetchReports(hashedPublicKey: string) {
    const startedAt = Date.now();
    const appleId = (process.env.APPLE_ID || '').replace(/['"]/, '').trim();
    const password = (process.env.APPLE_PASSWORD || '').replace(/['"]/, '').trim();
    const anisetteUrl = process.env.ANISETTE_SERVER_URL || 'http://127.0.0.1:6970';
    const pythonBin = process.env.PYTHON_BIN || 'python3';

    console.log(
      `[findmy.service] fetchReports start appleId=${appleId ? `${appleId.slice(0, 3)}***` : 'missing'} anisetteUrl=${anisetteUrl} hashedPrefix=${hashedPublicKey.slice(0, 8)}...`,
    );

    if (!password) {
      throw new Error('APPLE_PASSWORD não está definido no .env');
    }

    // Path to the python bridge script
    const scriptPath = path.join(process.cwd(), 'src', 'lib', 'scripts', 'findmy_bridge.py');
    
    try {
      // Execute the python script
      // We use base64 for public key to avoid shell issues, findmy_bridge.py handles it
      const cmd = `"${pythonBin}" "${scriptPath}" "${appleId}" "${password}" "${anisetteUrl}" "${hashedPublicKey}"`;
      
      console.log(`[findmy.service] executing bridge pythonBin=${pythonBin} scriptPath=${scriptPath}`);
      const { stdout, stderr } = await execAsync(cmd, {
        timeout: 120000,
        maxBuffer: 10 * 1024 * 1024,
      });

      console.log(
        `[findmy.service] bridge finished durationMs=${Date.now() - startedAt} stdoutLen=${stdout.length} stderrLen=${stderr.length}`,
      );

      if (process.env.FINDMY_LOG_RAW === '1') {
        console.log(`[findmy.service] bridge raw stdout begin\n${stdout}\n[findmy.service] bridge raw stdout end`);
      }

      if (stderr && !stdout) {
        console.error('Bridge Stderr:', stderr);
        throw new Error(`Bridge Error: ${stderr}`);
      }

      const result = this.parseBridgeOutput(stdout, stderr);
      
      if (result.status === 'error') {
        console.error(`[findmy.service] bridge returned error message=${result.message}`);
        throw new Error(result.message);
      }

      const reports = result.reports || [];
      console.log(`[findmy.service] fetchReports success reports=${reports.length}`);

      for (let i = 0; i < Math.min(3, reports.length); i += 1) {
        try {
          const payloadDecoded = this.decodeInput(reports[i]?.payload || '');
          const firstByteHex = payloadDecoded.bytes.length > 0
            ? payloadDecoded.bytes[0].toString(16).padStart(2, '0')
            : 'na';
          console.log(
            `[findmy.service] rawReport sample index=${i} payloadEncoding=${payloadDecoded.encoding} payloadLen=${payloadDecoded.bytes.length} firstByte=0x${firstByteHex} payloadPrefix=${(reports[i]?.payload || '').slice(0, 40)} timestamp=${reports[i]?.timestamp || 'na'}`,
          );
        } catch (sampleError: any) {
          console.warn(`[findmy.service] rawReport sample parse failed index=${i} reason=${sampleError?.message}`);
        }
      }

      return reports;
    } catch (error: any) {
      if (error?.killed || error?.signal === 'SIGTERM') {
        console.error('[findmy.service] bridge timeout after 120000ms');
        throw new Error('FindMy bridge timeout: o processo excedeu 120s. Verifique 2FA/sessao da Apple.');
      }
      console.error('Failed to fetch reports via Python bridge:', error.message);
      throw error;
    }
  }

  decryptReport(encryptedPayloadBase64: string, privateKeyBase64: string, reportTimestamp?: string) {
    try {
      const payloadDecoded = this.decodeInput(encryptedPayloadBase64);
      const privateKeyDecoded = this.decodeInput(privateKeyBase64);
      const payload = payloadDecoded.bytes;
      const privateKey = privateKeyDecoded.bytes;

      if (payload.length < 74) {
        throw new Error(`Invalid payload length: ${payload.length} (encoding=${payloadDecoded.encoding})`);
      }

      const attempts: Array<{ ephOffset: number; ephLen: number; authTagAtEnd: boolean }> = [];

      // Macless/OpenHaystack payloads commonly carry a 5-byte header before the ephemeral key.
      if (payload.length > 62 && payload[5] === 0x04) {
        attempts.push({ ephOffset: 5, ephLen: 57, authTagAtEnd: true });
        attempts.push({ ephOffset: 5, ephLen: 57, authTagAtEnd: false });
      }

      const firstBytesToScan = Math.min(payload.length, 16);

      for (let offset = 0; offset < firstBytesToScan; offset += 1) {
        const marker = payload[offset];
        if (marker === 0x04) attempts.push({ ephOffset: offset, ephLen: 57, authTagAtEnd: false });
        if (marker === 0x04) attempts.push({ ephOffset: offset, ephLen: 57, authTagAtEnd: true });
        if (marker === 0x02 || marker === 0x03) attempts.push({ ephOffset: offset, ephLen: 29, authTagAtEnd: false });
        if (marker === 0x02 || marker === 0x03) attempts.push({ ephOffset: offset, ephLen: 29, authTagAtEnd: true });
      }

      if (attempts.length === 0) {
        attempts.push({ ephOffset: 0, ephLen: 57, authTagAtEnd: false });
        attempts.push({ ephOffset: 0, ephLen: 57, authTagAtEnd: true });
      }

      let lastError: string | null = null;
      for (const attempt of attempts) {
        try {
          const decrypted = this.decryptWithParams(
            payload,
            privateKey,
            attempt.ephOffset,
            attempt.ephLen,
            attempt.authTagAtEnd,
          );

          let timestamp = reportTimestamp ? new Date(reportTimestamp) : new Date();
          if (Number.isNaN(timestamp.getTime()) && decrypted.length >= 4) {
            timestamp = new Date(decrypted.readUInt32BE(0) * 1000);
          }

          // Format A (legacy parser): [ts(4) lat(4) lon(4) acc(1)]
          if (decrypted.length >= 13) {
            return {
              timestamp,
              latitude: decrypted.readInt32BE(4) / 10000000.0,
              longitude: decrypted.readInt32BE(8) / 10000000.0,
              accuracy: decrypted.readUInt8(12),
            };
          }

          // Format B (short payload used by some beacons): [lat(4) lon(4) acc(1)]
          if (decrypted.length >= 9) {
            return {
              timestamp,
              latitude: decrypted.readInt32BE(0) / 10000000.0,
              longitude: decrypted.readInt32BE(4) / 10000000.0,
              accuracy: decrypted.readUInt8(8),
            };
          }

          // Format C (minimal): [lat(4) lon(4)] with unknown accuracy.
          if (decrypted.length >= 8) {
            return {
              timestamp,
              latitude: decrypted.readInt32BE(0) / 10000000.0,
              longitude: decrypted.readInt32BE(4) / 10000000.0,
              accuracy: 0,
            };
          }

          lastError = `decrypted payload too short (${decrypted.length}) @offset=${attempt.ephOffset} ephLen=${attempt.ephLen} authTagAtEnd=${attempt.authTagAtEnd}`;
        } catch (attemptError: any) {
          lastError = `${attemptError?.message || String(attemptError)} @offset=${attempt.ephOffset} ephLen=${attempt.ephLen} authTagAtEnd=${attempt.authTagAtEnd}`;
        }
      }

      const firstBytesHex = payload.slice(0, 8).toString('hex');
      throw new Error(
        `all decrypt attempts failed payloadLen=${payload.length} payloadEncoding=${payloadDecoded.encoding} privateKeyEncoding=${privateKeyDecoded.encoding} firstBytes=${firstBytesHex} lastError=${lastError}`,
      );
    } catch (error: any) {
      console.error('Decryption failed:', error.message);
      return null;
    }
  }
}

export const findMyService = new FindMyService(appleAuthService);
