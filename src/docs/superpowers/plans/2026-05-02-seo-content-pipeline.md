# SEO Content Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an automated daily SEO article pipeline — Angular `/news` section fed by a Firebase Cloud Function that pulls GSC keyword data and generates articles with Gemini 2.5 Flash.

**Architecture:** A Firebase scheduled Cloud Function (08:00 UK time daily) fetches keyword opportunities from Google Search Console, generates a structured HTML article with Gemini 2.5 Flash, and writes it to Firestore. The Angular app reads from the `articles` Firestore collection and renders a `/news` listing page and `/news/:slug` article pages, each with sidebar CTAs pointing back to the core valuation and listing flows.

**Tech Stack:** Angular 19 standalone components, Angular Fire (Firestore), Angular Material, Firebase Cloud Functions v2, Google Search Console API (googleapis), Gemini 2.5 Flash (REST via axios), Firebase Secret Manager.

---

## File Map

**New files — Angular:**
- `src/app/models/article.model.ts` — Article interface and ArticleCategory type
- `src/app/services/article.service.ts` — Firestore reads for articles collection
- `src/app/core/news-listing/news-listing.component.ts` — `/news` listing page
- `src/app/core/news-listing/news-listing.component.html`
- `src/app/core/news-listing/news-listing.component.scss`
- `src/app/core/news-article/news-article.component.ts` — `/news/:slug` article page
- `src/app/core/news-article/news-article.component.html`
- `src/app/core/news-article/news-article.component.scss`

**Modified files — Angular:**
- `src/app/app.routes.ts` — add `/news` and `/news/:slug` routes
- `src/assets/data/content.json` — add "Latest News" menu item
- `firestore.rules` — add `articles` and `meta` collection rules

**New files — Cloud Functions:**
- `functions/src/article-generator.ts` — all article generation logic

**Modified files — Cloud Functions:**
- `functions/src/index.ts` — register `generateDailyArticle` scheduled function

---

## Task 1: Article model + Firestore rules

**Files:**
- Create: `src/app/models/article.model.ts`
- Modify: `firestore.rules`

- [ ] **Step 1: Create the Article model**

Create `src/app/models/article.model.ts`:

```typescript
import { Timestamp } from 'firebase/firestore';

export type ArticleCategory = 'valuations' | 'plates' | 'cars';

export interface Article {
  id: string;
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  category: ArticleCategory;
  targetKeyword: string;
  content: string; // HTML string rendered with [innerHTML]
  readTimeMinutes: number;
  publishedAt: Timestamp;
}
```

- [ ] **Step 2: Add Firestore rules for articles and meta**

In `firestore.rules`, add these two blocks inside the existing `match /databases/{database}/documents {` block, after the last existing rule:

```
// Articles — publicly readable; written only by Cloud Function (admin SDK bypasses rules)
match /articles/{articleId} {
  allow read: if true;
  allow write: if false;
}

// Meta (used keywords, generation log) — Cloud Function only (admin SDK)
match /meta/{docId} {
  allow read, write: if false;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/models/article.model.ts firestore.rules
git commit -m "feat: add Article model and Firestore rules for articles collection"
```

---

## Task 2: ArticleService

**Files:**
- Create: `src/app/services/article.service.ts`

- [ ] **Step 1: Create the service**

Create `src/app/services/article.service.ts`:

