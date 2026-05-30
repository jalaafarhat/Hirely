import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdatePreferencesDto } from './dto/preferences.dto';

@Injectable()
export class PreferencesService {
  constructor(private prisma: PrismaService) {}

  async get(userId: string) {
    let prefs = await this.prisma.userPreferences.findUnique({
      where: { userId },
    });
    if (!prefs) {
      prefs = await this.prisma.userPreferences.create({
        data: {
          userId,
          workModes: ['REMOTE', 'HYBRID'],
          jobTypes: ['FULL_TIME'],
          digestHours: [9, 15],
          emailDigestEnabled: true,
        },
      });
    }
    return prefs;
  }

  async update(userId: string, dto: UpdatePreferencesDto) {
    const data = {
      ...dto,
      country: dto.locationType === 'COUNTRY' ? dto.country : null,
      city: dto.locationType === 'CITY' ? dto.city : null,
    };
    return this.prisma.userPreferences.upsert({
      where: { userId },
      create: {
        userId,
        workModes: dto.workModes || ['REMOTE'],
        jobTypes: dto.jobTypes || ['FULL_TIME'],
        ...data,
      },
      update: data,
    });
  }
}
