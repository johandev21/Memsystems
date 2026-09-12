import { Module } from '@nestjs/common';
import { CrawlerController } from './crawler.controller';
import { CRAWLER_SERVICE } from './crawler.types';
import { FirecrawlCrawlerService } from './firecrawl-crawler.service';

@Module({
  controllers: [CrawlerController],
  providers: [
    { provide: CRAWLER_SERVICE, useClass: FirecrawlCrawlerService },
    FirecrawlCrawlerService,
  ],
  exports: [CRAWLER_SERVICE, FirecrawlCrawlerService],
})
export class CrawlerModule {}
