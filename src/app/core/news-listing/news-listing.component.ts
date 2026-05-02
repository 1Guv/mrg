import { Component, inject } from '@angular/core';
import { AsyncPipe, DatePipe, TitleCasePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import { BehaviorSubject, switchMap } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ArticleService } from '../../services/article.service';
import { ArticleCategory } from '../../models/article.model';

@Component({
  selector: 'app-news-listing',
  standalone: true,
  imports: [AsyncPipe, DatePipe, TitleCasePipe, RouterLink, MatButtonModule, MatIconModule],
  templateUrl: './news-listing.component.html',
  styleUrl: './news-listing.component.scss',
})
export class NewsListingComponent {
  private articleService = inject(ArticleService);
  private titleService = inject(Title);
  private metaService = inject(Meta);

  constructor() {
    this.titleService.setTitle('Latest News — MRG Plates');
    this.metaService.updateTag({ name: 'description', content: 'Guides, tips and market insights for UK number plate owners.' });
  }

  readonly filters: Array<{ label: string; value: ArticleCategory | undefined }> = [
    { label: 'All', value: undefined },
    { label: 'Valuations', value: 'valuations' },
    { label: 'Plates', value: 'plates' },
    { label: 'Cars', value: 'cars' },
  ];

  selectedCategory$ = new BehaviorSubject<ArticleCategory | undefined>(undefined);

  articles$ = this.selectedCategory$.pipe(
    switchMap(cat => this.articleService.getArticles(cat))
  );

  selectCategory(value: ArticleCategory | undefined): void {
    this.selectedCategory$.next(value);
  }

  isSelected(value: ArticleCategory | undefined): boolean {
    return this.selectedCategory$.value === value;
  }

  estimateReadTime(minutes: number): string {
    return `${minutes} min read`;
  }
}
