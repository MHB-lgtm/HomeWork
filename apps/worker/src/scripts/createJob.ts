function main() {
  console.error(
    [
      'worker job:create has been disabled in W2A.',
      'Jobs are now authored through the DB-first web/API path and must not be written into the legacy file queue.',
      'Use POST /api/jobs instead.',
    ].join(' ')
  );
  process.exit(1);
}

main();
