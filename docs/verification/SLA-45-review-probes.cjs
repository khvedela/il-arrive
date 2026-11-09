const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const assert = require('node:assert/strict');
const root = path.resolve(process.argv[2] || '.review-tmp/privacy/apps/api');
const r = createRequire(path.join(root, 'package.json'));
r('ts-node').register({ project: path.join(root, 'tsconfig.json'), transpileOnly: true });
const { ConsoleSmsProvider } = r('./src/modules/notification/providers/console-sms.provider.ts');
const { GlobalErrorFilter } = r('./src/common/global-error.filter.ts');
const { RetentionService } = r('./src/modules/retention/retention.service.ts');
(async () => {
  const logs = [];
  const sms = new ConsoleSmsProvider();
  sms.logger.log = line => logs.push(line);
  await sms.send('+33600000000', 'Suivi : https://example.test/t/fixture-token', 'fixture');
  assert(logs.some(x => x.includes('+33600000000') && x.includes('fixture-token')));
  console.log('REPRODUCED: console SMS logger emits phone and raw tracking token');
  const oldError = console.error;
  console.error = (...args) => logs.push(args.join(' '));
  try {
    new GlobalErrorFilter().catch(new Error('fixture'), { switchToHttp: () => ({ getRequest: () => ({method:'GET', url:'/public/track/fixture-token'}), getResponse: () => ({status: () => ({json: () => {}})}) }) });
  } finally { console.error = oldError; }
  assert(logs.some(x => x.includes('/public/track/fixture-token')));
  console.log('REPRODUCED: global error filter emits raw public tracking URL');
  const customer = { id:'customer', name:'Fixture', phone:'+33600000000', email:'fixture@example.test' };
  const intervention = {id:'old-job', addressLabel:'Fixture street', addressLat:48, addressLng:2, description:'Fixture PII'};
  const calls = [];
  const prisma = {
    intervention: {findMany:async () => [intervention], update:async a => Object.assign(intervention,a.data)},
    customer: {findMany:async () => [customer], update:async a => Object.assign(customer,a.data)},
    notification: {deleteMany:async () => ({count:0})},
    auditLog: {deleteMany:async () => ({count:0})},
    trackingLink: {findMany:async a => {calls.push(a);return [];}}
  };
  const retention = new RetentionService(prisma, {});
  retention.logger.log = () => {};
  retention.logger.error = () => {};
  await retention.sweep(new Date('2026-11-09T00:00:00Z'));
  assert.equal(customer.name,'Anonymisé');
  assert.equal(customer.phone,'+33600000000');
  assert.equal(customer.email,'fixture@example.test');
  assert.equal(intervention.addressLabel,'Fixture street');
  assert.equal(intervention.addressLat,48);
  assert.equal(intervention.description,'Fixture PII');
  assert.equal(calls[0].where.revokedAt,null);
  console.log('REPRODUCED: retention preserves phone/email/address/coordinates/description and excludes revoked links');
})().catch(e => { console.error(e); process.exitCode = 1; });
