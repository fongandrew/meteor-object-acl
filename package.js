Package.describe({
  name: 'fongandrew:object-acl',
  summary: 'Functions for adding access control lists to an existing object ' +
           'within a collection. Sort of the inverse of alanning:roles',
  version: '0.1.0',
  git: '' // Not really publishable yet
});

Package.onUse(function(api) {
  'use strict';

  api.versionsFrom('1.0');
  api.use('check');
  api.use('mongo');
  api.use('underscore');
  api.addFiles('object_acl.js');
  api.export(['ObjectACLSvc'], ['client', 'server']);
});


Package.onTest(function(api) {
  'use strict';

  api.use('tinytest');
  api.use('random');
  api.use('mongo');
  api.use('underscore');
  api.use('fongandrew:object-acl');
  api.addFiles('object_acl_tests.js');
});
