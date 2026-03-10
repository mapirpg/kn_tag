import { prisma } from './prisma.service';
import { findMyService, FindMyService } from './find-my.service';
import * as crypto from 'crypto';

export class TagService {
  constructor(
    private prisma: any,
    private findMyService: FindMyService,
  ) {}

  async createTag(
    name: string,
    publicKeyBase64: string,
    privateKeyBase64: string,
  ) {
    const pubKey = Buffer.from(publicKeyBase64, 'base64');
    const hashedPubKey = crypto
      .createHash('sha256')
      .update(pubKey)
      .digest()
      .slice(0, 20)
      .toString('base64');

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
    const tag = await this.prisma.tag.findUnique({ where: { id: tagId } });
    if (!tag) throw new Error('Tag not found');

    const pubKey = Buffer.from(tag.publicKey, 'base64');
    const correctHashedPubKey = crypto
      .createHash('sha256')
      .update(pubKey)
      .digest()
      .slice(0, 20)
      .toString('base64');

    const reports = await this.findMyService.fetchReports(correctHashedPubKey);
    
    const locations = [];
    for (const report of reports) {
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
        }
    }

    return locations;
  }
}

export const tagService = new TagService(prisma, findMyService);
