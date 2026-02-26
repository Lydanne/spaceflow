import { exec } from '@spaceflow/core';
import ext0 from '@spaceflow/shell';
import ext1 from '@spaceflow/scripts';
import ext2 from '@spaceflow/review';
import ext3 from '@spaceflow/publish';

async function bootstrap() {
  await exec([
    ext0,
    ext1,
    ext2,
    ext3,
  ]);
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});