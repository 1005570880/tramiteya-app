// simple test runner for repository layer

const { procedureStorage } = require('../src/lib/procedureStorage');

function run() {
  console.log('Running simple procedureStorage tests...');
  // create
  const inst = procedureStorage.create('proc_test', 'proc-test', { a: 'b' });
  console.assert(inst.procedureSlug === 'proc-test', 'create slug');
  const fetched = procedureStorage.get(inst.id);
  console.assert(fetched && fetched.id === inst.id, 'get instance');
  const list = procedureStorage.list();
  console.assert(Array.isArray(list), 'list is array');
  procedureStorage.update(inst.id, { status: 'document_ready' });
  const updated = procedureStorage.get(inst.id);
  console.assert(updated && updated.status === 'document_ready', 'update status');
  procedureStorage.remove(inst.id);
  const after = procedureStorage.get(inst.id);
  console.assert(after === null, 'remove');
  console.log('All procedureStorage checks passed.');
}

run();
