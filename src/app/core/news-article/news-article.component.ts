import { Component, inject } from '@angular/core';
import { AsyncPipe, DatePipe, TitleCasePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DomSanitizer, SafeHtml, Title, Meta } from '@angular/platform-browser';
import { Observable, of, switchMap, map, tap, shareReplay } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ArticleService } from '../../services/article.service';
import { Article } from '../../models/article.model';

interface ArticleView extends Article {
  safeContent: SafeHtml;
}

@Component({
  selector: 'app-news-article',
  standalone: true,
  imports: [AsyncPipe, DatePipe, TitleCasePipe, RouterLink, MatButtonModule, MatIconModule],
  templateUrl: './news-article.component.html',
  styleUrl: './news-article.component.scss',
})
export class NewsArticleComponent {
  private route = inject(ActivatedRoute);
  private articleService = inject(ArticleService);
  private sanitizer = inject(DomSanitizer);
  private titleService = inject(Title);
  private metaService = inject(Meta);

  article$: Observable<ArticleView | null> = this.route.paramMap.pipe(
    switchMap(params => {
      const slug = params.get('slug') ?? '';
      return this.articleService.getArticleBySlug(slug).pipe(
        map(articles => {
          const a = articles[0] ?? null;
          if (!a) return null;
          // Content is from our own Cloud Function — safe to trust.
          return { ...a, safeContent: this.sanitizer.bypassSecurityTrustHtml(a.content) };
        }),
        tap(article => {
          if (article) {
            this.titleService.setTitle(article.metaTitle);
            this.metaService.updateTag({ name: 'description', content: article.metaDescription });
          }
        })
      );
    }),
    shareReplay(1)
  );

  relatedArticles$ = this.article$.pipe(
    switchMap(article => {
      if (!article) return of([]);
      return this.articleService.getRelated(article.category).pipe(
        map(articles => articles.filter(a => a.id !== article.id).slice(0, 3))
      );
    })
  );
}
