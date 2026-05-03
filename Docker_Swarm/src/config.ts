function parsePort(value: string | undefined): number {
  if (!value) {
    return 3000;
  }

  const port = Number(value);

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error('PORT doit être un entier positif.');
  }

  return port;
}

export const config = {
  host: '0.0.0.0',
  port: parsePort(process.env.PORT)
};