```typescript
import { inject, Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  query,
  orderBy,
  where,
  limit,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Article, ArticleCategory } from '../models/article.model';

@Injectable({ providedIn: 'root' })
export class ArticleService {
  private firestore = inject(Firestore);
  private readonly COLLECTION = 'articles';

  /** Returns articles ordered by publishedAt descending, optionally filtered by category. */
  getArticles(category?: ArticleCategory): Observable<Article[]> {
    const ref = collection(this.firestore, this.COLLECTION);
    const q = category
      ? query(ref, where('category', '==', category), orderBy('publishedAt', 'desc'))
      : query(ref, orderBy('publishedAt', 'desc'));
    return collectionData(q, { idField: 'id' }) as Observable<Article[]>;
  }

  /** Returns matching articles for a slug (array of 0 or 1). */
  getArticleBySlug(slug: string): Observable<Article[]> {
    const ref = collection(this.firestore, this.COLLECTION);
    const q = query(ref, where('slug', '==', slug), limit(1));
    return collectionData(q, { idField: 'id' }) as Observable<Article[]>;
  }

  /** Returns up to 3 articles in the same category, excluding the given id. */
  getRelated(category: ArticleCategory, excludeId: string): Observable<Article[]> {
    const ref = collection(this.firestore, this.COLLECTION);
    const q = query(
      ref,
      where('category', '==', category),
      orderBy('publishedAt', 'desc'),
      limit(4)
    );
    return collectionData(q, { idField: 'id' }) as Observable<Article[]>;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/services/article.service.ts
git commit -m "feat: add ArticleService for reading articles from Firestore"
```

---

## Task 3: Add "Latest News" to the sidebar nav

**Files:**
- Modify: `src/assets/data/content.json`

- [ ] **Step 1: Add the nav item**

In `src/assets/data/content.json`, find the `"menuOptions"` array under `"header"`. It currently ends with the Cars entry. Add the News entry after Cars:

```json
{
  "name": "Latest News",
  "icon": "newspaper",
  "url": "/news",
  "toolTip": "Latest News"
}
```

The full `menuOptions` array should look like:

```json
"menuOptions": [
  {
    "name": "Valuations",
    "icon": "verified",
    "url": "/",
    "toolTip": "Valuations"
  },
  {
    "name": "Plates",
    "icon": "favorite",
    "url": "/plates-for-sale",
    "toolTip": "Plates for sale"
  },
  {
    "name": "Cars",
    "icon": "directions_car",
    "url": "/cars",
    "toolTip": "cars"
  },
  {
    "name": "Latest News",
    "icon": "newspaper",
    "url": "/news",
    "toolTip": "Latest News"
  }
]
```

- [ ] **Step 2: Commit**

```bash
git add src/assets/data/content.json
git commit -m "feat: add Latest News item to sidebar nav"
```

---

## Task 4: News listing page (/news)

**Files:**
- Create: `src/app/core/news-listing/news-listing.component.ts`
- Create: `src/app/core/news-listing/news-listing.component.html`
- Create: `src/app/core/news-listing/news-listing.component.scss`

- [ ] **Step 1: Create the component TypeScript**

Create `src/app/core/news-listing/news-listing.component.ts`:

```typescript
import { Component, inject } from '@angular/core';
import { AsyncPipe, DatePipe, TitleCasePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BehaviorSubject, switchMap } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { ArticleService } from '../../services/article.service';
import { ArticleCategory } from '../../models/article.model';

@Component({
  selector: 'app-news-listing',
  standalone: true,
  imports: [AsyncPipe, DatePipe, TitleCasePipe, RouterLink, MatButtonModule, MatIconModule, MatChipsModule],
  templateUrl: './news-listing.component.html',
  styleUrl: './news-listing.component.scss',
})
export class NewsListingComponent {
  private articleService = inject(ArticleService);

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
```

- [ ] **Step 2: Create the template**

Create `src/app/core/news-listing/news-listing.component.html`:

```html
<div class="news-listing-container">
  <div class="news-header">
    <h1 class="news-title">Latest News</h1>
    <p class="news-subtitle">Guides, tips and market insights for UK number plate owners.</p>
  </div>

  <div class="filter-tabs">
    @for (filter of filters; track filter.label) {
      <button
        class="filter-btn"
        [class.active]="isSelected(filter.value)"
        (click)="selectCategory(filter.value)">
        {{ filter.label }}
      </button>
    }
  </div>

  @if (articles$ | async; as articles) {
    @if (articles.length === 0) {
      <div class="empty-state">
        <mat-icon>newspaper</mat-icon>
        <p>No articles yet — check back soon.</p>
      </div>
    } @else {
      <div class="article-grid">
        @for (article of articles; track article.id) {
          <a class="article-card" [routerLink]="['/news', article.slug]">
            <div class="card-category-bar" [attr.data-category]="article.category">
              {{ article.category | titlecase }}
            </div>
            <div class="card-body">
              <h2 class="card-title">{{ article.title }}</h2>
              <p class="card-meta">
                {{ estimateReadTime(article.readTimeMinutes) }}
                &nbsp;·&nbsp;
                {{ article.publishedAt.toDate() | date:'MMM d, y' }}
              </p>
            </div>
          </a>
        }
      </div>
    }
  } @else {
    <div class="loading-state">
      <p>Loading articles...</p>
    </div>
  }
</div>
```

