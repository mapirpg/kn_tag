import { prisma } from './prisma.service';
import { findMyService, FindMyService } from './find-my.service';
import * as crypto from 'crypto';

const HEX_RE = /^[0-9a-fA-F]+$/;

export class TagService {
  constructor(
    private prisma: any,
    private findMyService: FindMyService,
  ) {}

  private decodeKey(value: string) {
    const normalized = (value || '').trim();
    const isHex = normalized.length % 2 === 0 && HEX_RE.test(normalized);
    return {
      bytes: Buffer.from(normalized, isHex ? 'hex' : 'base64'),
      encoding: isHex ? 'hex' : 'base64',
    };
  }

  private normalizeHashToBase64(value: string) {
    const normalized = (value || '').trim();
    const isHex = normalized.length % 2 === 0 && HEX_RE.test(normalized);
    return isHex ? Buffer.from(normalized, 'hex').toString('base64') : normalized;
  }

  async createTag(
    name: string,
    publicKeyBase64: string,
    privateKeyBase64: string,
  ) {
    const pubKeyDecoded = this.decodeKey(publicKeyBase64);
    const hashedPubKey = crypto
      .createHash('sha256')
      .update(pubKeyDecoded.bytes)
      .digest('base64');

    return this.prisma.tag.create({
      data: {
        name,
        publicKey: publicKeyBase64,
        privateKey: privateKeyBase64,
        hashedPublicKey: hashedPubKey,
      },
    });
  }

  async getTags() {
    return this.prisma.tag.findMany({
      include: {
        locations: {
          orderBy: { timestamp: 'desc' },
          take: 1,
        },
      },
    });
  }

  async updateTagLocations(tagId: string) {
    const startedAt = Date.now();
    console.log(`[tag.service] updateTagLocations start tagId=${tagId}`);

    const tag = await this.prisma.tag.findUnique({ where: { id: tagId } });
    if (!tag) throw new Error('Tag not found');
    console.log(`[tag.service] tag found tagId=${tagId} name=${tag.name}`);

    const pubKeyDecoded = this.decodeKey(tag.publicKey);
    const computedHashedPubKey = crypto
      .createHash('sha256')
      .update(pubKeyDecoded.bytes)
      .digest('base64');
    const storedHashedPubKey = this.normalizeHashToBase64(tag.hashedPublicKey || '');
    const lookupHashedPubKey = storedHashedPubKey || computedHashedPubKey;

    console.log(
      `[tag.service] key formats tagId=${tagId} publicKeyEncoding=${pubKeyDecoded.encoding} hashedStoredPrefix=${storedHashedPubKey.slice(0, 8)}... hashedComputedPrefix=${computedHashedPubKey.slice(0, 8)}...`,
    );

    if (storedHashedPubKey && storedHashedPubKey !== computedHashedPubKey) {
      console.warn(
        `[tag.service] hashed mismatch tagId=${tagId} usingStored=true storedPrefix=${storedHashedPubKey.slice(0, 8)}... computedPrefix=${computedHashedPubKey.slice(0, 8)}...`,
      );
    }

    const reports = await this.findMyService.fetchReports(lookupHashedPubKey);
    console.log(`[tag.service] reports fetched tagId=${tagId} count=${reports.length}`);
    
    const locations = [];
    for (const [index, report] of reports.entries()) {
        console.log(`[tag.service] decrypting report tagId=${tagId} reportIndex=${index}`);
        const decrypted = this.findMyService.decryptReport(report.payload, tag.privateKey);
        if (decrypted) {
            const loc = await this.prisma.location.create({
                data: {
                    tagId,
                    latitude: decrypted.latitude,
                    longitude: decrypted.longitude,
                    accuracy: decrypted.accuracy,
                    timestamp: decrypted.timestamp,
                    payload: report.payload
                }
            });
            locations.push(loc);
            console.log(`[tag.service] location saved tagId=${tagId} reportIndex=${index}`);
        } else {
            console.warn(`[tag.service] report skipped (decrypt failed) tagId=${tagId} reportIndex=${index}`);
        }
    }

    console.log(
      `[tag.service] updateTagLocations done tagId=${tagId} saved=${locations.length} durationMs=${Date.now() - startedAt}`,
    );

    return locations;
  }
}

export const tagService = new TagService(prisma, findMyService);
