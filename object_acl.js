/* global ObjectACLSvc: true */

/** @constructor
 *  
 *  @param {Object} collection - The Mongo.Collection to attach the ACL to
 *  @param {Object} [permissions] - A mapping of permission types to interger
 *    values. Each permission with a higher value than another automatically
 *    implies the lower -- e.g. if the permissions are {read: 10, write: 20},
 *    then anyone with write permission automatically has read permisison.
 *  @param {String} [options.superPermission=_super] - Name of the permission
 *    that has access to everything else.
 *  @param {String} [options.permissionListVar=permissions] - Name of field on 
 *    the collection on which to use for our ACL
 *  @param {String} [options.superListVar=superIds] - Name of field on the
 *    collection which gets populated with a list of userIds with the super
 *    permission. This is used to ensure that we can never unset the number
 *    users with super permissions below zero.
 *  @param {[String]} [options.defaultPermissions=super] - List of permissions 
 *    to assign to users by default if no others are given. Default to the 
 *    super permission
 */
ObjectACLSvc = function(collection, permissions, options) {
  'use strict';
  if (! collection) {
    throw new Meteor.Error(500, "missing-collection");
  }

  options = options || {};
  check(options, {
    superPermission: Match.Optional(String),
    permissionListVar: Match.Optional(String),
    superListVar: Match.Optional(String),
    defaultPermissions: Match.Optional([String])
  });

  this.superPermission = options.superPermission || '_super';
  this._permissionListVar = options.permissionListVar || 'permissions';
  this._superListVar = options.superListVar || 'superIds';
  this._defaultPermissions = (options.defaultPermissions || 
                              [this.superPermission]);
  this._collection = collection;
  this._permissions = permissions || {};
  this._permissions[this.superPermission] = Infinity;

  if (Meteor.isServer) {
    var self = this;
    Meteor.startup(function() {
      // Index by userId
      collection._ensureIndex([
        [self._permissionListVar + ".userId", 1],
        [self._permissionListVar + ".permissions", 1]
      ]);

      // Index by email (for invites)
      collection._ensureIndex([
        [self._permissionListVar + ".email", 1],
        [self._permissionListVar + ".permissions", 1]
      ]);
    });
  }
};

