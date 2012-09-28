var mongo = require('mongodb'),
	dns = require('./checker'),
	mailer = require('./mailer'),
	
	/* Setup mongo server connection */
	mongoServer = new mongo.Server('localhost', 27017, {auto_reconnect:true}),
	db = mongo.Db('dns', mongoServer),
	loop = function() {
		
	};
	
db.open(function(err,db) {
	if (!err) {
		// Setup collection if it doesnt exist
		db.collection('hosts', function(err, collection) {
			
			var stream = collection.find().streamRecords(),
				changed = [];
			
			stream.on("data", function(item) {
				var record = item.dns,
					host = item.host;
				// perform DNS lookup with this host + dns record type
				console.log("Checking " + record + " at " + host);
				if (dns.checkRequest(host, record, false)) {
					dns.lookup(host, record, false, function(dnsData) {
						if (dnsData) {
							// update collection
							db.collection('hosts', function(err, collection) {
								collection.findAndModify( {'host':dnsData.host, 'dns':dnsData.dns, 'response':dnsData.response},
															[['time','desc']],
															{$set:{'time':dnsData.time }},
															{safe:true, upsert: true},
															function(err,result) {
																if (err!=null) {
																	console.log(err);
																} else if (result!=null) {
																	console.log(result);
																}
															}
														);
							});
						}
					});
				}
				
				// if response was different, send email
				
			});
			stream.on("end", function() {
				// no more records
				if (changed.length>0) {
					mailer.sendEmail("Jon Bevan <jon@wearesomethingsimple.com>",
									"Jon Bevan <jon@edgeoftheweb.co.uk>",
									"Node.js Test 2",
									email);
				}
			});

		});
	}
});
