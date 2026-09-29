import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, of } from 'rxjs';
import { Timestamp } from '@angular/fire/firestore';
import { LatestArticleBannerComponent } from './latest-article-banner.component';
import { ArticleService } from '../../services/article.service';
import { Article } from '../../models/article.model';

function article(over: Partial<Article>): Article {
  return {
    id: 'a1',
    slug: 'a-slug',
    title: 'An article title',
    metaTitle: 'Meta',
    metaDescription: 'Meta description',
    category: 'plates',
    targetKeyword: 'plates',
    content: '<p>Body</p>',
    readTimeMinutes: 4,
    publishedAt: Timestamp.fromDate(new Date('2026-09-01')),
    ...over,
  } as Article;
}

describe('LatestArticleBannerComponent', () => {
  let fixture: ComponentFixture<LatestArticleBannerComponent>;

  async function setup(articles: Article[]) {
    await TestBed.configureTestingModule({
      imports: [LatestArticleBannerComponent],
      providers: [
        provideRouter([]),
        {
          provide: ArticleService,
          useValue: {
            getArticles: (): Observable<Article[]> => of(articles),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LatestArticleBannerComponent);
    fixture.detectChanges();
  }

  const banner = (): HTMLElement | null =>
    fixture.nativeElement.querySelector('.latest-article');

  it('shows the newest article, which getArticles returns first', async () => {
    await setup([
      article({ slug: 'newest', title: 'The newest article' }),
      article({ slug: 'older', title: 'An older article' }),
    ]);
    const text = banner()?.textContent ?? '';
    expect(text).toContain('The newest article');
    expect(text).not.toContain('An older article');
  });

  it('links through to that article', async () => {
    await setup([article({ slug: 'why-plates-sell' })]);
    const link: HTMLAnchorElement | null =
      fixture.nativeElement.querySelector('.latest-article__link');
    expect(link?.getAttribute('href')).toBe('/news/why-plates-sell');
  });

  it('labels the strip so readers know it is the latest article', async () => {
    await setup([article({})]);
    expect(banner()?.textContent).toContain('Latest');
  });

  it('renders nothing when no articles have been published', async () => {
    await setup([]);
    expect(banner()).toBeNull();
  });
});
