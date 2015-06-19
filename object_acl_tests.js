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

  Tinytest.add('ObjectACL - set new',
    function(test) {
      var objId = TestCollection.insert({});
      var userId = Random.id(17);
      test.equal(TestSvc.set(objId, userId, ['readAccess']), 1);

      var obj = TestCollection.findOne(objId);
      test.equal(TestSvc.get(obj, userId), ['readAccess']);
    });

  Tinytest.add('ObjectACL - set update',
    function(test) {
      var objId = TestCollection.insert({});
      var userId = Random.id(17);
      test.equal(TestSvc.set(objId, userId, ['readAccess']), 1);
      test.equal(TestSvc.set(objId, userId, ['writeAccess']), 1);

      var obj = TestCollection.findOne(objId);
      test.equal(TestSvc.get(obj, userId), ['writeAccess']);
    });

  Tinytest.add('ObjectACL - unset',
    function(test) {
      var objId = TestCollection.insert({});
      var userId = Random.id(17);
      test.equal(TestSvc.set(objId, userId, ['readAccess']), 1);
      test.equal(TestSvc.unset(objId, userId), 1);

      var obj = TestCollection.findOne(objId);
      test.equal(TestSvc.get(obj, userId), []);
    });

  Tinytest.add('ObjectACL - cannot remove only admin via set',
    function(test) {
      var objId = TestCollection.insert({});
      var userId = Random.id(17);
      test.equal(TestSvc.set(objId, userId, [TestSvc.superPermission]), 1);
      test.equal(TestSvc.set(objId, userId, ['readAccess']), 0);

      var obj = TestCollection.findOne(objId);
      test.equal(TestSvc.get(obj, userId), [TestSvc.superPermission]);
    });

  Tinytest.add('ObjectACL - cannot remove only admin via unset',
    function(test) {
      var objId = TestCollection.insert({});
      var userId = Random.id(17);
      test.equal(TestSvc.set(objId, userId, [TestSvc.superPermission]), 1);
      test.equal(TestSvc.unset(objId, userId), 0);

      var obj = TestCollection.findOne(objId);
      test.equal(TestSvc.get(obj, userId), [TestSvc.superPermission]);
    });

  Tinytest.add('ObjectACL - can remove admin via set if another is added',
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

  Tinytest.add('ObjectACL - can remove admin via unset if another is added',
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
})();


