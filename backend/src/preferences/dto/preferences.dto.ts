import { Type } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsBoolean,
  IsString,
  IsArray,
  ArrayMinSize,
} from 'class-validator';
import {
  LocationType,
  WorkMode,
  JobType,
} from '@prisma/client';

export class UpdatePreferencesDto {
  @IsOptional()
  @IsEnum(LocationType)
  locationType?: LocationType;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(WorkMode, { each: true })
  workModes?: WorkMode[];

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(JobType, { each: true })
  jobTypes?: JobType[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(50)
  @Max(100)
  matchThreshold?: number;

  @IsOptional()
  @IsBoolean()
  agentEnabled?: boolean;

  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(23, { each: true })
  digestHours?: number[];

  @IsOptional()
  @IsBoolean()
  emailDigestEnabled?: boolean;
}
