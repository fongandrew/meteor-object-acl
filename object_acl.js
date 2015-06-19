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
                              [options.superPermission]);
  this._collection = collection;
  this._permissions = permissions || {};
  this._permissions[this.superPermission] = Infinity;

  if (Meteor.isServer) {
    var self = this;
    Meteor.startup(function() {
      collection._ensureIndex([
        [self._permissionListVar + ".userId", 1],
        [self._permissionListVar + ".permissions", 1]
      ]);
    });
  }
};

(function() {
  'use strict';

  /** Sets permissions for a given user on an object
   *  @param {String} objectId - _id of the object we're controlling access to
   *  @param {String} userId - _id of user
   *  @param {[String]} [permissions=defaultPermissions] - List of permissions
   *    to set for user
   *  @returns {Number} - Number of objects updated. 1 if update was 
   *    successful, 0 otherwise
   */
  ObjectACLSvc.prototype.set = function(objectId, userId, permissions) {
    var self = this;
    check(objectId, String);
    check(userId, String);
    check(permissions, Match.Optional([
      Match.Where(function(permission) {
        check(permission, String);
        return self._permissions.hasOwnProperty(permission);
      })
    ]));
    permissions = permissions || this._defaultPermissions;
    
    var ret, selector, superUpdate, update;
    var permissionObj = {
      userId: userId,
      permissions: permissions
    };

    // Super, add user ID to special list
    if (_.contains(permissions, this.superPermission)) {
      superUpdate = {$addToSet: {}};
      superUpdate.$addToSet[this._superListVar] = userId;
    }

    // Not super, ensure not in super list
    else {
      superUpdate = {$pull: {}};
      superUpdate.$pull[this._superListVar] = userId;
    }

    // Try update first
    selector = { _id: objectId };
    selector[this._permissionListVar + ".userId"] = userId;

    // Make sure not just one admin left
    if (superUpdate.$pull) {
      selector[this._superListVar] = {$ne: [userId]};
    }

    update = _.extend({$set: {}}, superUpdate);
    update.$set[this._permissionListVar + ".$"] = permissionObj;
    ret = this._collection.update(selector, update);

    // ret === 0 implies update failed, so insert instead
    if (! ret) {  
      selector = { _id: objectId };
      // If inserting, check doesn't already exist (e.g. b/c of a race 
      // between prior update and this one)
      selector[this._permissionListVar + ".userId"] = {$ne: userId};
      update = _.extend({$push: {}}, superUpdate);
      update.$push[this._permissionListVar] = permissionObj;
      ret = this._collection.update(selector, update);
    }
    return ret;
  };

  /** Removes all permissions for a given user on an object
   *  @param {String} objectId - _id of the object we're controlling access to
   *  @param {String} userId - _id of user
   *  @returns {Number} - Number of objects updated. 1 if update was 
   *    successful, 0 otherwise
   */
  ObjectACLSvc.prototype.unset = function(objectId, userId) {
    check(objectId, String);
    check(userId, String);

    var selector = {_id: objectId};
    selector[this._superListVar] = {$ne: [userId]}; // Verify not last admin

    var update = {$pull: {}};
    update.$pull[this._permissionListVar] = {userId: userId};
    update.$pull[this._superListVar] = userId;

    return this._collection.update(selector, update);
  };

  /** Given an object, returns permissions for a given user
   *  @param {Object} object - Actual object document
   *  @param {String} userId - _id of user
   *  @returns {[String]} - List of permissions
   */
  ObjectACLSvc.prototype.get = function(obj, userId) {
    check(obj, Object);
    check(userId, String);

    var userPermissions = _.find(obj[this._permissionListVar] || [], 
      function(permissionObj) {
        return permissionObj.userId === userId;
      });

    return (userPermissions && userPermissions.permissions) || [];
  };

  /** Returns a selector for querying all objects where user has a certain 
   *    permission (and all implied permissions as well)
   *  @param {String} userId - _id of user
   *  @param {String} permission - Permission user must have
   *  @returns {Object} - Query selector
   */
  ObjectACLSvc.prototype.findForUserIdSelector = function(userId, permission) {
    // Get all permissions that imply this permission
    var permissionList = [permission];
    var level = this._permissions[permission];
    _.each(this._permissions, function(permLevel, permName) {
      if (permLevel > level) {
        permissionList.push(permName);
      }
    });

    // De-dup
    permissionList = _.uniq(permissionList);

    var selector = {};
    selector[this._permissionListVar] = {
      $elemMatch: {
        userId: userId,
        permissions: {$in: permissionList}
      }
    };
    return selector;
  };

  /** Queries all objects where user has certain permissions (and all implied
   *    permissions as well)
   *  @param {String} userId - _id of user
   *  @param {String} permission - Permission user must have
   *  @param {Object} [opts] - Options to pass to cursor
   *  @returns {Mongo.Cursor}
   */
  ObjectACLSvc.prototype.findForUserId = function(userId, permission, opts) {
    var selector = this.findForUserIdSelector(userId, permission);
    return this._collection.find(selector, opts || {});
  };

})();