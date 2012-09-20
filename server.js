var dns = require('dns'),
	http = require('http'),
	
	server = http.createServer(function (request, response) {
		    // Every request outputs "hello world"
    		response.writeHead(200, {'Content-Type': 'text/plain'});
			// response.write( request.url + '\n' );

		    // And also logs
		    console.log('Page requested at ' + new Date() + ', for ' + request.url);

			var args = request.url.split('/'),
				validRecords = ['A', 'AAAA', 'MX', 'TXT', 'SRV', 'PTR', 'NS', 'CNAME'],
				host = args[1],
				record = args[2],
				isIP = host.match(/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/),
				isProtectedIP = isIP ? host.match(/^(192\.168|172\.1[6789]|172\.2[0-9]|172\.3[01]|10)\./) : false,
				isAddress = host.match(/^(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}$/);

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

			if (validRecords.indexOf(record) < 0) {
				response.end(record + " is not a valid/supported DNS record type.\n");
				return;
			}

			if (isAddress && record == 'PTR') {
				response.end(record + " is only a valid DNS lookup for IP addresses.\n");
				return;
			}

			response.write("Lookup the " + record + " record for " + host + "\n");

			if (isAddress) {
				dns.resolve(host, record, function (err, addresses) {
					if (err) throw err;

					response.write('addresses: ' + JSON.stringify(addresses) + "\n");
					//console.log('addresses: ' + JSON.stringify(addresses) + "\n");
				    response.end('Hello World\n');

					// A record specific
					/*addresses.forEach(function (a) {
						dns.reverse(a, function (err, domains) {
							if (err) {
								throw err;
							}

						  	console.log('reverse for ' + a + ': ' + JSON.stringify(domains));
						});
					});*/
				});
			} else {
				dns.reverse(host, function (err, domains) {
					if (err) throw err;

					response.write('domains: ' + JSON.stringify(domains) + "\n");
					//console.log('domains: ' + JSON.stringify(domains) + "\n");
				    response.end('Hello World\n');
				});
			}

	});
	
	// It listens on port 1337 and IP 127.0.0.1
	server.listen(1337, "127.0.0.1");
	// For the joy
	console.log('Server running at <a href="http://127.0.0.1:1337/">http://127.0.0.1:1337/</a>');
