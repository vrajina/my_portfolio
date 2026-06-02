// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://my-portfolio-seven-rho-enkotkigkq.vercel.app',
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/v1') && !page.includes('/v3'),
    }),
  ],
});
