import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppleAuthService } from './apple-auth.service';
import { FindMyService } from './find-my.service';
import { TagService } from './tag.service';
import { TagController } from './tag.controller';
import { PrismaService } from './prisma.service';

@Module({
  imports: [ConfigModule.forRoot()],
  controllers: [AppController, TagController],
  providers: [
    AppService,
    AppleAuthService,
    FindMyService,
    TagService,
    PrismaService,
  ],
})
export class AppModule {}
