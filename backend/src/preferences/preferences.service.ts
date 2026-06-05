import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdatePreferencesDto } from './dto/preferences.dto';
import { WorkMode } from '@prisma/client';

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
    const prefersRemote = dto.workModes?.includes(WorkMode.REMOTE) ?? false;
    if (prefersRemote && !dto.country?.trim()) {
      throw new BadRequestException(
        'Country is required when remote work is enabled.',
      );
    }

    const keepCountry =
      dto.locationType === 'COUNTRY' || prefersRemote;
    const data = {
      ...dto,
      country: keepCountry ? dto.country?.trim() || null : null,
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
