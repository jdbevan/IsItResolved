var mongo = require('mongodb'),
	dns = require('./checker'),
	mailer = require('./mailer'),
	
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
			
			var stream = collection.find().streamRecords(),
				changed = [];
			stream.on("data", function(item) {
				// perform DNS lookup with this host + dns record type
				if (dns.checkRequest(host, record, false)) {
					dns.lookup(host, record, false, function(dnsData) {
						if (dnsData) {
							// update collection
							db.collection('hosts', function(err, collection) {
								collection.update( {'host':dnsData.host, 'dns':dnsData.dns, 'response':dnsData.response}, {$set:{'time':dnsData.time }},
													{safe:true, upsert: true},
													function(err,result) {
														//console.log(err);
													});
							});
						}
					});
				}
				
				// if response was different, send email
				
			});
			stream.on("end", function() {
				// no more records
				mailer.sendEmail("Jon Bevan <jon@wearesomethingsimple.com>",
								"Jon Bevan <jon@edgeoftheweb.co.uk>",
								"Node.js Test 2",
								email);
			});

		});
	}
});
