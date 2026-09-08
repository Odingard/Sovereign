module.exports = {
  ci: {
    collect: {
      numberOfRuns: 1,
      startServerCommand: "pnpm exec next dev -p 4173",
      startServerReadyPattern: "Ready in",
      url: ["http://127.0.0.1:4173/"],
      settings: {
        chromeFlags: "--headless=new --no-sandbox",
        onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
      },
    },
    assert: {
      assertions: {
        "categories:performance": ["error", { minScore: 0.9 }],
        "categories:accessibility": ["error", { minScore: 0.95 }],
        "categories:best-practices": ["error", { minScore: 0.95 }],
        "categories:seo": ["error", { minScore: 0.95 }],
      },
    },
    upload: {
      target: "filesystem",
      outputDir: "../../test-results/marketing-browser/lighthouse",
    },
  },
};
