import { Component, inject } from '@angular/core';
import { AsyncPipe, DatePipe, TitleCasePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DomSanitizer, SafeHtml, Title, Meta } from '@angular/platform-browser';
import { Observable, of, switchMap, map, tap, shareReplay, startWith, filter } from 'rxjs';
import { Timestamp } from '@angular/fire/firestore';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ArticleService } from '../../services/article.service';
import { Article } from '../../models/article.model';
import { PrerenderDataService } from '../../services/prerender-data.service';

interface ArticleView extends Article {
  safeContent: SafeHtml;
}

/** The embedded copy carries publishedAt as an ISO string. */
type PrerenderedArticle = Omit<Article, 'publishedAt'> & { publishedAt: string };

// Loading is its own state so a slow Firestore read never shows "not found".
type ArticleState =
  | { status: 'loading' }
  | { status: 'found'; article: ArticleView }
  | { status: 'not-found' };

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
  private prerenderData = inject(PrerenderDataService);

  articleState$: Observable<ArticleState> = this.route.paramMap.pipe(
    switchMap(params => {
      const slug = params.get('slug') ?? '';
      // On a direct load the page carries the article, so it renders at once
      // and Firestore only refreshes it.
      const prerendered = this.prerenderData.get<PrerenderedArticle>('article', slug);
      const initial: ArticleState = prerendered
        ? { status: 'found', article: this.toView({ ...prerendered, publishedAt: Timestamp.fromDate(new Date(prerendered.publishedAt)) }) }
        : { status: 'loading' };
      return this.articleService.getArticleBySlug(slug).pipe(
        map((articles): ArticleState => {
          const a = articles[0] ?? null;
          return a ? { status: 'found', article: this.toView(a) } : { status: 'not-found' };
        }),
        // Firestore reports an empty offline-cache result, not an error, when it
        // can't connect, so an embedded article is never replaced by "not found".
        filter(state => !(prerendered && state.status === 'not-found')),
        tap(state => {
          if (state.status === 'found') {
            this.titleService.setTitle(state.article.metaTitle);
            this.metaService.updateTag({ name: 'description', content: state.article.metaDescription });
          }
        }),
        startWith(initial)
      );
    }),
    shareReplay(1)
  );

  relatedArticles$ = this.articleState$.pipe(
    map(state => state.status === 'found' ? state.article : null),
    switchMap(article => {
      if (!article) return of([]);
      return this.articleService.getRelated(article.category).pipe(
        map(articles => articles.filter(a => a.id !== article.id).slice(0, 3))
      );
    })
  );

  private toView(a: Article): ArticleView {
    // Content is from our own Cloud Function — safe to trust.
    return { ...a, safeContent: this.sanitizer.bypassSecurityTrustHtml(a.content) };
  }
}
