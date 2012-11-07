var mongo = require('mongodb'),
	dns = require('./checker'),
	mailer = require('./mailer'),
	
	/* Setup mongo server connection */
	mongoServer = new mongo.Server('localhost', 27017, {auto_reconnect:true}),
	db = mongo.Db('dns', mongoServer),
	looper = function(err, hosts) {
		
		console.log("Checking @ " + (new Date()));
		
		// Sort by time descending
		var stream = hosts.find().sort({time:-1}).streamRecords();
		
		stream.on("data", function(item) {
			var record = item.dns,
				host = item.host;
			
			// perform DNS lookup with this host + dns record type
			console.log("Checking " + record + " at " + host);
			if (dns.checkRequest(host, record, false)) {
				// If valid request
				dns.lookup(host, record, false, function(dnsData) {
					// update collection
					db.collection('hosts', function(err, hosts) {
						updateDatabase(hosts, dnsData);
					});
				});
			}
		});
		stream.on("end", function() {
			console.log("No more records");
		});
	},
	markAsChanged = function(result, dnsData) {
		var email = false;
		// Result contains original record
		if (dnsData.error && !dns.objectsEqual(result.error, dnsData.response ? dnsData.response : dnsData.error)) {
			email = "<p>Hi,</p>\n<p>At approximately " + (new Date()) + ", we checked the following DNS record and got an error:</p>\n";
			email += "<p><strong>" + dnsData.dns + " record for " + dnsData.host + "</strong></p>\n";
			email += "<p>The error message: <strong>" + dnsData.error + "</strong></p>\n";
			email += "<p>Previously, the record resolved to: " + (result.response ? result.response : result.error) + "</p>\n";
			email += "<p>Thanks,<br>\nJon</p>";
		}
		if (!dns.objectsEqual(result.response, dnsData.response)) {
			//changed.push({'host':dnsData.host, 'dns':dnsData.dns, 'response':dnsData.response});
			email = "<p>Hi,</p>\n<p>At approximately " + (new Date()) + ", the following DNS record change was observed:</p>\n";
			email += "<p><strong>" + dnsData.dns + " record for " + dnsData.host + "</strong></p>\n";
			email += "<p>and now resolves to: <strong>" + JSON.stringify( dnsData.response, null, ' ' ) + "</strong></p>\n";
			email += "<p>Previously, the record resolved to: " + JSON.stringify( result.response, null, ' ' ) + "</p>\n";
			email += "<p>Thanks,<br>\nJon</p>";
		}
		
		if (email !== false) {
			// Open collection - create on insert if nonexistent
			db.collection('alerts', function(err,alerts) {
				// stream search results
				var stream = alerts.find({'host': dnsData.host, 'dns':dnsData.dns}).streamRecords(),
					bcc_list = [],
					bcc_counter = 0;
				
				stream.on("data", function(item) {
					bcc_list.push(item.email);
					bcc_counter++;
					if (bcc_counter == 100) {
						mailer.sendEmail("Jon Bevan <jon@jonbevan.me.uk>",
										"Jon Bevan <jon@edgeoftheweb.co.uk>",
										bcc_list.join(),
										"DNS change for " + dnsData.host + " (" + dnsData.dns + ")",
										email);
						bcc_list = [];
						bcc_counter = 0;
					}
				});
				
				stream.on("end", function(){
					if (bcc_counter > 0) {
						mailer.sendEmail("Jon Bevan <jon@jonbevan.me.uk>",
										"Jon Bevan <jon@edgeoftheweb.co.uk>",
										bcc_list.join(),
										"DNS change for " + dnsData.host + " (" + dnsData.dns + ")",
										email);
						bcc_list = [];
						bcc_counter = 0;
					}
					console.log("No more records");
				});
			});
		}
	},
	updateDatabase = function(hosts, dnsData) {
		// Find the original record and update the time, or INSERT a new record
		// 'Primary key' is: host + dns record type + response
		hosts.findAndModify( {'host':dnsData.host, 'dns':dnsData.dns, 'response':dnsData.response},
									[['time','desc']],
									{$set:{'time':dnsData.time }},
									{safe:true, upsert: true},
									function(err,result) {
										if (err) {
											console.log(err);
										} else if (result) {
											// result is the original record
											// dnsData is the lastest DNS response
											markAsChanged(result, dnsData);
										}
										console.log("Finished updating " + dnsData.dns + " record for " + dnsData.host);
									}
								);
	};
	
db.open(function(err,db) {
	if (!err) {
		// Open collection - create on insert if nonexistent
		db.collection('hosts', function(err, hosts) {
		
			looper(err, hosts);
			var t = setInterval(looper, 5*60*1000, err, hosts);

		});
	}
});