- [ ] **Step 3: Create the styles**

Create `src/app/core/news-listing/news-listing.component.scss`:

```scss
.news-listing-container {
  max-width: 900px;
  margin: 0 auto;
  padding: 24px 16px;
}

.news-header {
  margin-bottom: 24px;
}

.news-title {
  font-size: 2rem;
  font-weight: 700;
  margin: 0 0 8px;
}

.news-subtitle {
  color: #666;
  margin: 0;
}

.filter-tabs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 24px;
}

.filter-btn {
  padding: 6px 16px;
  border-radius: 20px;
  border: 1px solid #ddd;
  background: transparent;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;

  &:hover {
    background: #f0f0f0;
  }

  &.active {
    background: #1a1a2e;
    color: white;
    border-color: #1a1a2e;
  }
}

.article-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;

  @media (max-width: 600px) {
    grid-template-columns: 1fr;
  }
}

.article-card {
  display: block;
  text-decoration: none;
  color: inherit;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  overflow: hidden;
  transition: box-shadow 0.2s, transform 0.2s;

  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    transform: translateY(-2px);
  }
}

.card-category-bar {
  height: 6px;
  background: #1a1a2e;

  &[data-category='valuations'] { background: #4caf50; }
  &[data-category='plates'] { background: #7c6af7; }
  &[data-category='cars'] { background: #2196f3; }
}

.card-body {
  padding: 16px;
}

.card-title {
  font-size: 1rem;
  font-weight: 600;
  margin: 0 0 8px;
  line-height: 1.4;
}

.card-meta {
  font-size: 12px;
  color: #888;
  margin: 0;
}

.empty-state,
.loading-state {
  text-align: center;
  padding: 48px 16px;
  color: #888;

  mat-icon {
    font-size: 48px;
    width: 48px;
    height: 48px;
    margin-bottom: 12px;
    display: block;
    margin-inline: auto;
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/core/news-listing/
git commit -m "feat: add news listing page with category filter tabs"
```

---

## Task 5: News article page (/news/:slug)

**Files:**
- Create: `src/app/core/news-article/news-article.component.ts`
- Create: `src/app/core/news-article/news-article.component.html`
- Create: `src/app/core/news-article/news-article.component.scss`

- [ ] **Step 1: Create the component TypeScript**

Create `src/app/core/news-article/news-article.component.ts`:

```typescript
import { Component, inject, OnDestroy } from '@angular/core';
import { AsyncPipe, DatePipe, TitleCasePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DomSanitizer, SafeHtml, Title, Meta } from '@angular/platform-browser';
import { Observable, of, switchMap, map, tap, filter, combineLatest } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ArticleService } from '../../services/article.service';
import { Article } from '../../models/article.model';

@Component({
  selector: 'app-news-article',
  standalone: true,
  imports: [AsyncPipe, DatePipe, TitleCasePipe, RouterLink, MatButtonModule, MatIconModule],
  templateUrl: './news-article.component.html',
  styleUrl: './news-article.component.scss',
})
export class NewsArticleComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private articleService = inject(ArticleService);
  private sanitizer = inject(DomSanitizer);
  private titleService = inject(Title);
  private metaService = inject(Meta);

  article$: Observable<Article | null> = this.route.paramMap.pipe(
    switchMap(params => {
      const slug = params.get('slug') ?? '';
      return this.articleService.getArticleBySlug(slug).pipe(
        map(articles => articles[0] ?? null),
        tap(article => {
          if (article) {
            this.titleService.setTitle(article.metaTitle);
            this.metaService.updateTag({ name: 'description', content: article.metaDescription });
          }
        })
      );
    })
  );

  relatedArticles$ = this.article$.pipe(
    switchMap(article => {
      if (!article) return of([]);
      return this.articleService.getRelated(article.category, article.id).pipe(
        map(articles => articles.filter(a => a.id !== article.id).slice(0, 3))
      );
    })
  );

  safeContent(html: string): SafeHtml {
    // Content is from our own Cloud Function — safe to trust.
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }
}
```

