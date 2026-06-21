// run-all.ts -- Run the full research series sequentially and (re)write every
// paper under docs/research/. Each experiment is self-contained; importing it
// executes its run.  Usage:  npx vite-node experiments/run-all.ts

const EXPERIMENTS = [
  'e1-fitness-polar',
  'e2-tacking-vmg',
  'e3-mutation-ridge',
  'e4-sex-vs-clone',
  'e5-brain-size',
  'e6-specialist-generalist',
  'e7-founder-effect',
];

for (const name of EXPERIMENTS) {
  // eslint-disable-next-line no-console
  console.log(`\n${'='.repeat(60)}\n  ${name}\n${'='.repeat(60)}`);
  await import(new URL(`./${name}.ts`, import.meta.url).href);
}

// eslint-disable-next-line no-console
console.log('\nAll experiments complete. Papers in docs/research/.');
