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

  private decryptOpenHaystackPayload(payload: Buffer, privateKey: Buffer) {
    let normalizedPayload = payload;
    // OpenHaystack fix for newer report format (extra byte at index 5)
    if (normalizedPayload.length > 88) {
      normalizedPayload = Buffer.concat([normalizedPayload.slice(0, 5), normalizedPayload.slice(6)]);
    }

    if (normalizedPayload.length < 88) {
      throw new Error(`payload too short for OpenHaystack format (${normalizedPayload.length})`);
    }

    const ephKey = normalizedPayload.slice(5, 62);
    const encData = normalizedPayload.slice(62, 72);
    const tag = normalizedPayload.slice(72);

    const tagPrivKey = ec224.keyFromPrivate(privateKey);
    const ephPubKey = ec224.keyFromPublic(ephKey);
    const sharedSecret = tagPrivKey.derive(ephPubKey.getPublic());
    const sharedSecretBuffer = Buffer.from(sharedSecret.toArray('be', 28));

    const derivedKey = crypto
      .createHash('sha256')
      .update(Buffer.concat([sharedSecretBuffer, Buffer.from([0x00, 0x00, 0x00, 0x01]), ephKey]))
      .digest();

    const decryptionKey = derivedKey.slice(0, 16);
    const iv = derivedKey.slice(16);

    const decipher = crypto.createDecipheriv('aes-128-gcm', decryptionKey, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([decipher.update(encData), decipher.final()]);
    return { decrypted, normalizedPayload };
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

      const { decrypted, normalizedPayload } = this.decryptOpenHaystackPayload(payload, privateKey);

      if (decrypted.length < 9) {
        throw new Error(`decrypted payload too short (${decrypted.length})`);
      }

      const latitude = decrypted.readInt32BE(0) / 10000000.0;
      const longitude = decrypted.readInt32BE(4) / 10000000.0;
      const accuracy = decrypted.readUInt8(8);

      const payloadTimestamp = normalizedPayload.readUInt32BE(0) + 978307200;
      const timestamp = Number.isFinite(payloadTimestamp)
        ? new Date(payloadTimestamp * 1000)
        : (reportTimestamp ? new Date(reportTimestamp) : new Date());

      return {
        timestamp,
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