- [ ] **Step 2: Create the template**

Create `src/app/core/news-article/news-article.component.html`:

```html
@if (article$ | async; as article) {
  <div class="article-page">
    <!-- Article body -->
    <article class="article-body">
      <div class="article-breadcrumb">
        <a routerLink="/news">← Latest News</a>
        <span>&nbsp;/&nbsp;{{ article.category | titlecase }}</span>
      </div>

      <div class="article-meta">
        <span class="category-tag" [attr.data-category]="article.category">
          {{ article.category | titlecase }}
        </span>
        <span class="read-time">{{ article.readTimeMinutes }} min read</span>
        <span class="publish-date">{{ article.publishedAt.toDate() | date:'d MMMM y' }}</span>
      </div>

      <h1 class="article-title">{{ article.title }}</h1>

      <div class="article-content" [innerHTML]="safeContent(article.content)"></div>
    </article>

    <!-- Sidebar -->
    <aside class="article-sidebar">
      <!-- Free valuation CTA -->
      <div class="sidebar-widget valuation-widget">
        <mat-icon>search</mat-icon>
        <h3>Free Plate Valuation</h3>
        <p>Find out what your number plate is worth — free and instant.</p>
        <a routerLink="/" mat-raised-button color="primary" class="sidebar-cta-btn">
          Get free valuation →
        </a>
      </div>

      <!-- List plate CTA -->
      <div class="sidebar-widget list-widget">
        <mat-icon>sell</mat-icon>
        <h3>List Your Plate</h3>
        <p>Reach thousands of buyers. Free to list, no subscription.</p>
        <a routerLink="/list-plate" mat-stroked-button class="sidebar-cta-btn">
          List for free →
        </a>
      </div>

      <!-- Related articles -->
      @if (relatedArticles$ | async; as related) {
        @if (related.length > 0) {
          <div class="sidebar-widget related-widget">
            <h3>Related Articles</h3>
            @for (rel of related; track rel.id) {
              <a class="related-link" [routerLink]="['/news', rel.slug]">
                <span class="related-category" [attr.data-category]="rel.category"></span>
                {{ rel.title }}
              </a>
            }
          </div>
        }
      }
    </aside>
  </div>
} @else {
  <div class="article-loading">
    <p>Loading article...</p>
  </div>
}
```

- [ ] **Step 3: Create the styles**

Create `src/app/core/news-article/news-article.component.scss`:

