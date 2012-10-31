var http = require('http'),
	dns = require('./checker'),
	mongo = require('mongodb'),
	
	/* Setup mongo server connection */
	mongoServer = new mongo.Server('localhost', 27017, {auto_reconnect:true}),
	db = mongo.Db('dns', mongoServer),
	
	/* Setup web server */
	server = http.createServer(function (request, response) {
			
		// TODO: implement rate limiting of some sort?
		// TODO: return different HTTP Response codes dependent on request content/success?
		// TODO: allow specification of email alert on DNS change
		//			e.g. /example.com/NS/john@mail.com/once
		//			e.g. /example.com/NS/john@mail.com/always
		
		response.writeHead(200, {'Content-Type': 'text/plain'});
		
		var args = request.url.split('/'),
			host = args[1],
			record = args[2],
			email = args[3],
			frequency = args[4];

		// Check request matches expected format
		if (!request.url.match(/^\/[a-zA-Z0-9-.]+\/[A-Za-z:]+(\/[a-zA-Z0-9_+.=%-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]+\/(once|forever))?$/)) {
			response.write("Requests should be in the format: /<domain name or ip address>/<dns record type> optionally followed by /<email address>/<alert frequency>\n");
			response.write("\nWe currently support: A, AAAA, MX, TXT, SRV, NS and CNAME lookups for domain names and PTR record lookups for ip addresses.\n");
			response.write("DKIM records can also be checked by specifying DKIM:<selector> as the dns record type.\n");
			response.write("\nThe alert frequency can be either 'once' or 'forever'.\n");
			response.end();
			return;
		}
		
		// Log request
		if (email && frequency) {
			console.log('Requested updates on ' + record + ' records for ' + host + ' sent to <' + email + '> ' + frequency + ' at ' + new Date() + ' via ' + request.url);
		} else {
			console.log('Requested ' + record + ' record for ' + host + ' at ' + new Date() + ' via ' + request.url);
		}

		if (dns.checkRequest(host, record, response)) {
			dns.lookup(host, record, response, function(dnsData) {
				db.collection('hosts', function(err, hosts) {
					if (dnsData.error) {
						hosts.update( {'host':dnsData.host, 'dns':dnsData.dns, 'error':dnsData.error}, {$set:{'time':dnsData.time }},
											{safe:true, upsert: true},
											function(err) {
												if (err) console.log(err);
											});
					} else {
						hosts.update( {'host':dnsData.host, 'dns':dnsData.dns, 'response':dnsData.response}, {$set:{'time':dnsData.time }},
											{safe:true, upsert: true},
											function(err) {
												if (err) console.log(err);
											});
					}
				});
				if (email && frequency) {
					response.write("\nRequesting alerts for <" + email + "> " + frequency);
					db.collection('alerts', function(err, alerts) {
						alerts.update( {'email':email, 'host': dnsData.host, 'dns':dnsData.dns},
											{$set:{'frequency':frequency}},
											{safe:true, upsert:true},
											function (err) {
												if (err) {
													console.log(err);
												}
											});
					});
				}
				response.end();
			});
		} else {
			response.end();
		}
	});
	
db.open(function(err,db) {
	if (!err) {
		// Setup collection if it doesnt exist
		db.createCollection('hosts', function(err, collection) {});
		db.createCollection('alerts', function(err, collection) {});
	}
});

// It listens on port 1337 and IP 127.0.0.1
server.listen(1337);

// For the joy
console.log('Server running at <a href="http://127.0.0.1:1337/">http://127.0.0.1:1337/</a>');
