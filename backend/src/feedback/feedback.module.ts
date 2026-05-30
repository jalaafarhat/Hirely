import { Module } from '@nestjs/common';
import { RecommendationLearningService } from './recommendation-learning.service';

@Module({
  providers: [RecommendationLearningService],
  exports: [RecommendationLearningService],
})
export class FeedbackModule {}