```scss
.article-page {
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 32px;
  max-width: 1100px;
  margin: 0 auto;
  padding: 24px 16px;
  align-items: start;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
}

// --- Article body ---

.article-body {
  min-width: 0; // prevent overflow in grid
}

.article-breadcrumb {
  font-size: 13px;
  color: #888;
  margin-bottom: 16px;

  a {
    color: #7c6af7;
    text-decoration: none;
    &:hover { text-decoration: underline; }
  }
}

.article-meta {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 12px;
  font-size: 13px;
  color: #888;
}

.category-tag {
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: white;
  background: #1a1a2e;

  &[data-category='valuations'] { background: #4caf50; }
  &[data-category='plates'] { background: #7c6af7; }
  &[data-category='cars'] { background: #2196f3; }
}

.article-title {
  font-size: 2rem;
  font-weight: 700;
  line-height: 1.3;
  margin: 0 0 24px;
}

.article-content {
  font-size: 1rem;
  line-height: 1.8;
  color: #333;

  h2 {
    font-size: 1.3rem;
    font-weight: 600;
    margin: 32px 0 12px;
  }

  h3 {
    font-size: 1.1rem;
    font-weight: 600;
    margin: 20px 0 8px;
  }

  p { margin: 0 0 16px; }

  a {
    color: #7c6af7;
    &:hover { text-decoration: underline; }
  }

  // Inline CTA callout block generated inside article HTML
  .inline-cta {
    border-left: 4px solid #7c6af7;
    background: #f5f3ff;
    padding: 12px 16px;
    margin: 24px 0;
    border-radius: 0 6px 6px 0;

    p { margin: 0; }
  }
}

// --- Sidebar ---

.article-sidebar {
  display: flex;
  flex-direction: column;
  gap: 16px;
  position: sticky;
  top: 16px;
}

.sidebar-widget {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 16px;

  mat-icon {
    color: #7c6af7;
    margin-bottom: 8px;
  }

  h3 {
    font-size: 1rem;
    font-weight: 600;
    margin: 0 0 6px;
  }

  p {
    font-size: 13px;
    color: #666;
    margin: 0 0 12px;
  }
}

.sidebar-cta-btn {
  width: 100%;
  text-align: center;
  display: block;
}

.related-link {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  text-decoration: none;
  color: #333;
  font-size: 13px;
  padding: 8px 0;
  border-top: 1px solid #eee;

  &:first-of-type { border-top: none; }
  &:hover { color: #7c6af7; }
}

.related-category {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 4px;
  background: #1a1a2e;

  &[data-category='valuations'] { background: #4caf50; }
  &[data-category='plates'] { background: #7c6af7; }
  &[data-category='cars'] { background: #2196f3; }
}

.article-loading {
  text-align: center;
  padding: 48px;
  color: #888;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/core/news-article/
git commit -m "feat: add news article page with sidebar CTAs"
```

---

## Task 6: Register routes

**Files:**
- Modify: `src/app/app.routes.ts`

- [ ] **Step 1: Add the two news routes**

In `src/app/app.routes.ts`, add the imports and routes:

```typescript
import { Routes } from '@angular/router';
import { LoginComponent } from './core/login/login.component';
import { MainSectionComponent } from './core/main-section/main-section.component';
import { RegisterComponent } from './core/register/register.component';
import { authGuard } from './guards/auth.guard';
import { AccountDashboardComponent } from './core/account-dashboard/account-dashboard.component';
import { ForgotPasswordComponent } from './core/forgot-password/forgot-password.component';
import { PlatesForSaleComponent } from './core/plates-for-sale/plates-for-sale.component';
import { ListPlateComponent } from './core/list-plate/list-plate.component';
import { ListPlateSuccessComponent } from './core/list-plate-success/list-plate-success.component';
import { NewsListingComponent } from './core/news-listing/news-listing.component';
import { NewsArticleComponent } from './core/news-article/news-article.component';

export const routes: Routes = [
    { path: '', component: MainSectionComponent },
    { path: 'login', component: LoginComponent },
    { path: 'register', component: RegisterComponent },
    {
        path: 'account-dashboard',
        component: AccountDashboardComponent,
        canActivate: [authGuard]
    },
    { path: 'forgot-password', component: ForgotPasswordComponent },
    { path: 'plates-for-sale', component: PlatesForSaleComponent },
    { path: 'list-plate', component: ListPlateComponent },
    { path: 'list-plate/success', component: ListPlateSuccessComponent },
    { path: 'news', component: NewsListingComponent },
    { path: 'news/:slug', component: NewsArticleComponent },
];
```

- [ ] **Step 2: Serve and verify**

```bash
npm start
```

