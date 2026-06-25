import { db } from './src/database/client';
import { getEarningsByDayRange } from './src/database/queries/analytics';

async function test() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 7);
  const data = await getEarningsByDayRange(start, end);
  console.log(JSON.stringify(data));
  process.exit(0);
}

test();