(function() {
  'use strict';

  var proto = ObjectACLSvc.prototype;

  /** Sets permission for a given user on an object, but only if user does not
   *    already exist.
   *  @param {String} objectId - _id of the object we're controlling access to
   *  @param {Object|String} identifier - An object with a userId or email
   *    property for the user in question. Or pass a String, which will be
   *    treated as a userId
   *  @param {[String]} [permissions=defaultPermissions] - List of permissions
   *    to set for user
   *  @returns {Number} - Number of objects updated. 1 if update was 
   *    successful, 0 otherwise
   */
  proto.add = function(objectId, identifier, permissions) {
    check(objectId, String);
    permissions = permissions || this._defaultPermissions;
    identifier = this._identifier(identifier);
    var permissionObj = this._permissionObj(identifier, permissions);
    return this._add(objectId, identifier, permissionObj);
  };

  // Helper function for add that does most of the work outside of validation
  proto._add = function(objectId, identifier, permissionObj) {
    // Super, add user ID to special list
    var superUpdate = {};
    if (identifier.userId && _.contains(permissionObj.permissions, 
                                        this.superPermission)) {
      superUpdate = {$addToSet: {}};
      superUpdate.$addToSet[this._superListVar] = identifier.userId;
    }

    var selector = { _id: objectId };

    // Don't insert twice
    if (identifier.userId) {
      selector[this._permissionListVar + ".userId"] = {
        $ne: identifier.userId
      };
    } else {
      selector[this._permissionListVar + ".email"] = {
        $ne: identifier.email
      };
    }

    var update = _.extend({$push: {}}, superUpdate);
    update.$push[this._permissionListVar] = permissionObj;
    return this._collection.update(selector, update);
  };

  /** Sets permission for a given user on an object, but only if user already
   *    exists.
   *  @param {String} objectId - _id of the object we're controlling access to
   *  @param {Object|String} identifier - An object with a userId or email
   *    property for the user in question. Or pass a String, which will be
   *    treated as a userId
   *  @param {[String]} [permissions=defaultPermissions] - List of permissions
   *    to set for user
   *  @returns {Number} - Number of objects updated. 1 if update was 
   *    successful, 0 otherwise
   */
  proto.change = function(objectId, identifier, permissions) {
    check(objectId, String);
    permissions = permissions || this._defaultPermissions;
    identifier = this._identifier(identifier);
    var permissionObj = this._permissionObj(identifier, permissions);
    return this._change(objectId, identifier, permissionObj);
  };

  // Helper function for update that does most of the work outside of validation
  proto._change = function(objectId, identifier, permissionObj) {
    // Super, add user ID to special list
    var superUpdate;
    if (identifier.userId && _.contains(permissionObj.permissions, 
                                        this.superPermission)) {
      superUpdate = {$addToSet: {}};
      superUpdate.$addToSet[this._superListVar] = identifier.userId;
    }

    // Not super, ensure not in super list
    else {
      superUpdate = {$pull: {}};
      superUpdate.$pull[this._superListVar] = identifier.userId;
    }

    var selector = { _id: objectId };
    if (identifier.userId) {
      selector[this._permissionListVar + ".userId"] = identifier.userId;
    } else {
      selector[this._permissionListVar + ".email"] = identifier.email;
    }

    // Make sure not just one admin left
    if (superUpdate.$pull) {
      selector[this._superListVar] = {$ne: [identifier.userId]};
    }

    var update = _.extend({$set: {}}, superUpdate);
    update.$set[this._permissionListVar + ".$"] = permissionObj;
    return this._collection.update(selector, update);
  };

  /** Upserts permissions for a given user on an object 
   *  @param {String} objectId - _id of the object we're controlling access to
   *  @param {Object|String} identifier - An object with a userId or email
   *    property for the user in question. Or pass a String, which will be
   *    treated as a userId
   *  @param {[String]} [permissions=defaultPermissions] - List of permissions
   *    to set for user
   *  @returns {Number} - Number of objects updated. 1 if update was 
   *    successful, 0 otherwise
   */
  proto.set = function(objectId, identifier, permissions) {
    check(objectId, String);
    permissions = permissions || this._defaultPermissions;
    identifier = this._identifier(identifier);
    var permissionObj = this._permissionObj(identifier, permissions);

    // Try update first
    var ret = this._change(objectId, identifier, permissionObj);
    if (! ret) {
      // Else insert
      ret = this._add(objectId, identifier, permissionObj);
    }
    return ret;
  };

  // Validates and returns identifier from string or object
  proto._identifier = function(identifier) {
    if (_.isString(identifier)) {
      identifier = {userId: identifier};
    } else {
      check(identifier, Match.OneOf({
        userId: String
      }, {
        email: String
      }));
    }
    return identifier;
  };

  // Returns an object representing permissions for a given user or email
  // address. This gets inserted into an array on the actual object we're 
  // controlling access for.
  proto._permissionObj = function(identifier, permissions) {
    var self = this;
    // NB: Identifier should already have been validated by this._identifier
    check(permissions, Match.Optional([
      Match.Where(function(permission) {
        check(permission, String);
        return self._permissions.hasOwnProperty(permission);
      })
    ]));

    return _.extend({}, identifier, {
      permissions: permissions
    });
  };

  // Returns a base object with "default" permissions for a new user --
  // can be used for inserting
  proto.baseObj = function(userId, permissions) {
    var ret = {};
    ret[this._permissionListVar] = [
      this._permissionObj({userId: userId}, permissions)
    ];
    if (_.contains(permissions, this.superPermission)) {
      ret[this._superListVar] = [userId];
    }
    return ret;
  };

  /** Removes all permissions for a given user on an object
   *  @param {String} objectId - _id of the object we're controlling access to
   *  @param {Object|String} identifier - Either an identifier object with 
   *    userId or email properties, or a String equal to the userId
   *  @returns {Number} - Number of objects updated. 1 if update was 
   *    successful, 0 otherwise
   */
  proto.unset = function(objectId, identifier) {
    check(objectId, String);
    identifier = this._identifier(identifier);

    var selector = {_id: objectId};
    var update = {$pull: {}};
    update.$pull[this._permissionListVar] = identifier;

    if (identifier.userId) {
      // Pull admin, but not if last
      selector[this._superListVar] = {$ne: [identifier.userId]}; 
      update.$pull[this._superListVar] = identifier.userId;
    }

    return this._collection.update(selector, update);
  };

  /** Given an object, returns permissions for a given user
   *  @param {Object} object - Actual object document
   *  @param {Object|String} identifier - An object with a userId or email
   *    property corresponding to the user. If String, treated as userId
   *  @returns {[String]} - List of permissions
   */
  proto.get = function(obj, identifier) {
    check(obj, Object);
    identifier = this._identifier(identifier);

    var userPermissions = _.findWhere(obj[this._permissionListVar] || [], 
                                      identifier);
    return (userPermissions && userPermissions.permissions) || [];
  };

  // Returns a list of permissions which imply a given permission (including)
  // the original permission
  proto._implies = function(permission) {
    var level = this._permissions[permission];
    check(level, Number);

    var permissionList = [permission];
    _.each(this._permissions, function(permLevel, permName) {
      if (permLevel > level) {
        permissionList.push(permName);
      }
    });

    // De-dup
    permissionList = _.uniq(permissionList);

    return permissionList;
  };

  // Helper for findForXSelector methods below
  proto._findForSelector = function(identifier, permission) {
    // Get all permissions that imply this permission
    var permissionList = this._implies(permission);

    var selector = {};
    selector[this._permissionListVar] = {
      $elemMatch: _.extend(identifier, {
        permissions: {$in: permissionList}
      })
    };
    return selector;
  };

  /** Returns a selector for querying all objects where user has a certain 
   *    permission (and all implied permissions as well)
   *  @param {String} userId - _id of user
   *  @param {String} permission - Permission user must have
   *  @returns {Object} - Query selector
   */
  proto.findForUserIdSelector = function(userId, permission) {
    return this._findForSelector({userId: userId}, permission);
  };

  /** Returns a selector for querying all objects where email address has 
   *    a certain permission (and all implied permissions as well)
   *  @param {String} email - email of user
   *  @param {String} permission - Permission user must have
   *  @returns {Object} - Query selector
   */
  proto.findForEmailSelector = function(email, permission) {
    // Get all permissions that imply this permission
    return this._findForSelector({email: email}, permission);
  };

  /** Queries all objects where user has certain permissions (and all implied
   *    permissions as well)
   *  @param {String} userId - _id of user
   *  @param {String} permission - Permission user must have
   *  @param {Object} [opts] - Options to pass to query
   *  @returns {Mongo.Cursor}
   */
  proto.findForUserId = function(userId, permission, opts) {
    var selector = this.findForUserIdSelector(userId, permission);
    return this._collection.find(selector, opts || {});
  };

  /** Find and return an object with a given _id if and only if user has 
   *  certain permissions
   *  @param {String} objId - _id of object
   *  @param {Object|String} identifier - Either an identifier object with 
   *    userId or email properties (or both), or a String equal to the userId.
   *    If both userId and email are available, returns if either match.
   *    If multiple emails provided via array, then returns if any e-mail
   *    matches.
   *  @param {String} permission - Permission user must have
   *  @param {Object} [opts] - Options to pass to query
   *  @returns {Mongo.Cursor}
   */
  proto.findIf = function(objId, identifier, permission, opts) {
    check(objId, String);
    check(permission, String);

    // Identifier works a little differently here -- so don't use standard
    // _identifier helper
    if (_.isString(identifier)) {
      identifier = {userId: identifier};
    } else {
      check(identifier, Match.OneOf({
        userId: String
      }, {
        email: Match.OneOf(String, [String])
      }, {
        userId: String,
        email: Match.OneOf(String, [String])
      }));
    }

    if (_.isArray(identifier.email)) {
      identifier = _.extend({}, identifier); // Make shallow copy so mod below
                                             // doesn't override if identifier
                                             // object is used elsewhere
      identifier.email = {$in: identifier.email};
    }

    var selector = this._findForSelector({}, permission);
    selector._id = objId;

    var elemMatch = selector[this._permissionListVar].$elemMatch;
    if (identifier.email && identifier.userId) {
      elemMatch.$or = [
        {userId: identifier.userId},
        {email: identifier.email}
      ];
    } else if (identifier.email) {
      elemMatch.email = identifier.email;
    } else if (identifier.userId) {
      elemMatch.userId = identifier.userId;
    }

    return this._collection.find(selector, opts || {});
  };

  /** Queries all objects where email has certain permissions (and all implied
   *    permissions as well)
   *  @param {String} email - Email address of user
   *  @param {String} permission - Permission user must have
   *  @param {Object} [opts] - Options to pass to query
   *  @returns {Mongo.Cursor}
   */
  proto.findForEmail = function(email, permission, opts) {
    var selector = this.findForEmailSelector(email, permission);
    return this._collection.find(selector, opts || {});
  };

  /** Operation for a given user to claim an object with an invite to a given
   *    email address
   *  @param {String} objId - _id of object claimed
   *  @param {String} email - Email address of user
   *  @param {String} userId - _id for user
   *  @returns {Number} - Number of objects updated. Should be 1 if success, 
   *    0 if not
   */
  proto.claim = function(objId, email, userId) {
    var selector = {_id: objId};
    var elemMatch = {};
    selector[this._permissionListVar] = {$elemMatch: elemMatch};
    elemMatch.email = email;

    // Needed to ensure no duplication of permissions for the same userId
    selector[this._permissionListVar + ".userId"] = {$ne: userId};

    var update = {$set: {}, $unset: {}};
    update.$set[this._permissionListVar + ".$.userId"] = userId;
    update.$unset[this._permissionListVar + ".$.email"] = email;

    // First try assuming user doesn't have super permissions
    elemMatch.permissions = {$ne: this.superPermission};
    var ret = this._collection.update(selector, update);

    // If no ret, then we might be dealing with super permissions
    if (! ret) {
      elemMatch.permissions = this.superPermission;
      update.$addToSet = {};
      update.$addToSet[this._superListVar] = userId;
      ret = this._collection.update(selector, update);
    }

    return ret;
  };

  /** Returns all user-permission objects within a stored object with a given 
   *    set of permissions
   *  @param {String} object - The object itself
   *  @param {String} permission - Min permission for user
   *  @returns {Array} List of permission objects
   */
  proto.usersWithPermission = function(obj, permission) {
    check(obj, Object);
    var permissions = this._implies(permission);

    return _.filter(obj[this._permissionListVar], function(permObj) {
      var intersect = _.intersection(permObj.permissions, permissions);
      if (intersect && intersect.length) {
        return true;
      }
    });
  };

  /** Returns all userIds within a stored object with a given set of 
   *    permissions
   *  @param {String} object - The object itself
   *  @param {String} permission - Min permission for user
   *  @returns {Array} List of permission objects
   */
  proto.userIdsWithPermission = function(obj, permission) {
    check(obj, Object);
    var permissions = this._implies(permission);

    var ret = [];
    _.each(obj[this._permissionListVar], function(permObj) {
      var intersect = _.intersection(permObj.permissions, permissions);
      if (intersect && intersect.length && permObj.userId) {
        ret.push(permObj.userId);
      }
    });
    return ret;
  };

  /** Returns all emails within a stored object with a given set of 
   *    permissions
   *  @param {String} object - The object itself
   *  @param {String} permission - Min permission for user
   *  @returns {Array} List of permission objects
   */
  proto.emailsWithPermission = function(obj, permission) {
    check(obj, Object);
    var permissions = this._implies(permission);

    var ret = [];
    _.each(obj[this._permissionListVar], function(permObj) {
      var intersect = _.intersection(permObj.permissions, permissions);
      if (intersect && intersect.length && permObj.email) {
        ret.push(permObj.email);
      }
    });
    return ret;
  };

  /** Throws an exception if a userId has insufficient permissions
   *  @param {String|Object} objIdOrObj - Either the object _id or the object
   *    itself
   *  @param {String} userId - _id of user we're checking
   *  @param {String} permisison - Permission required for user
   */
  proto.checkPermission = function(objIdOrObj, userId, permission) {
    if (_.isString(objIdOrObj)) { // Object Id, query DB
      var cursor = this.findIf(objIdOrObj, userId, permission);
      if (! cursor.fetch()[0]) {
        throw new Meteor.Error(403, 'permission-denied');
      }
    }

    else {  // Object, check within
      var actual = this.get(objIdOrObj, userId);
      var expected = this._implies(permission);
      var intersect = _.intersection(actual, expected);
      if (! (intersect && intersect.length)) {
        throw new Meteor.Error(403, 'permission-denied');
      }
    }
  };

  // Lists all the permissions available
  proto.getPermissions = function() {
    return _.keys(this._permissions);
  };

})();