module.exports = {
  ci: {
    collect: {
      numberOfRuns: 3, // median of 3 — single runs on shared CI runners are noisy (0.89 vs 0.9 threshold observed)
      // G-42: Lighthouse runs on 4174, NOT Playwright's 4173. Playwright starts
      // `next dev -p 4173` and tears it down immediately before this; reusing the port
      // raced against socket release and produced intermittent
      // CHROME_INTERSTITIAL_ERROR on ~half of CI runs.
      // `next build` also moved out of startServerCommand: a 30-60s build inside the
      // ready-wait window could outrun it, leaving Chrome pointed at a dead port.
      startServerCommand: "pnpm exec next start -p 4174",
      startServerReadyPattern: "Ready in",
      startServerReadyTimeout: 60000,
      url: ["http://127.0.0.1:4174/"],
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
      outputDir: "../../playwright-report/lighthouse",
    },
  },
};
