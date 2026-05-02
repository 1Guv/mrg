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

  /** Returns up to 4 articles in the same category (caller filters out the current article client-side). */
  getRelated(category: ArticleCategory): Observable<Article[]> {
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
