###DNS Resolver in Node.js###

Eventually will report global DNS changes from Amazon's EC2 (possibly) via email to subscribers.

Needs to spawn a [child process](http://nodejs.org/api/child_process.html) of worker.js, that checks for DNS changes regularly and [emails](https://npmjs.org/package/nodemailer) changes to subscribers.

Needs a method by which (database) servers can communicate with each other to update records and subscribers.

Uses [MongoDB](https://github.com/mongodb/node-mongodb-native) to store records and subscribers.