Open `http://localhost:4200`. Click "Latest News" in the sidebar — it should load `/news` and show the empty state ("No articles yet — check back soon."). No console errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/app.routes.ts
git commit -m "feat: add /news and /news/:slug routes"
```

---

## Task 7: Deploy Firestore rules

**Files:**
- Already modified: `firestore.rules`

- [ ] **Step 1: Deploy rules**

```bash
firebase deploy --only firestore:rules
```

Expected output:
```
✔  firestore: released rules firestore.rules to cloud.firestore
```

- [ ] **Step 2: Commit**

```bash
git commit --allow-empty -m "chore: deploy updated Firestore rules (articles + meta collections)"
```

---

## Task 8: article-generator Cloud Function

**Files:**
- Create: `functions/src/article-generator.ts`

- [ ] **Step 1: Create the article generator module**

Create `functions/src/article-generator.ts`:

```typescript
import * as admin from "firebase-admin";
import axios from "axios";
import {google} from "googleapis";

const db = admin.firestore();
const SITE_URL = "https://mrvaluations.co.uk/";

interface GscRow {
  query: string;
  clicks: number;
  impressions: number;
  position: number;
}

interface GeneratedArticle {
  title: string;
  metaTitle: string;
  metaDescription: string;
  category: "valuations" | "plates" | "cars";
  slug: string;
  content: string;
}

