var dns = require('dns'),
	mongo = require('mongodb'),
	mailer = require('nodemailer'),
	smtp = mailer.createTransport("SMTP",{
		service: "Edge of the Web"
	}),
	
	/* Setup mongo server connection */
	mongoServer = new mongo.Server('localhost', 27017, {auto_reconnect:true}),
	db = mongo.Db('dns', mongoServer);
	
db.open(function(err,db) {
	if (!err) {
		// Setup collection if it doesnt exist
		db.collection('hosts', function(err, collection) {
			
			// Be careful with the function toArray as it might cause a lot of memory usage
			// as it will instantiate all the document into memory before returning the final
			// array of items. If you have a big resultset you could run into memory issues.
			// collection.find().toArray(function(err, items){});
			
			var stream = collection.find().streamRecords();
			stream.on("data", function(item) {
				// perform DNS lookup with this host + dns record type
				
				// update collection
				
				// if response was different, send email
				
			});
			stream.on("end", function() {
				// no more records
			});

		});
	}
});