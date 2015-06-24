(function() {
  'use strict';

  var TestCollection;
  if (Meteor.isServer) {
    TestCollection = new Mongo.Collection("objectACLTestCol");
  } 
  else {
    // For client, point collection to unmanaged collection to avoid Meteor's
    // disapproval of untrusted client-side code
    TestCollection = new Mongo.Collection();    
  }
  TestCollection.remove({});  // Reset tests

  var TestSvc = new ObjectACLSvc(TestCollection, {
    readAccess: 10,
    writeAccess: 20
  });

  Tinytest.add('ObjectACL - set new for userId',
    function(test) {
      var objId = TestCollection.insert({});
      var userId = Random.id(17);
      test.equal(TestSvc.set(objId, userId, ['readAccess']), 1);

      var obj = TestCollection.findOne(objId);
      test.equal(TestSvc.get(obj, userId), ['readAccess']);
    });

  Tinytest.add('ObjectACL - set new for email',
    function(test) {
      var objId = TestCollection.insert({});
      var email = 'bob@example.com';
      test.equal(TestSvc.set(objId, {email: email}, ['readAccess']), 1);

      var obj = TestCollection.findOne(objId);
      test.equal(TestSvc.get(obj, {email: email}), ['readAccess']);
    });

  Tinytest.add('ObjectACL - set update for userId',
    function(test) {
      var objId = TestCollection.insert({});
      var userId = Random.id(17);
      test.equal(TestSvc.set(objId, userId, ['readAccess']), 1);
      test.equal(TestSvc.set(objId, userId, ['writeAccess']), 1);

      var obj = TestCollection.findOne(objId);
      test.equal(TestSvc.get(obj, userId), ['writeAccess']);
    });

  Tinytest.add('ObjectACL - set update for email',
    function(test) {
      var objId = TestCollection.insert({});
      var email = 'bob@example.com';
      test.equal(TestSvc.set(objId, {email: email}, ['readAccess']), 1);
      test.equal(TestSvc.set(objId, {email: email}, ['writeAccess']), 1);

      var obj = TestCollection.findOne(objId);
      test.equal(TestSvc.get(obj, {email: email}), ['writeAccess']);
    });

  Tinytest.add('ObjectACL - unset for userId',
    function(test) {
      var objId = TestCollection.insert({});
      var userId = Random.id(17);
      test.equal(TestSvc.set(objId, userId, ['readAccess']), 1);
      test.equal(TestSvc.unset(objId, userId), 1);

      var obj = TestCollection.findOne(objId);
      test.equal(TestSvc.get(obj, userId), []);
    });

  Tinytest.add('ObjectACL - unset for email',
    function(test) {
      var objId = TestCollection.insert({});
      var email = 'bob@example.com';
      test.equal(TestSvc.set(objId, {email: email}, ['readAccess']), 1);
      test.equal(TestSvc.unset(objId, {email: email}), 1);

      var obj = TestCollection.findOne(objId);
      test.equal(TestSvc.get(obj, {email: email}), []);
    });

  Tinytest.add('ObjectACL - cannot remove only super via set',
    function(test) {
      var objId = TestCollection.insert({});
      var userId = Random.id(17);
      test.equal(TestSvc.set(objId, userId, [TestSvc.superPermission]), 1);
      test.equal(TestSvc.set(objId, userId, ['readAccess']), 0);

      var obj = TestCollection.findOne(objId);
      test.equal(TestSvc.get(obj, userId), [TestSvc.superPermission]);
    });

  Tinytest.add('ObjectACL - cannot remove only super via unset',
    function(test) {
      var objId = TestCollection.insert({});
      var userId = Random.id(17);
      test.equal(TestSvc.set(objId, userId, [TestSvc.superPermission]), 1);
      test.equal(TestSvc.unset(objId, userId), 0);

      var obj = TestCollection.findOne(objId);
      test.equal(TestSvc.get(obj, userId), [TestSvc.superPermission]);
    });

  Tinytest.add('ObjectACL - can remove super via set if another is added',
    function(test) {
      var objId = TestCollection.insert({});
      var user1Id = Random.id(17);
      var user2Id = Random.id(17);
      test.equal(TestSvc.set(objId, user1Id, [TestSvc.superPermission]), 1);
      test.equal(TestSvc.set(objId, user2Id, [TestSvc.superPermission]), 1);
      test.equal(TestSvc.set(objId, user1Id, ['readAccess']), 1);

      var obj = TestCollection.findOne(objId);
      test.equal(TestSvc.get(obj, user1Id), ['readAccess']);
      test.equal(TestSvc.get(obj, user2Id), [TestSvc.superPermission]);
    });

  Tinytest.add('ObjectACL - can remove super via unset if another is added',
    function(test) {
      var objId = TestCollection.insert({});
      var user1Id = Random.id(17);
      var user2Id = Random.id(17);
      test.equal(TestSvc.set(objId, user1Id, [TestSvc.superPermission]), 1);
      test.equal(TestSvc.set(objId, user2Id, [TestSvc.superPermission]), 1);
      test.equal(TestSvc.unset(objId, user1Id), 1);

      var obj = TestCollection.findOne(objId);
      test.equal(TestSvc.get(obj, user1Id), []);
      test.equal(TestSvc.get(obj, user2Id), [TestSvc.superPermission]);
    });

  Tinytest.add('ObjectACL - set by email does not count as super (invite only)',
    function(test) {
      var objId = TestCollection.insert({});
      var userId = Random.id(17);
      var email = 'bob@example.com';
      test.equal(TestSvc.set(objId, userId, [TestSvc.superPermission]), 1);
      test.equal(TestSvc.set(objId, {email: email}, 
                             [TestSvc.superPermission]), 1);

      // bob@example.com is not super yet, so removing userId's super status
      // should fail
      test.equal(TestSvc.set(objId, userId, ['readAccess']), 0);
      test.equal(TestSvc.unset(objId, userId), 0);

      var obj = TestCollection.findOne(objId);
      test.equal(TestSvc.get(obj, userId), [TestSvc.superPermission]);
      test.equal(TestSvc.get(obj, {email: email}), [TestSvc.superPermission]);
    });

  Tinytest.add('ObjectACL - Query objects for user', 
    function(test) {
      var obj1Id = TestCollection.insert({name: 'A'});
      var obj2Id = TestCollection.insert({name: 'B'});
      var obj3Id = TestCollection.insert({name: 'C'});
      var user1Id = Random.id(17);
      var user2Id = Random.id(17);

      test.equal(TestSvc.set(obj1Id, user1Id, [TestSvc.superPermission]), 1);
      test.equal(TestSvc.set(obj2Id, user1Id, ['writeAccess']), 1);
      test.equal(TestSvc.set(obj3Id, user1Id, ['readAccess']), 1);
      test.equal(TestSvc.set(obj3Id, user2Id, [TestSvc.superPermission]), 1);

      var objIds = TestSvc.findForUserId(user1Id, 'writeAccess', 
                                         {sort: {name: 1}})
                          .map(function(obj) {
                            return obj._id;
                          });
      
      // Obj1 -> implied via super
      // Obj2 -> exact match
      // Obj3 -> Insufficient permissions
      test.equal(objIds, [obj1Id, obj2Id]);
    });

  Tinytest.add('ObjectACL - Query objects for email', 
    function(test) {
      // Reset for test
      TestCollection.remove({}); 

      var obj1Id = TestCollection.insert({name: 'A'});
      var obj2Id = TestCollection.insert({name: 'B'});
      var obj3Id = TestCollection.insert({name: 'C'});
      var email1 = 'bob@example.com';
      var email2 = 'frank@example.com';

      test.equal(TestSvc.set(obj1Id, {email: email1}, 
                             [TestSvc.superPermission]), 1);
      test.equal(TestSvc.set(obj2Id, {email: email1}, 
                             ['writeAccess']), 1);
      test.equal(TestSvc.set(obj3Id, {email: email1}, 
                             ['readAccess']), 1);
      test.equal(TestSvc.set(obj3Id, {email: email2}, 
                             [TestSvc.superPermission]), 1);

      var objIds = TestSvc.findForEmail(email1, 'writeAccess', 
                                         {sort: {name: 1}})
                          .map(function(obj) {
                            return obj._id;
                          });
      
      // Obj1 -> implied via super
      // Obj2 -> exact match
      // Obj3 -> Insufficient permissions
      test.equal(objIds, [obj1Id, obj2Id]);
    });

  Tinytest.add('ObjectACL - findIf', 
    function(test) {
      // Reset for test
      TestCollection.remove({}); 

      var obj1Id = TestCollection.insert({name: 'A'});
      var obj2Id = TestCollection.insert({name: 'B'});
      var obj3Id = TestCollection.insert({name: 'C'});
      var obj4Id = TestCollection.insert({name: 'D'});
      var userId = Random.id(17);

      test.equal(TestSvc.set(obj1Id, userId, [TestSvc.superPermission]), 1);
      test.equal(TestSvc.set(obj2Id, userId, ['writeAccess']), 1);
      test.equal(TestSvc.set(obj3Id, userId, ['readAccess']), 1);

      // Found => super permissions
      test.equal(
        TestSvc.findIf(obj1Id, userId, 'writeAccess').fetch()[0]._id, 
        obj1Id);

      // Found => exact permissions
      test.equal(
        TestSvc.findIf(obj2Id, userId, 'writeAccess').fetch()[0]._id, 
        obj2Id);

      // Not found => insufficient permissions
      test.isUndefined(
        TestSvc.findIf(obj3Id, userId, 'writeAccess').fetch()[0]);

      // Not found => no permissions
      test.isUndefined(
        TestSvc.findIf(obj4Id, userId, 'writeAccess').fetch()[0]);
    });

  Tinytest.add('ObjectACL - baseObj',
    function(test) {
      var userId = Random.id(17);
      var baseObj = TestSvc.baseObj(userId, ['writeAccess']);
      var objId = TestCollection.insert(baseObj);

      test.equal(
        TestSvc.findIf(objId, userId, 'writeAccess').fetch()[0]._id, 
        objId);
    });

  Tinytest.add('ObjectACL - claim switches email invites to userId',
    function(test) {
      var userId = Random.id(17);
      var email = Random.id(17) + '@example.com';
      var objId = TestCollection.insert({});

      test.equal(TestSvc.set(objId, {email: email}, ['writeAccess']), 1);
      test.equal(TestSvc.claim(objId, email, userId), 1);

      // Email unset, get permissions by userId only
      var obj = TestCollection.findOne(objId);
      test.equal(TestSvc.get(obj, {email: email}), []);
      test.equal(TestSvc.get(obj, {userId: userId}), ['writeAccess']);
    });

  Tinytest.add('ObjectACL - claim adds userId to superList',
    function(test) {
      var userId = Random.id(17);
      var email = Random.id(17) + '@example.com';
      var objId = TestCollection.insert({});

      test.equal(TestSvc.set(objId, {email: email},
                             [TestSvc.superPermission]), 1);
      test.equal(TestSvc.claim(objId, email, userId), 1);

      // Email unset, get permissions by userId only
      var obj = TestCollection.findOne(objId);
      test.equal(TestSvc.get(obj, {userId: userId}), 
                             [TestSvc.superPermission]);
      test.equal(obj[TestSvc._superListVar], [userId]);
    });

  Tinytest.add('ObjectACL - claim does not duplicate userId assignments',
    function(test) {
      var userId = Random.id(17);
      var email = Random.id(17) + '@example.com';
      var objId = TestCollection.insert({});

      // Invite with email
      test.equal(TestSvc.set(objId, {email: email}, ['readAccess']), 1);

      // Grant permissions to userId directly
      test.equal(TestSvc.set(objId, {userId: userId}, ['writeAccess']), 1);

      // No double claiming, permissions remain unchanged
      test.equal(TestSvc.claim(objId, email, userId), 0);

      // Email unset, get permissions by userId only
      var obj = TestCollection.findOne(objId);
      test.equal(TestSvc.get(obj, {email: email}), ['readAccess']);
      test.equal(TestSvc.get(obj, {userId: userId}), ['writeAccess']);
    });

})();


