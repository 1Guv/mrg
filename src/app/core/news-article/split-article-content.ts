export interface SplitContent {
  top: string;
  rest: string;
}

/**
 * Splits article HTML after its nth body paragraph so a box can sit between
 * the halves. Ranges clone any wrapping elements (the generated <article>),
 * so both halves stay well-formed. Paragraphs inside cards (divs) don't count.
 * Returns null when the article is too short to split.
 */
export function splitAfterParagraph(html: string, n: number, minParagraphs = n + 2): SplitContent | null {
  if (typeof DOMParser === 'undefined') return null;
  const body = new DOMParser().parseFromString(html, 'text/html').body;
  const paragraphs = Array.from(body.querySelectorAll('p')).filter(p => !p.closest('div'));
  if (paragraphs.length < minParagraphs) return null;

  const split = paragraphs[n - 1];
  const top = document.createRange();
  top.setStartBefore(body.firstChild!);
  top.setEndAfter(split);
  const rest = document.createRange();
  rest.setStartAfter(split);
  rest.setEndAfter(body.lastChild!);

  return { top: serialise(top.cloneContents()), rest: serialise(rest.cloneContents()) };
}

function serialise(fragment: DocumentFragment): string {
  const div = document.createElement('div');
  div.appendChild(fragment);
  return div.innerHTML;
}