/** Main entry point called by the scheduled Cloud Function. */
export async function runGenerateDailyArticle(
  geminiApiKey: string,
  gscRefreshToken: string,
  gscClientId: string,
  gscClientSecret: string
): Promise<void> {
  // 1. Load used keywords from Firestore
  const usedKeywordsDoc = await db.doc("meta/usedKeywords").get();
  const usedKeywords: string[] = usedKeywordsDoc.exists
    ? (usedKeywordsDoc.data()?.["keywords"] ?? [])
    : [];

  // 2. Fetch keyword data from GSC
  const rows = await fetchGscKeywords(gscRefreshToken, gscClientId, gscClientSecret);

  // 3. Select target keyword — quick wins first, then untapped, skip already used
  const quickWins = rows
    .filter((r) => r.position >= 5 && r.position <= 40 && r.impressions >= 2 && !usedKeywords.includes(r.query))
    .sort((a, b) => a.position - b.position);

  const untapped = rows
    .filter((r) => r.impressions >= 2 && r.clicks === 0 && !usedKeywords.includes(r.query))
    .sort((a, b) => b.impressions - a.impressions);

  const candidates = [...quickWins, ...untapped];

  if (candidates.length === 0) {
    console.log("No new keywords available. Skipping article generation.");
    return;
  }

  const targetKeyword = candidates[0].query;
  console.log(`Targeting keyword: "${targetKeyword}"`);

  // 4. Generate article with Gemini
  const article = await generateArticleWithGemini(geminiApiKey, targetKeyword);

  // 5. Estimate read time from word count
  const wordCount = article.content.replace(/<[^>]*>/g, "").split(/\s+/).length;
  const readTimeMinutes = Math.max(1, Math.round(wordCount / 200));

  // 6. Write article to Firestore
  await db.collection("articles").add({
    ...article,
    readTimeMinutes,
    targetKeyword,
    publishedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // 7. Mark keyword as used
  await db.doc("meta/usedKeywords").set(
    {keywords: admin.firestore.FieldValue.arrayUnion(targetKeyword)},
    {merge: true}
  );

  // 8. Append to generation log
  const today = new Date().toISOString().split("T")[0];
  await db.doc("meta/generationLog").set(
    {
      entries: admin.firestore.FieldValue.arrayUnion({
        date: today,
        keyword: targetKeyword,
        slug: article.slug,
        status: "success",
      }),
    },
    {merge: true}
  );

  console.log(`Article published. slug="${article.slug}"`);
}

async function fetchGscKeywords(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<GscRow[]> {
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({refresh_token: refreshToken});

  const searchconsole = google.searchconsole({version: "v1", auth: oauth2Client});

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - 90);
  const fmt = (d: Date) => d.toISOString().split("T")[0];

  const res = await searchconsole.searchanalytics.query({
    siteUrl: SITE_URL,
    requestBody: {
      startDate: fmt(startDate),
      endDate: fmt(endDate),
      dimensions: ["query"],
      rowLimit: 500,
    },
  });

  return (res.data.rows ?? []).map((r: any) => ({
    query: r.keys[0] as string,
    clicks: r.clicks as number,
    impressions: r.impressions as number,
    position: r.position as number,
  }));
}

async function generateArticleWithGemini(
  apiKey: string,
  keyword: string
): Promise<GeneratedArticle> {
  const prompt = `You are an SEO content writer for MR Valuations (mrvaluations.co.uk), a UK website offering free instant number plate valuations and a marketplace to list private number plates for sale.

Write an SEO-optimised article targeting the keyword: "${keyword}"

Return ONLY a valid JSON object with these exact fields:
{
  "title": "Article title (natural, includes keyword, max 70 chars)",
  "metaTitle": "SEO meta title (max 60 chars, includes keyword, ends with | MR Valuations)",
  "metaDescription": "SEO meta description (max 155 chars, compelling, includes keyword)",
  "category": "one of: valuations, plates, or cars",
  "slug": "kebab-case-url-slug-from-title",
  "content": "Full article HTML string"
}

The content field must be a complete HTML article with this exact structure:
<p>[Intro: 2-3 sentences, keyword in first sentence]</p>
<h2>[Subtopic 1 heading]</h2><p>[150-200 words]</p>
<h2>[Subtopic 2 heading]</h2><p>[150-200 words]</p>
<h2>[Subtopic 3 heading]</h2><p>[150-200 words]</p>
<div class="inline-cta"><p>Want to know what your plate is worth? <a href="/">Get a free instant valuation →</a></p></div>
<h2>[Subtopic 4 heading]</h2><p>[150-200 words]</p>
<h2>Frequently Asked Questions</h2>
<h3>[FAQ question 1]</h3><p>[2-3 sentence answer]</p>
<h3>[FAQ question 2]</h3><p>[2-3 sentence answer]</p>
<h3>[FAQ question 3]</h3><p>[2-3 sentence answer]</p>
<p>[Conclusion: 2-3 sentences ending with a link: <a href="/">Get your free number plate valuation</a> or <a href="/list-plate">list your plate for sale</a>.]</p>

Requirements:
- UK English throughout
- 800-1200 words total
- Include keyword naturally 3-5 times, never stuffed
- Do not include <html>, <head>, <body>, or <h1> tags
- Return ONLY the JSON object, no markdown fences, no extra text`;

  const response = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      contents: [{parts: [{text: prompt}]}],
      generationConfig: {temperature: 0.7},
    },
    {timeout: 60000}
  );

  const rawText: string = response.data.candidates[0].content.parts[0].text;
  // Strip markdown code fences Gemini sometimes adds despite instructions
  const cleaned = rawText
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  return JSON.parse(cleaned) as GeneratedArticle;
}
```

- [ ] **Step 2: Commit**

```bash
git add functions/src/article-generator.ts
git commit -m "feat: add article-generator Cloud Function module (GSC + Gemini)"
```

---

## Task 9: Register scheduled function and store secrets

**Files:**
- Modify: `functions/src/index.ts`

- [ ] **Step 1: Add the defineSecret declarations**

At the top of `functions/src/index.ts`, after the existing `defineSecret` lines, add:

```typescript
const geminiApiKey = defineSecret("GEMINI_API_KEY");
const gscRefreshToken = defineSecret("GSC_REFRESH_TOKEN");
const gscClientId = defineSecret("GSC_CLIENT_ID");
const gscClientSecret = defineSecret("GSC_CLIENT_SECRET");
```

- [ ] **Step 2: Add the import for article-generator**

Add this import with the existing imports at the top of `functions/src/index.ts`:

```typescript
import {runGenerateDailyArticle} from "./article-generator.js";
```

- [ ] **Step 3: Add the scheduled function export**

At the bottom of `functions/src/index.ts`, add:

```typescript
/** Scheduled: runs daily at 08:00 UK time, generates one SEO article from GSC keyword data. */
export const generateDailyArticle = onSchedule(
  {
    schedule: "0 8 * * *",
    timeZone: "Europe/London",
    secrets: ["GEMINI_API_KEY", "GSC_REFRESH_TOKEN", "GSC_CLIENT_ID", "GSC_CLIENT_SECRET"],
    timeoutSeconds: 120,
    memory: "256MiB",
  },
  async () => {
    await runGenerateDailyArticle(
      geminiApiKey.value(),
      gscRefreshToken.value(),
      gscClientId.value(),
      gscClientSecret.value()
    );
  }
);
```

- [ ] **Step 4: Store secrets in Firebase Secret Manager**

Run each of these commands. When prompted, paste the value and press Enter:

```bash
# Gemini API key (from aistudio.google.com)
firebase functions:secrets:set GEMINI_API_KEY
# Value: AIzaSyAc7VOwO8fEZAH7RMiYvHx7XlOHJ4L-yvM

