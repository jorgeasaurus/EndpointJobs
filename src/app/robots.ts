import type { MetadataRoute } from "next";

import { siteUrl } from "./site-metadata";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/"
      },
      {
        userAgent: "Googlebot",
        allow: "/"
      }
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl
  };
}
