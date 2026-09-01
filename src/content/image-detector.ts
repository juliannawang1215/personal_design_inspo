export interface DetectedVisualInfo {
  element: HTMLElement;
  src: string;
  mediaType: 'image' | 'gif' | 'video';
  rect: DOMRect;
  width: number;
  height: number;
  sourceUrl: string;
  sourceTitle: string;
}

const MIN_DIMENSION = 60;
const MIN_AREA = 5000;

/**
 * Extract background image URL from an element's computed style
 */
export function getBackgroundImageUrl(element: HTMLElement): string | null {
  try {
    const bg = window.getComputedStyle(element).backgroundImage;
    if (bg && bg !== 'none') {
      const match = bg.match(/url\(['"]?(https?:\/\/[^'"]+|\/[^'"]+|data:image\/[^'"]+)['"]?\)/i);
      if (match && match[1]) {
        return match[1];
      }
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Determine if a URL or element is an animated GIF or video
 */
export function inferMediaType(url: string, element?: HTMLElement): 'image' | 'gif' | 'video' {
  if (element instanceof HTMLVideoElement || element?.querySelector('video')) {
    return 'video';
  }

  const cleanUrl = url.toLowerCase().split('?')[0].split('#')[0];
  if (cleanUrl.endsWith('.gif') || url.includes('.gif?') || url.includes('format=gif') || url.includes('type=gif')) {
    return 'gif';
  }
  if (cleanUrl.endsWith('.mp4') || cleanUrl.endsWith('.webm') || cleanUrl.endsWith('.mov') || url.includes('video/mp4')) {
    return 'video';
  }

  return 'image';
}

/**
 * Parse srcset attribute and return the highest resolution candidate
 */
function getBestFromSrcset(srcset: string): string | null {
  if (!srcset) return null;
  const candidates = srcset.split(',').map((part) => {
    const trimmed = part.trim();
    const [url, descriptor] = trimmed.split(/\s+/);
    let width = 0;
    if (descriptor) {
      if (descriptor.endsWith('w')) width = parseInt(descriptor.slice(0, -1), 10) || 0;
      else if (descriptor.endsWith('x')) width = (parseFloat(descriptor.slice(0, -1)) || 1) * 1000;
    }
    return { url, width };
  });

  candidates.sort((a, b) => b.width - a.width);
  return candidates[0]?.url || null;
}

/**
 * Resolve the highest-fidelity source URL from an image/video/element
 */
export function resolveVisualSource(element: HTMLElement): string {
  // 1. Video elements
  if (element instanceof HTMLVideoElement) {
    const videoSrc =
      element.currentSrc ||
      element.src ||
      element.getAttribute('src') ||
      element.dataset.src ||
      element.getAttribute('data-src') ||
      element.getAttribute('data-video-url');
    if (videoSrc) return resolveAbsoluteUrl(videoSrc);

    const sourceEl = element.querySelector('source');
    if (sourceEl) {
      const s =
        sourceEl.src ||
        sourceEl.getAttribute('src') ||
        sourceEl.dataset.src ||
        sourceEl.getAttribute('data-src');
      if (s) return resolveAbsoluteUrl(s);
    }
    if (element.poster) return resolveAbsoluteUrl(element.poster);
  }

  // Check if container element has a video
  const nestedVideo = element.querySelector('video');
  if (nestedVideo) {
    const videoSrc =
      nestedVideo.currentSrc ||
      nestedVideo.src ||
      nestedVideo.getAttribute('src') ||
      nestedVideo.dataset.src ||
      nestedVideo.getAttribute('data-src');
    if (videoSrc) return resolveAbsoluteUrl(videoSrc);
  }

  // 2. Image elements
  if (element instanceof HTMLImageElement) {
    const dataset = element.dataset;
    const candidateDataAttrs = [
      dataset.gifUrl,
      dataset.animatedUrl,
      dataset.original,
      dataset.originalSrc,
      dataset.actualsrc,
      dataset.fullSrc,
      dataset.zoomSrc,
      dataset.largeFile,
      dataset.src,
      dataset.lazySrc,
      dataset.url,
      element.getAttribute('data-gif-url'),
      element.getAttribute('data-original'),
      element.getAttribute('data-actualsrc'),
      element.getAttribute('data-src'),
    ];

    for (const attr of candidateDataAttrs) {
      if (attr && typeof attr === 'string' && attr.trim().length > 0) {
        return resolveAbsoluteUrl(attr.trim());
      }
    }

    const srcset = element.getAttribute('srcset') || element.srcset;
    if (srcset) {
      const bestFromSrcset = getBestFromSrcset(srcset);
      if (bestFromSrcset) return resolveAbsoluteUrl(bestFromSrcset);
    }

    const picture = element.closest('picture');
    if (picture) {
      const source = picture.querySelector('source[srcset]');
      if (source) {
        const sourceSrcset = source.getAttribute('srcset');
        if (sourceSrcset) {
          const best = getBestFromSrcset(sourceSrcset);
          if (best) return resolveAbsoluteUrl(best);
        }
      }
    }

    const standardSrc = element.currentSrc || element.src || element.getAttribute('src') || '';
    if (standardSrc) return resolveAbsoluteUrl(standardSrc);
  }

  // 3. CSS background-image
  const bgUrl = getBackgroundImageUrl(element);
  if (bgUrl) return resolveAbsoluteUrl(bgUrl);

  return '';
}

function resolveAbsoluteUrl(url: string): string {
  try {
    return new URL(url, window.location.href).href;
  } catch {
    return url;
  }
}

/**
 * Clean URL by stripping tracking parameters (UTM, ref, fbclid, etc.)
 */
function cleanTrackingParams(rawUrl: string): string {
  try {
    const url = new URL(rawUrl, window.location.href);
    const paramsToDelete: string[] = [];
    url.searchParams.forEach((_, key) => {
      const lower = key.toLowerCase();
      if (
        lower.startsWith('utm_') ||
        lower === 'ref' ||
        lower === 'source' ||
        lower === 'fbclid' ||
        lower === 'gclid' ||
        lower === 'igshid' ||
        lower === 'feature' ||
        lower === 'si' ||
        lower === 'spm' ||
        lower === 'from' ||
        lower === 'share_id' ||
        lower === 'sender'
      ) {
        paramsToDelete.push(key);
      }
    });
    paramsToDelete.forEach((key) => url.searchParams.delete(key));
    return url.href;
  } catch {
    return rawUrl;
  }
}

/**
 * Filter out invalid, javascript, or generic non-post links
 */
function isValidPostLink(href: string): boolean {
  if (!href) return false;
  const lower = href.toLowerCase().trim();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('mailto:') ||
    lower.startsWith('tel:') ||
    lower.endsWith('#') ||
    lower === window.location.href + '#' ||
    lower === window.location.origin + '#'
  ) {
    return false;
  }

  // Avoid generic navigation / auth / account links
  if (
    lower.includes('/login') ||
    lower.includes('/signin') ||
    lower.includes('/signup') ||
    lower.includes('/register') ||
    lower.includes('/settings') ||
    lower.includes('/terms') ||
    lower.includes('/privacy') ||
    lower.includes('/logout') ||
    lower.includes('/about') ||
    lower.includes('/contact') ||
    lower.includes('/help') ||
    lower.includes('/notifications') ||
    lower.includes('/messages')
  ) {
    return false;
  }

  return true;
}

/**
 * Regex patterns for major inspiration, social, and visual platforms
 */
const SPECIFIC_POST_PATTERNS = [
  /\/pin\/[0-9a-zA-Z_-]+/i,               // Pinterest: /pin/123456/
  /\/explore\/[0-9a-zA-Z_-]+/i,           // Xiaohongshu (小红书): /explore/65abc...
  /\/discovery\/item\/[0-9a-zA-Z_-]+/i,   // Xiaohongshu fallback
  /\/p\/[0-9a-zA-Z_-]+/i,                 // Instagram post: /p/CxYz/
  /\/reel\/[0-9a-zA-Z_-]+/i,              // Instagram reel: /reel/CxYz/
  /\/tv\/[0-9a-zA-Z_-]+/i,                // Instagram TV
  /\/status\/[0-9]+/i,                    // X / Twitter: /user/status/123456789
  /\/shots\/[0-9a-zA-Z_-]+/i,             // Dribbble: /shots/12345-title
  /\/photos\/[0-9a-zA-Z_-]+/i,            // Unsplash: /photos/xyz
  /\/gallery\/[0-9]+\/[^/?#]+/i,          // Behance: /gallery/123/Project
  /\/artwork\/[0-9a-zA-Z_-]+/i,           // ArtStation: /artwork/xyz
  /\/projects\/[0-9a-zA-Z_-]+/i,          // ArtStation projects
  /\/comments\/[0-9a-zA-Z_-]+/i,          // Reddit: /r/sub/comments/123/title
  /\/block\/[0-9]+/i,                     // Are.na: /block/123
  /\/post\/[0-9a-zA-Z_-]+/i,              // General / Tumblr post
  /\/item\/[0-9a-zA-Z_-]+/i,              // General item
  /\/p\/[0-9]+/i,                         // Zhihu / general article
  /\/answer\/[0-9]+/i,                    // Zhihu answer
  /\/detail\/[0-9a-zA-Z_-]+/i,            // Weibo / news detail
  /\/video\/[0-9a-zA-Z_-]+/i,             // Bilibili / TikTok video
  /\/opus\/[0-9]+/i,                      // Bilibili opus
  /\/watch\?v=[0-9a-zA-Z_-]+/i,           // YouTube video
  /\/shorts\/[0-9a-zA-Z_-]+/i,            // YouTube shorts
  /\/products\/[0-9a-zA-Z_-]+/i,          // E-commerce product
  /\/dp\/[0-9a-zA-Z_-]+/i,                // Amazon product
  /\/\d{4}\/\d{2}\/\d{2}\/[^/?#]+/i,      // Date-based blog permalinks (/2024/05/20/slug)
];

/**
 * Score a candidate URL based on specificity
 */
function scoreCandidateUrl(href: string): number {
  if (!isValidPostLink(href)) return -1;

  try {
    const url = new URL(href, window.location.href);

    // Filter out root/homepages
    if (url.pathname === '/' || url.pathname === '') return -1;
    if (url.href === window.location.origin || url.href === window.location.origin + '/') return -1;

    // Check specific patterns
    for (const pattern of SPECIFIC_POST_PATTERNS) {
      if (pattern.test(url.pathname + url.search)) {
        return 100;
      }
    }

    // Check deep paths (more than 1 path segment)
    const segments = url.pathname.split('/').filter(Boolean);
    if (segments.length >= 2) {
      return 60 + segments.length * 5;
    }
    if (segments.length === 1 && segments[0].length > 4) {
      return 40;
    }

    return 20;
  } catch {
    return -1;
  }
}

/**
 * Clean and extract title from link, card container, or image
 */
function extractTitleFromContext(
  mediaEl: HTMLElement,
  link?: HTMLAnchorElement | null,
  cardContainer?: Element | null
): string {
  // 1. Image alt or aria-label (often the most descriptive text)
  if (mediaEl instanceof HTMLImageElement && mediaEl.alt && mediaEl.alt.trim().length > 2) {
    return mediaEl.alt.trim();
  }
  if (mediaEl.getAttribute('aria-label')) {
    return mediaEl.getAttribute('aria-label')!.trim();
  }

  // 2. Headings inside the card container
  if (cardContainer) {
    const heading = cardContainer.querySelector(
      'h1, h2, h3, h4, [class*="title"], [class*="caption"], [class*="desc"], [class*="name"], [class*="header"], .credit'
    );
    if (heading && heading.textContent) {
      const text = heading.textContent.trim();
      if (text.length > 2 && text.length < 150) {
        return text;
      }
    }
  }

  // 3. Link title, aria-label, or text
  if (link) {
    const linkTitle = link.getAttribute('title') || link.getAttribute('aria-label');
    if (linkTitle && linkTitle.trim().length > 2) {
      return linkTitle.trim();
    }
    if (link.innerText) {
      const text = link.innerText.trim();
      if (text.length > 2 && text.length < 150 && !text.includes('\n')) {
        return text;
      }
    }
  }

  // 4. Page title fallback
  return document.title || window.location.hostname;
}

/**
 * Resolve specific post/item URL and title from enclosing link or card structure
 */
export function resolvePostContext(element: HTMLElement): { url: string; title: string } {
  // SPECIAL HANDLER: ohwow.design
  if (window.location.hostname.includes('ohwow.design')) {
    // 1. Check if inside sheet / lightbox modal
    const sheetLink = document.getElementById('sheet-link') as HTMLAnchorElement | null;
    if (sheetLink && sheetLink.href && sheetLink.href.includes('x.com')) {
      const sheetText = document.getElementById('sheet-text')?.textContent || '';
      const sheetAuthor = document.getElementById('sheet-name')?.textContent || '';
      return {
        url: cleanTrackingParams(sheetLink.href),
        title: sheetText ? `${sheetAuthor}: ${sheetText}`.trim() : (sheetAuthor ? `Post by ${sheetAuthor}` : 'Design from X'),
      };
    }

    // 2. Check card container on the wall
    const card = element.closest('.card, button[data-post], [class*="card"]');
    if (card) {
      const authorEl = card.querySelector('.credit .name, .name, [class*="name"]');
      const author = authorEl?.textContent?.replace('@', '').trim() || '';
      const imgEl = card.querySelector('img, video');
      const src =
        imgEl?.getAttribute('src') ||
        imgEl?.getAttribute('data-src') ||
        resolveVisualSource(element);
      const tweetMatch = src.match(/\/files\/([0-9]+)\//);
      if (tweetMatch && tweetMatch[1]) {
        const tweetId = tweetMatch[1];
        const authorSlug = author || 'i';
        const tweetUrl = `https://x.com/${authorSlug}/status/${tweetId}`;
        const title = imgEl?.getAttribute('alt') || (author ? `Post by @${author}` : 'Design from X');
        return {
          url: tweetUrl,
          title: title,
        };
      }
    }
  }

  let bestUrl = '';
  let bestScore = -1;
  let matchedLink: HTMLAnchorElement | null = null;
  let matchedContainer: Element | null = null;

  // Platform-specific ID attributes checking on an element
  const checkElementForPlatformId = (el: HTMLElement): string | null => {
    const origin = window.location.origin;

    // Pinterest
    const pinId =
      el.getAttribute('data-pin-id') ||
      el.getAttribute('data-test-pin-id') ||
      (el.dataset && el.dataset.pinId);
    if (pinId) {
      return `${origin}/pin/${pinId}/`;
    }

    // Xiaohongshu (小红书)
    const noteId = el.getAttribute('data-note-id') || (el.dataset && el.dataset.noteId);
    if (noteId) {
      return `https://www.xiaohongshu.com/explore/${noteId}`;
    }

    // Generic post/item dataset IDs
    const dataset = el.dataset || {};
    if (dataset.permalink) return resolveAbsoluteUrl(dataset.permalink);
    if (dataset.href) return resolveAbsoluteUrl(dataset.href);
    if (dataset.url) return resolveAbsoluteUrl(dataset.url);
    if (dataset.targetUrl) return resolveAbsoluteUrl(dataset.targetUrl);

    // Reddit shreddit-post
    if (el.tagName.toLowerCase() === 'shreddit-post' && el.getAttribute('permalink')) {
      return resolveAbsoluteUrl(el.getAttribute('permalink')!);
    }

    return null;
  };

  // 1. Direct enclosing <a> tag
  const directLink = element.closest('a[href]') as HTMLAnchorElement | null;
  if (directLink) {
    const score = scoreCandidateUrl(directLink.href);
    if (score > 0) {
      bestUrl = directLink.href;
      bestScore = score;
      matchedLink = directLink;
    }
  }

  // 2. Check modal / lightbox container if image is inside a detail popup
  const modalContainer = element.closest(
    '[role="dialog"], [class*="modal"], [class*="lightbox"], [class*="overlay"], [class*="popup"], [class*="detail"], .sheet'
  );
  if (modalContainer) {
    // If the browser URL changed to a specific post (e.g. Pinterest/Instagram/X detail view)
    const pageScore = scoreCandidateUrl(window.location.href);
    if (pageScore >= 100) {
      bestUrl = window.location.href;
      bestScore = 200;
      matchedContainer = modalContainer;
    } else {
      // Find links inside modal
      const modalLinks = Array.from(modalContainer.querySelectorAll('a[href]')) as HTMLAnchorElement[];
      for (const link of modalLinks) {
        const score = scoreCandidateUrl(link.href);
        if (score > bestScore) {
          bestScore = score;
          bestUrl = link.href;
          matchedLink = link;
          matchedContainer = modalContainer;
        }
      }
    }
  }

  // 3. Multi-tier upward ancestor traversal (up to 15 levels)
  let curr: HTMLElement | null = element.parentElement;
  let depth = 0;

  while (curr && curr !== document.body && depth < 15) {
    // a. Check platform ID attributes on this ancestor
    const directPlatformUrl = checkElementForPlatformId(curr);
    if (directPlatformUrl) {
      bestUrl = directPlatformUrl;
      bestScore = 300;
      matchedContainer = curr;
      break;
    }

    // b. Check all links inside this ancestor
    const links = Array.from(curr.querySelectorAll('a[href]')) as HTMLAnchorElement[];
    for (const link of links) {
      const score = scoreCandidateUrl(link.href);
      if (score > bestScore) {
        bestScore = score;
        bestUrl = link.href;
        matchedLink = link;
        matchedContainer = curr;

        // If we found an exact post match (score >= 100), we can stop traversing higher
        if (bestScore >= 100) break;
      }
    }

    if (bestScore >= 100) break;

    // c. Check next/prev sibling of image wrapper
    const nextSibling = curr.nextElementSibling;
    if (nextSibling) {
      const sibLinks = Array.from(nextSibling.querySelectorAll('a[href]')) as HTMLAnchorElement[];
      for (const link of sibLinks) {
        const score = scoreCandidateUrl(link.href);
        if (score > bestScore) {
          bestScore = score;
          bestUrl = link.href;
          matchedLink = link;
          matchedContainer = curr.parentElement;
        }
      }
    }

    curr = curr.parentElement;
    depth++;
  }

  // 4. Fallback to current page URL if score is too low or not found
  if (!bestUrl || bestScore < 0) {
    bestUrl = window.location.href;
  }

  // Clean tracking params
  const finalUrl = cleanTrackingParams(resolveAbsoluteUrl(bestUrl));
  const finalTitle = extractTitleFromContext(element, matchedLink, matchedContainer);

  return {
    url: finalUrl,
    title: finalTitle,
  };
}

/**
 * Validate visual element dimensions and visibility
 */
export function isValidVisualElement(element: HTMLElement): boolean {
  if (!element.isConnected) return false;

  const rect = element.getBoundingClientRect();
  const width = rect.width || element.offsetWidth || 0;
  const height = rect.height || element.offsetHeight || 0;

  // Filter tiny icons, avatar badges, tracking pixels
  if (width < MIN_DIMENSION || height < MIN_DIMENSION || (width * height < MIN_AREA)) {
    return false;
  }

  // Check computed visibility
  const style = window.getComputedStyle(element);
  if (
    style.display === 'none' ||
    style.visibility === 'hidden' ||
    parseFloat(style.opacity || '1') < 0.05
  ) {
    return false;
  }

  // Check resolved source URL
  const src = resolveVisualSource(element);
  if (!src || (src.startsWith('data:image/svg+xml') && (width < 150 || height < 150))) {
    return false;
  }

  return true;
}

/**
 * Extract target visual element from mouse event or coordinate
 */
export function findTargetVisualElement(target: EventTarget | null, clientX?: number, clientY?: number): HTMLElement | null {
  // 1. Check all elements at cursor point (handles transparent overlays, gradients, hover wrappers)
  if (typeof clientX === 'number' && typeof clientY === 'number') {
    try {
      const elementsAtPoint = document.elementsFromPoint(clientX, clientY);
      for (const el of elementsAtPoint) {
        if (el.id === 'inspo-shadow-host' || el.closest('#inspo-shadow-host')) continue;

        if (el instanceof HTMLImageElement && isValidVisualElement(el)) return el;
        if (el instanceof HTMLVideoElement && isValidVisualElement(el)) return el;
        if (el instanceof HTMLElement && getBackgroundImageUrl(el) && isValidVisualElement(el)) return el;

        // Check if element has a direct child img/video
        const child = el.querySelector('img, video') as HTMLElement | null;
        if (child && isValidVisualElement(child)) return child;

        // Check parent
        const parent = el.parentElement;
        if (parent) {
          const parentMedia = parent.querySelector('img, video') as HTMLElement | null;
          if (parentMedia && isValidVisualElement(parentMedia)) return parentMedia;
        }
      }
    } catch {
      // ignore
    }
  }

  if (!target || !(target instanceof HTMLElement)) return null;

  // 2. Direct media on target
  if (target instanceof HTMLImageElement || target instanceof HTMLVideoElement) {
    return isValidVisualElement(target) ? target : null;
  }

  if (getBackgroundImageUrl(target) && isValidVisualElement(target)) {
    return target;
  }

  // 3. Child media inside target
  const childMedia = target.querySelector('img, video') as HTMLElement | null;
  if (childMedia && isValidVisualElement(childMedia)) {
    return childMedia;
  }

  // 4. Closest container wrapper
  const container = target.closest('picture, figure, a, [role="img"], article, li, section, button.card, [class*="card"]');
  if (container instanceof HTMLElement) {
    const nested = container.querySelector('img, video') as HTMLElement | null;
    if (nested && isValidVisualElement(nested)) {
      return nested;
    }
    if (getBackgroundImageUrl(container) && isValidVisualElement(container)) {
      return container;
    }
  }

  return null;
}

/**
 * Build detected info object for a visual element
 */
export function getDetectedVisualInfo(element: HTMLElement): DetectedVisualInfo {
  const rect = element.getBoundingClientRect();
  const src = resolveVisualSource(element);
  const mediaType = inferMediaType(src, element);
  const postContext = resolvePostContext(element);

  let naturalWidth = 0;
  let naturalHeight = 0;
  if (element instanceof HTMLImageElement) {
    naturalWidth = element.naturalWidth;
    naturalHeight = element.naturalHeight;
  } else if (element instanceof HTMLVideoElement) {
    naturalWidth = element.videoWidth;
    naturalHeight = element.videoHeight;
  }

  return {
    element,
    src,
    mediaType,
    rect,
    width: Math.round(rect.width || naturalWidth),
    height: Math.round(rect.height || naturalHeight),
    sourceUrl: postContext.url,
    sourceTitle: postContext.title,
  };
}
