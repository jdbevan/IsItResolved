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
			record = args[2];

		// Check request matches expected format
		if (!request.url.match(/\/[a-zA-Z0-9-.]+\/[A-Za-z:]+/)) {
			response.write("Requests should be in the format: /<domain name or ip address>/<dns record type>\n");
			response.write("\nWe currently support: A, AAAA, MX, TXT, SRV, NS and CNAME lookups for domain names and PTR record lookups for ip addresses.\n");
			response.write("DKIM records can also be checked by specifying DKIM:<selector> as the dns record type.\n");
			response.end();
			return;
		}
		
		// Log request
		console.log('Requested ' + record + ' record for ' + host + ' at ' + new Date() + ' via ' + request.url);

		if (dns.checkRequest(host, record, response)) {
			
			dns.lookup(host, record, response, function(dnsData) {
				if (dnsData) {
					db.collection('hosts', function(err, collection) {
						collection.update( {'host':dnsData.host, 'dns':dnsData.dns, 'response':dnsData.response}, {$set:{'time':dnsData.time }},
											{safe:true, upsert: true},
											function(err,result) {
												//console.log(err);
											});
					});
					response.end();
				}
			});
		}
	});
	
db.open(function(err,db) {
	if (!err) {
		// Setup collection if it doesnt exist
		db.createCollection('hosts', function(err, collection) {});
	}
});

// It listens on port 1337 and IP 127.0.0.1
server.listen(1337);

// For the joy
console.log('Server running at <a href="http://127.0.0.1:1337/">http://127.0.0.1:1337/</a>');
