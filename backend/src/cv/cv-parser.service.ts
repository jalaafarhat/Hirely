import { Injectable, BadRequestException } from '@nestjs/common';
import { PDFParse } from 'pdf-parse';
import * as mammoth from 'mammoth';
import * as path from 'path';

@Injectable()
export class CVParserService {
  private readonly allowedMimeTypes = new Set([
    'application/pdf',
    'application/x-pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'application/octet-stream',
  ]);

  validateFile(file: Express.Multer.File): void {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const ext = path.extname(file.originalname).toLowerCase();
    if (!['.pdf', '.docx'].includes(ext)) {
      throw new BadRequestException('Only PDF and DOCX files are allowed');
    }

    if (!this.allowedMimeTypes.has(file.mimetype)) {
      throw new BadRequestException(
        `Unsupported file type: ${file.mimetype}. Upload a PDF or DOCX file.`,
      );
    }

    if (file.size > 10 * 1024 * 1024) {
      throw new BadRequestException('File size must be under 10MB');
    }
  }

  async extractText(buffer: Buffer, mimeType: string, filename: string): Promise<string> {
    const ext = path.extname(filename).toLowerCase();

    if (
      mimeType === 'application/pdf' ||
      mimeType === 'application/x-pdf' ||
      ext === '.pdf'
    ) {
      const parser = new PDFParse(new Uint8Array(buffer));
      const result = await parser.getText();
      return result.text?.trim() || '';
    }

    if (
      mimeType ===
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      ext === '.docx'
    ) {
      const result = await mammoth.extractRawText({ buffer });
      return result.value.trim();
    }

    throw new BadRequestException('Unsupported file format');
  }
}
