import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CVParserService } from './cv-parser.service';
import { ProfileAnalyzerService } from './profile-analyzer.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ParsedProfile } from '../common/types';

@Injectable()
export class CVService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private parser: CVParserService,
    private analyzer: ProfileAnalyzerService,
  ) {}

  async uploadCV(userId: string, file: Express.Multer.File) {
    this.parser.validateFile(file);

    const text = await this.parser.extractText(
      file.buffer,
      file.mimetype,
      file.originalname,
    );
    if (!text.trim()) {
      throw new BadRequestException('Could not extract text from CV');
    }

    const parsed = await this.analyzer.analyzeProfile(text);
    const { key, storageType } = await this.storage.upload(
      file.buffer,
      file.originalname,
      file.mimetype,
    );

    const existing = await this.prisma.cvFile.findUnique({ where: { userId } });
    if (existing) {
      await this.storage.delete(existing.storageKey, existing.storageType);
      await this.prisma.cvFile.delete({ where: { userId } });
    }

    const cvFile = await this.prisma.cvFile.create({
      data: {
        userId,
        filename: key,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        storageKey: key,
        storageType,
      },
    });

    await this.prisma.profile.upsert({
      where: { userId },
      create: {
        userId,
        name: parsed.name,
        email: parsed.email,
        phone: parsed.phone,
        summary: parsed.summary,
        jobTitles: parsed.jobTitles,
        skills: parsed.skills,
        technologies: parsed.technologies,
        yearsExperience: parsed.yearsExperience,
        education: parsed.education,
        certifications: parsed.certifications,
        industries: parsed.industries,
        languages: parsed.languages,
        locations: parsed.locations,
        seniority: parsed.seniority,
        rawParsedData: parsed as object,
      },
      update: {
        name: parsed.name,
        email: parsed.email,
        phone: parsed.phone,
        summary: parsed.summary,
        jobTitles: parsed.jobTitles,
        skills: parsed.skills,
        technologies: parsed.technologies,
        yearsExperience: parsed.yearsExperience,
        education: parsed.education,
        certifications: parsed.certifications,
        industries: parsed.industries,
        languages: parsed.languages,
        locations: parsed.locations,
        seniority: parsed.seniority,
        rawParsedData: parsed as object,
        analyzedAt: new Date(),
      },
    });

    const profile = await this.prisma.profile.findUnique({ where: { userId } });

    return {
      id: cvFile.id,
      filename: cvFile.originalName,
      uploadedAt: cvFile.uploadedAt,
      profile,
    };
  }

  async getCV(userId: string) {
    const cvFile = await this.prisma.cvFile.findUnique({ where: { userId } });
    const profile = await this.prisma.profile.findUnique({ where: { userId } });

    if (!cvFile && !profile) {
      throw new NotFoundException('No CV uploaded');
    }

    return {
      file: cvFile
        ? {
            id: cvFile.id,
            filename: cvFile.originalName,
            uploadedAt: cvFile.uploadedAt,
          }
        : null,
      profile,
    };
  }

  async deleteCV(userId: string) {
    const cvFile = await this.prisma.cvFile.findUnique({ where: { userId } });
    if (!cvFile) {
      throw new NotFoundException('No CV found');
    }

    await this.storage.delete(cvFile.storageKey, cvFile.storageType);
    await this.prisma.cvFile.delete({ where: { userId } });
    await this.prisma.profile.deleteMany({ where: { userId } });

    return { message: 'CV deleted' };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const existing = await this.prisma.profile.findUnique({ where: { userId } });
    if (!existing) {
      throw new NotFoundException('No profile found. Upload a CV first.');
    }

    const normalized = this.analyzer.normalizeProfile({
      name: dto.name ?? existing.name ?? '',
      email: dto.email ?? existing.email ?? '',
      phone: dto.phone ?? existing.phone ?? '',
      summary: dto.summary ?? existing.summary ?? '',
      jobTitles: dto.jobTitles ?? existing.jobTitles,
      skills: dto.skills ?? existing.skills,
      technologies: dto.technologies ?? existing.technologies,
      yearsExperience: dto.yearsExperience ?? existing.yearsExperience,
      education: (existing.education as ParsedProfile['education']) || [],
      certifications: dto.certifications ?? existing.certifications,
      industries: dto.industries ?? existing.industries,
      languages: dto.languages ?? existing.languages,
      locations: dto.locations ?? existing.locations,
      seniority: dto.seniority ?? existing.seniority ?? '',
    });

    const profile = await this.prisma.profile.update({
      where: { userId },
      data: {
        name: normalized.name,
        email: normalized.email,
        phone: normalized.phone,
        summary: normalized.summary,
        jobTitles: normalized.jobTitles,
        skills: normalized.skills,
        technologies: normalized.technologies,
        yearsExperience: normalized.yearsExperience,
        certifications: normalized.certifications,
        industries: normalized.industries,
        languages: normalized.languages,
        locations: normalized.locations,
        seniority: normalized.seniority,
        rawParsedData: normalized as object,
      },
    });

    return { message: 'Profile updated', profile };
  }
}
