import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ArticleService } from '../../services/article.service';
import { Article } from '../../models/article.model';

/**
 * A one-line strip pointing at the newest article. Deliberately a single
 * headline rather than a list — it sits above the social bar on the homepage,
 * where anything taller would push the plate listings below the fold.
 */
@Component({
  selector: 'app-latest-article-banner',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './latest-article-banner.component.html',
  styleUrl: './latest-article-banner.component.scss',
})
export class LatestArticleBannerComponent {
  private articleService = inject(ArticleService);

  private readonly all = signal<Article[]>([]);

  // getArticles() is already ordered publishedAt desc, so the newest article
  // is simply the first one.
  readonly latest = computed(() => this.all()[0]);

  constructor() {
    this.articleService.getArticles()
      .pipe(takeUntilDestroyed())
      .subscribe(articles => this.all.set(articles));
  }
}
