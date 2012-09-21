var dns = require('dns'),
	http = require('http'),
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
			validRecords = ['A', 'AAAA', 'MX', 'TXT', 'SRV', 'PTR', 'NS', 'CNAME'],
			host = args[1],
			record = args[2],
			isIP = host.match(/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/),
			isProtectedIP = isIP ? host.match(/^(192\.168|172\.1[6789]|172\.2[0-9]|172\.3[01]|10)\./) : false,
			isAddress = host.match(/^(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}$/),
			errorHandler = function(e) {
				var errorMsg = 'Sorry, ';
				if (e.code != undefined) {
					switch (e.code) {
						case dns.NODATA:
							errorMsg += 'no data found.';
							break;
						case dns.FORMERR:
							errorMsg += 'my bad, I sent a misformatted query. Apparently.';
							break;
						case dns.SERVFAIL:
							errorMsg += 'there was a generic server failure. Press any key...';
							break;
						case dns.NOTFOUND:
							errorMsg += 'the internetz don\'t recognise that domain name.';
							break;
						case dns.NOTIMP:
							errorMsg += 'that request isn\'t supported by the server.';
							break;
						case dns.REFUSED:
							errorMsg += 'computer says no.';
							break;
						case dns.BADQUERY:
							errorMsg += 'misformatted DNS query.';
							break;
						case dns.BADNAME:
							errorMsg += 'that domain name is a state.';
							break;
						case dns.BADFAMILY:
							errorMsg += 'I don\'t support that kind of address.';
							break;
						case dns.BADRESP:
							errorMsg += 'garbled voicemail.';
							break;
						case dns.CONNREFUSED:
							errorMsg += 'no dial tone.';
							break;
						case dns.TIMEOUT:
							errorMsg += 'I gave up waiting.';
							break;
						case dns.EOF:
							errorMsg += 'I was cut short.';
							break;
						case dns.FILE:
							errorMsg += 'permissions issue.';
							break;
						case dns.NOMEM:
							errorMsg += 'please install more RAM.';
							break;
						case dns.DESTRUCTION:
							errorMsg += 'Apocalypse Now!';
							break;
						case dns.BADSTR:
							errorMsg += 'your string\'s in a mess.';
							break;
						case dns.BADFLAGS:
							errorMsg += 'that\'s an illegal flag.';
							break;
						case dns.NONAME:
							errorMsg += 'that hostname was not numeric.';
							break;
						case dns.BADHINTS:
							errorMsg += 'those were illegal hints flags.';
							break;
						case dns.NOTINITIALIZED:
							errorMsg += 'jumped the gun.';
							break;
						case dns.LOADIPHLPAPI:
							errorMsg += 'DLL hell.';
							break;
						case dns.ADDRGETNETWORKPARAMS:
							errorMsg += 'I couldn\'t find my network settings.';
							break;
						case dns.CANCELLED:
							errorMsg += 'that request was cancelled. You will be refunded.';
							break;
						default:
							errorMsg += 'unknown error...' + JSON.stringify(e);
							break;
					}
				} else {
					errorMsg += JSON.stringify(e);
				}
				return errorMsg;
			};

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

		// Print information about request
		if (isIP) {
			if (isProtectedIP) {
				response.end(record + " is a valid, RFC 1918 protected, IP address\n");
				return;
			} else {
				response.write(record + " is a valid IP address\n");
			}
		} else if (isAddress) {
			response.write(host + " is (hopefully) a valid domain name\n");
		} else {
			response.end(record + " does not appear to be a valid domain name or IP address\n");
			return;
		}

		// Handle DKIM
		var selector = record.match(/^DKIM:([a-zA-Z0-9-_.]+)$/);
		if (selector) {
			record = 'TXT';
			host = selector[1] + '._domainkey.' + host;
		
		} else if (validRecords.indexOf(record) < 0) {
			response.write(record + " is not a valid/supported DNS record type.\n");
			response.write("Please try: A, AAAA, MX, TXT, SRV, NS or CNAME lookups for domain names and PTR lookups for IP addresses.\n");
			response.end("DKIM lookups can also be performed by specifying DKIM:<selector> as the dns record type.\n");
			return;
		}

		if (isAddress && record == 'PTR') {
			response.end(record + " is only a valid DNS lookup for IP addresses.\n");
			return;
		}
		// Print action to be performed
		response.write("Looking up the " + record + " record for " + host + "\n");
		
		// TODO: convert to https://npmjs.org/package/native-dns
		// TODO: store results in MongoDB
		if (isAddress) {
			dns.resolve(host, record, function (err, hosts) {
				if (err) {
					//throw err;
					response.write( errorHandler(err) + "\n" );
				} else {
					response.write('records: ' + JSON.stringify(hosts) + "\n");
					
					db.collection('hosts', function(err, collection) {
						collection.update( {'host':host, 'dns':record, 'response':hosts}, {$set:{'time':(new Date()).getTime() }},
											{safe:true, upsert: true},
											function(err,result) {
												//console.log(err);
											});
					});
				}
				response.end();
			});
		} else {
			dns.reverse(host, function (err, domains) {
				if (err) {
					response.write( errorHandler( err ) + "\n" );
				} else {
					response.write('domains: ' + JSON.stringify(domains) + "\n");

					db.collection('hosts', function(err, collection) {
						collection.update( {'host':host, 'dns':record, 'response':domains}, {$set:{'time':(new Date()).getTime() }},
											{safe:true, upsert: true},
											function(err,result) {
												//console.log(err);
											});
					});
				}
				response.end();
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