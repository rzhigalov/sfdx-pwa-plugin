import { expect, test } from '@salesforce/command/lib/test';

describe('react:init', () => {
  test
    .withProject({})
    .stdout()
    .command(['react:init'])
    .it('runs react:org', ctx => {
      expect(ctx.stdout).to.contain('NOT IMPLEMENTED - WIP');
    });
});
