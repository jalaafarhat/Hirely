import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CVService } from './cv.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Controller('cv')
export class CVController {
  constructor(private cvService: CVService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @CurrentUser('id') userId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.cvService.uploadCV(userId, file);
  }

  @Get()
  get(@CurrentUser('id') userId: string) {
    return this.cvService.getCV(userId);
  }

  @Patch('profile')
  updateProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.cvService.updateProfile(userId, dto);
  }

  @Delete()
  delete(@CurrentUser('id') userId: string) {
    return this.cvService.deleteCV(userId);
  }
}
