import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { FindMyService } from './find-my.service';
import * as crypto from 'crypto';
import { Location } from '@prisma/client';

@Injectable()
export class TagService {
  constructor(
    private prisma: PrismaService,
    private findMyService: FindMyService,
  ) {}

  async createTag(
    name: string,
    publicKeyBase64: string,
    privateKeyBase64: string,
  ) {
    // Generate hashed public key for fetching reports
    // It's the SHA256 of the public key
    const pubKey = Buffer.from(publicKeyBase64, 'base64');
    const hashedPubKey = crypto
      .createHash('sha256')
      .update(pubKey)
      .digest()
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

  async updateTagLocations(tagId: string, password: string) {
    const tag = await this.prisma.tag.findUnique({ where: { id: tagId } });
    if (!tag) throw new Error('Tag not found');

    // DEBUG MODE: Uncomment to test without Apple API
    return this.createMockLocation(tagId);
  }

  // Mock location for testing UI without Apple API
  private async createMockLocation(tagId: string) {
    const baseLatitude = -23.5505;
    const baseLongitude = -46.6333;

    const location = await this.prisma.location.create({
      data: {
        tagId,
        latitude: baseLatitude + (Math.random() - 0.5) * 0.02,
        longitude: baseLongitude + (Math.random() - 0.5) * 0.02,
        accuracy: 10 + Math.random() * 30,
        timestamp: new Date(),
        payload: 'mock_data',
      },
    });

    return [location];
  }
}
