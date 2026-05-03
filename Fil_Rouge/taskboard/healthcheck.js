const port = process.env.PORT || 3000;
const url = `http://127.0.0.1:${port}/health`;

(async () => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);

  try {
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      process.exit(1);
    }

    const payload = await response.json().catch(() => null);

    if (!payload || payload.status !== 'ok') {
      process.exit(1);
    }

    process.exit(0);
  } catch (error) {
    process.exit(1);
  } finally {
    clearTimeout(timeout);
  }
})();