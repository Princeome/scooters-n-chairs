/** @type {import('next').NextConfig} */
module.exports = {
    reactStrictMode: true,
    async redirects() {
      return [
        {
          source: "/collections/:collection/products/:product",
          destination: "/product/:product",
          permanent: true,
        },
        {
          source: "/collections/:collection",
          destination: "/list/:collection/1/sort",
          permanent: true,
        },
      ];
    },
    images: {
      domains: ["cdn.shopify.com", "apo-api.mageworx.com", "i.imgur.com"],
    },
    experimental: {
      scrollRestoration: true,
    },
    webpack: (config) => {
      config.module.rules.push({ test: /\.graphql$/, use: "raw-loader" });
      return config;
    },
    i18n: {
      locales: ["en"],
      defaultLocale: "en",
    },
  };
  