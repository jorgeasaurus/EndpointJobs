// Crawlers that run page JavaScript. HeadlessChrome stays out so local tests
// still exercise the board fetch.
const knownCrawlerUserAgent =
  /(?:Googlebot|GoogleOther|Google-InspectionTool|Storebot-Google|AdsBot-Google|Mediapartners-Google|bingbot|DuckDuckBot|Baiduspider|YandexBot|Applebot|PetalBot|Bytespider|GPTBot|ChatGPT-User|OAI-SearchBot|ClaudeBot|Claude-SearchBot|PerplexityBot|Amazonbot|CCBot|SemrushBot|AhrefsBot|facebookexternalhit)/;

export function isKnownCrawler(userAgent: string) {
  return knownCrawlerUserAgent.test(userAgent);
}
