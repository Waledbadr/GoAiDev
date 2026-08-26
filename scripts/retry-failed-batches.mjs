import { execSync } from 'child_process';
import path from 'path';

const failedBatches = [71, 75, 76, 77, 78, 79, 80];

async function retryBatches() {
  console.log(`🔁 Retrying ${failedBatches.length} batches to Remote Cloudflare D1...`);
  
  for (const batchNum of failedBatches) {
    const bPath = path.resolve('data_exports', `d1-migration-batch-${batchNum}.sql`);
    let attempts = 0;
    let succeeded = false;

    while (attempts < 3 && !succeeded) {
      attempts++;
      console.log(`⏳ Executing batch ${batchNum} (attempt ${attempts})...`);
      try {
        execSync(`npx wrangler d1 execute estatecare --remote --file="${bPath}" --yes`, {
          stdio: 'inherit',
          encoding: 'utf8'
        });
        succeeded = true;
        console.log(`✅ Batch ${batchNum} applied successfully!`);
      } catch (err) {
        console.warn(`⚠️ Batch ${batchNum} attempt ${attempts} failed, waiting 2s...`);
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  }

  console.log('🎉 All retry batches processed.');
}

retryBatches();
