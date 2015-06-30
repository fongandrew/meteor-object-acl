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

  Tinytest.add('ObjectACL - add new for userId',
    function(test) {
      var objId = TestCollection.insert({});
      var userId = Random.id(17);
      test.equal(TestSvc.add(objId, {userId: userId}, ['readAccess']), 1);

      var obj = TestCollection.findOne(objId);
      test.equal(TestSvc.get(obj, {userId: userId}), ['readAccess']);
    });

  Tinytest.add('ObjectACL - add new for email',
    function(test) {
      var objId = TestCollection.insert({});
      var email = 'bob@example.com';
      test.equal(TestSvc.add(objId, {email: email}, ['readAccess']), 1);

      var obj = TestCollection.findOne(objId);
      test.equal(TestSvc.get(obj, {email: email}), ['readAccess']);
    });

  Tinytest.add('ObjectACL - add does not duplicate userId',
    function(test) {
      var objId = TestCollection.insert({});
      var userId = Random.id(17);
      test.equal(TestSvc.add(objId, {userId: userId}, ['readAccess']), 1);
      test.equal(TestSvc.add(objId, {userId: userId}, ['writeAccess']), 0);

      var obj = TestCollection.findOne(objId);
      test.equal(TestSvc.get(obj, {userId: userId}), ['readAccess']);
    });

  Tinytest.add('ObjectACL - add does not duplicate email',
    function(test) {
      var objId = TestCollection.insert({});
      var userId = 'bob@example.com';
      test.equal(TestSvc.add(objId, {userId: userId}, ['readAccess']), 1);
      test.equal(TestSvc.add(objId, {userId: userId}, ['writeAccess']), 0);

      var obj = TestCollection.findOne(objId);
      test.equal(TestSvc.get(obj, {userId: userId}), ['readAccess']);
    });

  Tinytest.add('ObjectACL - change for userId',
    function(test) {
      var objId = TestCollection.insert({});
      var userId = Random.id(17);
      test.equal(TestSvc.add(objId, {userId: userId}, ['readAccess']), 1);
      test.equal(TestSvc.change(objId, {userId: userId}, ['writeAccess']), 1);

      var obj = TestCollection.findOne(objId);
      test.equal(TestSvc.get(obj, {userId: userId}), ['writeAccess']);
    });

  Tinytest.add('ObjectACL - change for email',
    function(test) {
      var objId = TestCollection.insert({});
      var email = 'bob@example.com';
      test.equal(TestSvc.add(objId, {email: email}, ['readAccess']), 1);
      test.equal(TestSvc.change(objId, {email: email}, ['writeAccess']), 1);

      var obj = TestCollection.findOne(objId);
      test.equal(TestSvc.get(obj, {email: email}), ['writeAccess']);
    });

  Tinytest.add('ObjectACL - change does not add',
    function(test) {
      var objId = TestCollection.insert({});
      var userId = Random.id(17);
      test.equal(TestSvc.change(objId, {userId: userId}, ['writeAccess']), 0);

      var obj = TestCollection.findOne(objId);
      test.equal(TestSvc.get(obj, {userId: userId}), []);
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

  Tinytest.add('ObjectACL - findIf (userId)', 
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

      // Set a red-herring to weed out matching on permisisons as opposed to
      // email
      var notUserId = Random.id(17);
      test.equal(TestSvc.set(obj1Id, notUserId, [TestSvc.superPermission]), 1);
      test.equal(TestSvc.set(obj2Id, notUserId, [TestSvc.superPermission]), 1);
      test.equal(TestSvc.set(obj3Id, notUserId, [TestSvc.superPermission]), 1);
      test.equal(TestSvc.set(obj4Id, notUserId, [TestSvc.superPermission]), 1);

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

  Tinytest.add('ObjectACL - findIf (userId or email)', 
    function(test) {
      // Reset for test
      TestCollection.remove({}); 

      var obj1Id = TestCollection.insert({name: 'A'});
      var obj2Id = TestCollection.insert({name: 'B'});
      var obj3Id = TestCollection.insert({name: 'C'});
      var obj4Id = TestCollection.insert({name: 'D'});

      var userId = Random.id(17);
      var email = 'e' + Random.id(17) + '@example.com';

      test.equal(TestSvc.set(obj1Id, {email: email}, 
                             [TestSvc.superPermission]), 1);
      test.equal(TestSvc.set(obj2Id, {userId: userId}, 
                             ['writeAccess']), 1);
      test.equal(TestSvc.set(obj3Id, {email: email}, 
                             ['readAccess']), 1);

      // Set a red-herring to weed out matching on permisisons as opposed to
      // email
      var notEmail = 'e' + Random.id(17) + '@example.com';
      test.equal(TestSvc.set(obj1Id, {email: notEmail}, 
                             [TestSvc.superPermission]), 1);
      test.equal(TestSvc.set(obj2Id, {email: notEmail}, 
                             [TestSvc.superPermission]), 1);
      test.equal(TestSvc.set(obj3Id, {email: notEmail}, 
                             [TestSvc.superPermission]), 1);
      test.equal(TestSvc.set(obj4Id, {email: notEmail}, 
                             [TestSvc.superPermission]), 1);

      var identifier = {userId: userId, email: email};

      // Found => super permissions on email
      test.equal(
        TestSvc.findIf(obj1Id, identifier, 'writeAccess').fetch()[0]._id, 
        obj1Id);

      // Found => exact permissions on userId
      test.equal(
        TestSvc.findIf(obj2Id, identifier, 'writeAccess').fetch()[0]._id, 
        obj2Id);

      // Not found => insufficient permissions
      test.isUndefined(
        TestSvc.findIf(obj3Id, identifier, 'writeAccess').fetch()[0]);

      // Not found => no permissions
      test.isUndefined(
        TestSvc.findIf(obj4Id, identifier, 'writeAccess').fetch()[0]);
    });

  Tinytest.add('ObjectACL - findIf (one of multiple e-mails)', 
    function(test) {
      // Reset for test
      TestCollection.remove({}); 

      var obj1Id = TestCollection.insert({name: 'A'});
      var obj2Id = TestCollection.insert({name: 'B'});
      var obj3Id = TestCollection.insert({name: 'C'});

      var email1 = 'e' + Random.id(17) + '@example.com';
      var email2 = 'e' + Random.id(17) + '@example.com';

      test.equal(TestSvc.set(obj1Id, {email: email1}, 
                             [TestSvc.superPermission]), 1);
      test.equal(TestSvc.set(obj1Id, {email: email2}, 
                             ['readAccess']), 1);

      test.equal(TestSvc.set(obj2Id, {email: email1}, 
                             ['readAccess']), 1);
      test.equal(TestSvc.set(obj2Id, {email: email2}, 
                             [TestSvc.superPermission]), 1);

      test.equal(TestSvc.set(obj3Id, {email: email1}, 
                             ['readAccess']), 1);
      test.equal(TestSvc.set(obj3Id, {email: email2}, 
                             ['readAccess']), 1);      

      // Set a red-herring to weed out matching on permisisons as opposed to
      // email
      var notEmail = 'e' + Random.id(17) + '@example.com';
      test.equal(TestSvc.set(obj1Id, {email: notEmail}, 
                             [TestSvc.superPermission]), 1);
      test.equal(TestSvc.set(obj2Id, {email: notEmail}, 
                             [TestSvc.superPermission]), 1);
      test.equal(TestSvc.set(obj3Id, {email: notEmail}, 
                             [TestSvc.superPermission]), 1);

      var identifier = {email: [email1, email2]};

      // Found => first email has permission
      test.equal(
        TestSvc.findIf(obj1Id, identifier, 'writeAccess').fetch()[0]._id, 
        obj1Id);

      // Found => second email has permission
      test.equal(
        TestSvc.findIf(obj2Id, identifier, 'writeAccess').fetch()[0]._id, 
        obj2Id);

      // Not found => neither email has permission
      test.isUndefined(
        TestSvc.findIf(obj3Id, identifier, 'writeAccess').fetch()[0]);
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

  Tinytest.add('ObjectACL - list users with permissions on object',
    function(test) {
      var user1Id = Random.id(17);
      var user2Id = Random.id(17);
      var user3Id = Random.id(17);
      var email1 = Random.id(17) + '@example.com';
      var email2 = Random.id(17) + '@example.com';
      var objId = TestCollection.insert({});

      test.equal(TestSvc.set(objId, {userId: user1Id}, ['readAccess']), 1);
      test.equal(TestSvc.set(objId, {userId: user2Id}, ['writeAccess']), 1);
      test.equal(TestSvc.set(objId, {userId: user3Id}, 
                 [TestSvc.superPermission]), 1);
      test.equal(TestSvc.set(objId, {email: email1}, ['readAccess']), 1);
      test.equal(TestSvc.set(objId, {email: email2}, ['writeAccess']), 1);

      var obj = TestCollection.findOne(objId);
      var permissionObjs = TestSvc.usersWithPermission(obj, 'writeAccess');
      var matches = _.map(permissionObjs, function(permObj) {
        return permObj.userId || permObj.email;
      });

      test.equal(matches.length, 3);
      test.isFalse(_.contains(matches, user1Id)); // Insufficient permission
      test.isTrue(_.contains(matches, user2Id));
      test.isTrue(_.contains(matches, user3Id));
      test.isFalse(_.contains(matches, email1));  // Insufficient permisison
      test.isTrue(_.contains(matches, email2));
    });

  Tinytest.add('ObjectACL - list userIds with permissions on object',
    function(test) {
      var user1Id = Random.id(17);
      var user2Id = Random.id(17);
      var user3Id = Random.id(17);
      var email1 = Random.id(17) + '@example.com';
      var email2 = Random.id(17) + '@example.com';
      var objId = TestCollection.insert({});

      test.equal(TestSvc.set(objId, {userId: user1Id}, ['readAccess']), 1);
      test.equal(TestSvc.set(objId, {userId: user2Id}, ['writeAccess']), 1);
      test.equal(TestSvc.set(objId, {userId: user3Id}, 
                 [TestSvc.superPermission]), 1);
      test.equal(TestSvc.set(objId, {email: email1}, ['readAccess']), 1);
      test.equal(TestSvc.set(objId, {email: email2}, ['writeAccess']), 1);

      var obj = TestCollection.findOne(objId);
      var matches = TestSvc.userIdsWithPermission(obj, 'writeAccess');
      test.equal(matches.length, 2);
      test.isFalse(_.contains(matches, user1Id)); // Insufficient permission
      test.isTrue(_.contains(matches, user2Id));
      test.isTrue(_.contains(matches, user3Id));
      test.isFalse(_.contains(matches, email1));  // Email, not _id
      test.isFalse(_.contains(matches, email2));  // Email, not _id
    });

  Tinytest.add('ObjectACL - list e-mails with permissions on object',
    function(test) {
      var user1Id = Random.id(17);
      var user2Id = Random.id(17);
      var user3Id = Random.id(17);
      var email1 = Random.id(17) + '@example.com';
      var email2 = Random.id(17) + '@example.com';
      var objId = TestCollection.insert({});

      test.equal(TestSvc.set(objId, {userId: user1Id}, ['readAccess']), 1);
      test.equal(TestSvc.set(objId, {userId: user2Id}, ['writeAccess']), 1);
      test.equal(TestSvc.set(objId, {userId: user3Id}, 
                 [TestSvc.superPermission]), 1);
      test.equal(TestSvc.set(objId, {email: email1}, ['readAccess']), 1);
      test.equal(TestSvc.set(objId, {email: email2}, ['writeAccess']), 1);

      var obj = TestCollection.findOne(objId);
      var matches = TestSvc.emailsWithPermission(obj, 'writeAccess');
      test.equal(matches.length, 1);
      test.isFalse(_.contains(matches, user1Id)); // _id, not email
      test.isFalse(_.contains(matches, user2Id)); // _id, not email
      test.isFalse(_.contains(matches, user3Id)); // _id, not email
      test.isFalse(_.contains(matches, email1));  // Insufficient permission
      test.isTrue(_.contains(matches, email2));   // Email, not _id
    });


  var assert403 = function(test, func) {
    try {
      func();
      test.isFalse(true); // No error, just raise
    } catch (err) {
      test.isTrue(err);
      test.equal(err.error, 403);
    }
  };

  Tinytest.add('ObjectACL - checkPermission with object Id',
    function(test) {
      var userId = Random.id(17);
      var objId = TestCollection.insert({});
      test.equal(TestSvc.set(objId, userId, ['writeAccess']), 1);

      // Ok, no error (equal permission)
      TestSvc.checkPermission(objId, userId, 'writeAccess');

      // Ok, no error (lower permission)
      TestSvc.checkPermission(objId, userId, 'readAccess');

      // Error, higher permission
      assert403(test, function() {
        TestSvc.checkPermission(objId, userId, TestSvc.superPermission);
      });
    });

  Tinytest.add('ObjectACL - checkPermission with object',
    function(test) {
      var userId = Random.id(17);
      var objId = TestCollection.insert({});
      test.equal(TestSvc.set(objId, userId, ['writeAccess']), 1);

      var obj = TestCollection.findOne(objId);

      // Ok, no error (equal permission)
      TestSvc.checkPermission(obj, userId, 'writeAccess');

      // Ok, no error (lower permission)
      TestSvc.checkPermission(obj, userId, 'readAccess');

      // Error, higher permission
      assert403(test, function() {
        TestSvc.checkPermission(obj, userId, TestSvc.superPermission);
      });
    });

  Tinytest.add('ObjectACL - getPermissions', function(test) {
    var actual = TestSvc.getPermissions();
    var expected = ['readAccess', 'writeAccess', TestSvc.superPermission];
    test.equal(_.intersection(actual, expected).length, 3);
  });

})();


