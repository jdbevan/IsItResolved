var mongo = require('mongodb'),
	dns = require('./checker'),
	mailer = require('./mailer'),
	
	/* Setup mongo server connection */
	mongoServer = new mongo.Server('localhost', 27017, {auto_reconnect:true}),
	db = mongo.Db('dns', mongoServer),
	looper = function(err, collection) {
		
		console.log("Checking @ " + (new Date()));
		
		var stream = collection.find().streamRecords();
		
		stream.on("data", function(item) {
			var record = item.dns,
				host = item.host;
			// perform DNS lookup with this host + dns record type
			console.log("Checking " + record + " at " + host);
			if (dns.checkRequest(host, record, false)) {
				dns.lookup(host, record, false, function(dnsData) {
					// update collection
					db.collection('hosts', function(err, collection) {
						updateDatabase(collection, dnsData);
					});
				});
			}
		});
		stream.on("end", function() {
			console.log("No more records");
		});
	},
	markAsChanged = function(result, dnsData) {
		// Result contains original record
		if (dnsData.error && !dns.objectsEqual(result.error, dnsData.response ? dnsData.response : dnsData.error)) {
			var email = "<p>Hi,</p>\n<p>At approximately " + (new Date()) + ", we checked the following DNS record and got an error:</p>\n";
			email += "<p><strong>" + dnsData.dns + " record for " + dnsData.host + "</strong></p>\n";
			email += "<p>The error message: <strong>" + dnsData.error + "</strong></p>\n";
			email += "<p>Previously, the record resolved to: " + (result.response ? result.response : result.error) + "</p>\n";
			email += "<p>Thanks,<br>\nJon</p>";
			
			mailer.sendEmail("Jon Bevan <jon@wearesomethingsimple.com>",
							"Jon Bevan <jon@edgeoftheweb.co.uk>",
							"DNS change for " + dnsData.host + " (" + dnsData.dns + ")",
							email);
			return;
		}
		if (!dns.objectsEqual(result.response, dnsData.response)) {
			//changed.push({'host':dnsData.host, 'dns':dnsData.dns, 'response':dnsData.response});
			var email = "<p>Hi,</p>\n<p>At approximately " + (new Date()) + ", the following DNS record change was observed:</p>\n";
			email += "<p><strong>" + dnsData.dns + " record for " + dnsData.host + "</strong></p>\n";
			email += "<p>and now resolves to: <strong>" + JSON.stringify( dnsData.response, null, ' ' ) + "</strong></p>\n";
			email += "<p>Previously, the record resolved to: " + JSON.stringify( result.response, null, ' ' ) + "</p>\n";
			email += "<p>Thanks,<br>\nJon</p>";
			
			mailer.sendEmail("Jon Bevan <jon@wearesomethingsimple.com>",
							"Jon Bevan <jon@edgeoftheweb.co.uk>",
							"DNS change for " + dnsData.host + " (" + dnsData.dns + ")",
							email);
		}
	},
	updateDatabase = function(collection, dnsData) {
		collection.findAndModify( {'host':dnsData.host, 'dns':dnsData.dns, 'response':dnsData.response},
									[['time','desc']],
									{$set:{'time':dnsData.time }},
									{safe:true, upsert: true},
									function(err,result) {
										if (err) {
											console.log(err);
										} else if (result) {
											markAsChanged(result, dnsData);
										}
										console.log("Finished updating " + dnsData.dns + " record for " + dnsData.host);
									}
								);
	};
	
db.open(function(err,db) {
	if (!err) {
		// Setup collection if it doesnt exist
		db.collection('hosts', function(err, collection) {
		
			var t = setTimeout(looper, 30*60, err, collection);

		});
	}
});