# GSC OAuth refresh token (from scripts/gsc-token.json — copy the "refresh_token" value)
firebase functions:secrets:set GSC_REFRESH_TOKEN
# Value: <refresh_token from scripts/gsc-token.json>

# GSC OAuth client ID (from scripts/gsc-credentials.json — installed.client_id)
firebase functions:secrets:set GSC_CLIENT_ID
# Value: REDACTED

# GSC OAuth client secret (from scripts/gsc-credentials.json — installed.client_secret)
firebase functions:secrets:set GSC_CLIENT_SECRET
# Value: REDACTED
```

- [ ] **Step 5: Build functions to verify TypeScript compiles**

```bash
cd functions && npm run build 2>&1
```

Expected: no TypeScript errors. `dist/` files generated.

- [ ] **Step 6: Commit**

```bash
cd .. && git add functions/src/index.ts
git commit -m "feat: register generateDailyArticle scheduled Cloud Function"
```

---

## Task 10: Build, deploy and smoke test

- [ ] **Step 1: Build the Angular app**

```bash
npm run build:gh-pages
```

Expected: builds cleanly to `docs/`. No errors.

- [ ] **Step 2: Deploy Cloud Functions**

```bash
firebase deploy --only functions
```

Expected: all functions deploy successfully including `generateDailyArticle`.

- [ ] **Step 3: Trigger the function manually to test**

In the Firebase console → Functions → `generateDailyArticle` → click **Run now** (or use the Firebase CLI):

```bash
firebase functions:shell
# Then in the shell:
generateDailyArticle({})
```

After ~30 seconds, check Firestore → `articles` collection. One document should have appeared with a `title`, `slug`, `content`, `category`, `publishedAt`.

- [ ] **Step 4: Verify the article appears in the app**

Open `http://localhost:4200/#/news`. The article card should appear. Click it — the article page should load with the full content and sidebar CTAs.

- [ ] **Step 5: Commit and push production build**

```bash
git add docs/
git commit -m "feat: production build — SEO content pipeline"
git push
```

- [ ] **Step 6: Verify live site**

Open `https://mrvaluations.co.uk/#/news` — the Latest News page should be live with the first article.

---

## Self-Review Notes

- ✅ All spec requirements covered: nav item, listing page, article page, Cloud Function, Firestore model, security rules
- ✅ No TBDs or placeholders — all code is complete
- ✅ Type consistency: `Article`, `ArticleCategory`, `ArticleService` method names are consistent across all tasks
- ✅ `safeContent()` method in article component matches template usage `[innerHTML]="safeContent(article.content)"`
- ✅ `getRelated()` in service matches `relatedArticles$` in component
- ✅ `runGenerateDailyArticle` export in article-generator matches import in index.ts
- ✅ `onSchedule` already imported in index.ts — no new import needed
- ⚠️ Note: The `generationLog` entries array will grow unbounded over time. This is acceptable for now (excluded from scope per spec) but should be paginated or rotated in a future task.
