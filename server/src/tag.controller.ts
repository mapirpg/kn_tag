import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { TagService } from './tag.service';
import { generateTagKeys } from './utils/generateKeys';

@Controller('tags')
export class TagController {
  constructor(private readonly tagService: TagService) {}

  @Post('generate')
  generateKeys() {
    return generateTagKeys();
  }

  @Post()
  async createTag(
    @Body('name') name: string,
    @Body('publicKey') publicKey: string,
    @Body('privateKey') privateKey: string,
  ) {
    return this.tagService.createTag(name, publicKey, privateKey);
  }

  @Get()
  async getTags() {
    return this.tagService.getTags();
  }

  @Post(':id/update')
  async updateLocations(
    @Param('id') id: string,
    @Body('password') password: string,
  ) {
    return this.tagService.updateTagLocations(id, password);
  }
}
