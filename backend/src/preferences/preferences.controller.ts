import { Controller, Get, Put, Body } from '@nestjs/common';
import { PreferencesService } from './preferences.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UpdatePreferencesDto } from './dto/preferences.dto';

@Controller('preferences')
export class PreferencesController {
  constructor(private preferencesService: PreferencesService) {}

  @Get()
  get(@CurrentUser('id') userId: string) {
    return this.preferencesService.get(userId);
  }

  @Put()
  update(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdatePreferencesDto,
  ) {
    return this.preferencesService.update(userId, dto);
  }
}
