# object-acl
Functions for adding access control lists to an existing document within a 
collection. Sort of the inverse of alanning:roles.

Installation
------------
`meteor install fongandrew:object-acl`

Permissions Model
-----------------
Object-ACL treats permissions heirarchically. When configuring the ACL,
permissions are assigned integer values -- e.g. readAccess is 10 and writeAccess
is 20. A permission with a higher value implies access to the lower one as well.

In addition, Object-ACL creates a 'super' permission that implies all other 
permissions. The super permission is special in that, once it is assigned,
there must always be at least one user with super permissions assigned -- e.g.
it can be used to reflect an "owner" for a document and to prevent documents
from being orphaned when all users are removed. If this behavior is undesirable,
you can simply opt not to use the 'super' permission and just assign your own
permissions accordingly.

Permissions can be assigned either to user _ids or to e-mail addresses (e.g.
invites for people who haven't created a user account yet). Permissions assigned
to an e-mail address can be claimed by a given userId (see the 
`PermissionSvc.claim` example below). Note that the requirement that there be
at least one user with a super permission only counts permissions assigned to
user _ids, not to e-mail addresses.

Collection Modification
-----------------------
ObjectACLSvc will modify documents within a collection to include the following
fields:

* permissions - An array of objects containing user _ids and their permissions.
* superIds - An array containing a list of users with the special super
  permission.

The name of these fields and other settings can be changed via options passed 
to the ObjectACLSvc constructor (see [object_acl.js](object_acl.js)).

Usage
-----
Create a new permission service that's attached to an existing Mongo collection
by using the `ObjectACLSvc` constructor. 

```javascript
PermissionSvc = new ObjectACLSvc(MyCollection, {
  readAccess: 10,
  writeAccess: 20
});
```

This will return an ObjectACLSvc object with functions that modify a given 
object in a collection, e.g.:

`PermissionSvc.add(objectId, {userId: userId}, ['readAccess'])` - This grants
a user with a given _id read access to the object with the given _id, but
only if that user does not have access to the object yet.

`PermissionSvc.add(objectId, {email: email}, ['readAccess'])` - This does the
same thing as the above, but grants the permission to an email address instead
of a user's _id. The substitution of `{userId: userId}` with `{email: email}`
applies to any of the calls below wherever such an object is used to identify
a user rather than the plain `userId` or `email`.

`PermissionSvc.change(objectId, {userId: userId}, ['readAccess'])` - This 
replaces permissions for a given user and object, but only if that user already
has access to that object.

`PermissionSvc.set(objectId, {userId: userId}, ['readAccess'])` - This replaces
a user's permissions on a given object, regardless of whether that user
previously had permission or not.

`PermissionSvc.unset(objectId, {userId: userId})` - This removes a user's
permissions for a given object.

`PermissionSvc.get(object, {userId: userId})` - This returns a list of 
permissions for a user for the given object document.

`PermissionSvc.findForUserId(userId, 'writeAccess', {limit: 10})` - This 
returns a Mongo cursor for all documents in a collection where the user has
at least 'writeAccess'. The last argument is an options object that takes
the standard Meteor / Mongo options for a `find` call.

`PermissionSvc.findForEmail(email, 'writeAccess', {limit: 10})` - Same as
above, but for an e-mail address.

`PermissionSvc.findId(objectId, {userId: userId}, 'writeAccess')` - This 
returns a Mongo cursor for a single document in the collection, but only if
a given user has at least writeAccess. We return a cursor rather than the
object itself because the cursor can be useful for construction composite
queries in publications based on current permissions (e.g. using 
[reywood:publish-composite](https://github.com/englue/meteor-publish-composite)
).

`PermissionSvc.usersWithPermission(object, 'writeAccess')` - Returns an array
of objects containing permisison info for all users with at least writeAccess.

`PermissionSvc.userIdsWithPermission(object, 'writeAccess')` - Same as above,
but returns only user _ids.

`PermissionSvc.emailsWithPermission(object, 'writeAccess')` - Same as above,
but returns only e-mail addresses. Note that this returns only e-mail addresses
with no assigned userId.

`PermissionSvc.checkPermission(object, userId, 'writeAccess')` - Throws an
exception if the given user doesn't have at least write access.

`PermissionSvc.claim(objectId, email, userId)` - Replaces a permission assigned
to an e-mail address with an equivalent permission assigned to a user _id.
Once claimed, the e-mail address is no longer associated with the object.

`PermissionSvc.getPermissions()` - Returns all possible permissions. In this
case, that includes 'radAccess', 'writeAccess', and the super permission.

