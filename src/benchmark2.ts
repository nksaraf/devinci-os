const common = require('common');
const Readable = require('stream').Readable;

const bench = common.createBenchmark(main, {
  n: [5],
});

async function main({ n }) {
  const arr = [];
  for (let i = 0; i < n; i++) {
    arr.push(`${i} world`);
  }

  const s = new Readable.from(arr);

  bench.start();
  s.on('data', (data) => {
    // eslint-disable-next-line no-unused-expressions
    console.log(data);
  });
  s.on('close', () => {
    bench.end(n);
  });
}

module.exports = { main };
