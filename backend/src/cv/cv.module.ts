import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CVController } from './cv.controller';
import { CVService } from './cv.service';
import { CVParserService } from './cv-parser.service';
import { ProfileAnalyzerService } from './profile-analyzer.service';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    StorageModule,
    MulterModule.register({ storage: memoryStorage() }),
  ],
  controllers: [CVController],
  providers: [CVService, CVParserService, ProfileAnalyzerService],
  exports: [CVService, ProfileAnalyzerService],
})
export class CVModule {}
