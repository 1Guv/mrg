import { splitAfterParagraph } from './split-article-content';

describe('splitAfterParagraph', () => {
  const article = '<article><h2>T</h2><p>1</p><p>2</p><div class="card"><p>x</p></div><p>3</p><p>4</p></article>';

  it('splits after the nth paragraph, keeping both halves well-formed', () => {
    expect(splitAfterParagraph(article, 2)).toEqual({
      top: '<article><h2>T</h2><p>1</p><p>2</p></article>',
      rest: '<article><div class="card"><p>x</p></div><p>3</p><p>4</p></article>',
    });
  });

  it('ignores paragraphs inside cards when counting', () => {
    expect(splitAfterParagraph(article, 3)).toBeNull();
  });

  it('returns null for a short article', () => {
    expect(splitAfterParagraph('<p>1</p><p>2</p>', 2)).toBeNull();
  });
});
