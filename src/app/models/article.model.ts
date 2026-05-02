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
