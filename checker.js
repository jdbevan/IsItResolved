var dns = require('dns'),
	validRecords = ['A', 'AAAA', 'MX', 'TXT', 'SRV', 'PTR', 'NS', 'CNAME'],
	isIP = function (host) {
		return host.match(/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/);
	},
	isProtectedIP = function (host) {
		return host.match(/^(192\.168|172\.1[6789]|172\.2[0-9]|172\.3[01]|10)\./);
	},
	isAddress = function (host) {
		return host.match(/^(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}$/);
	},
	lookup = function(host, record, response, callback) {
		// TODO: convert to https://npmjs.org/package/native-dns
		// TODO: store results in MongoDB
		if (isAddress(host)) {
			dns.resolve(host, record, function (err, hosts) {
				if (err) {
					//throw err;
					if (response) {
						response.write( errorHandler(err) + "\n" );
					}
					callback( {'host':host, 'dns':record, 'error':errorHandler(err), 'time':(new Date()).getTime()} );
				} else {
					hostsResponse = objectArraySort(hosts); //.sort();
					if (response) {
						response.write('records: ' + JSON.stringify(hostsResponse) + "\n");
					}
					callback( {'host':host, 'dns':record, 'response':hostsResponse, 'time':(new Date()).getTime()} );
				}
			});
		} else {
			dns.reverse(host, function (err, domains) {
				if (err) {
					if (response) {
						response.write( errorHandler( err ) + "\n" );
					}
					callback( {'host':host, 'dns':record, 'error':errorHandler(err), 'time':(new Date()).getTime()} );
				} else {
					domainsResponse = objectArraySort(domains);
					if (response) {
						response.write('domains: ' + JSON.stringify(domainsResponse) + "\n");
					}
					callback( {'host':host, 'dns':record, 'response':domainsResponse, 'time':(new Date()).getTime()} );
				}
			});
		}
	},
	checkRequest = function (host, record, response) {
		// Print information about request
		if (isIP(host)) {
			if (isProtectedIP(host)) {
				if (response) {
					response.end(record + " is a valid, RFC 1918 protected, IP address\n");
				}
				return false;
			} else {
				if (response) response.write(host + " is a valid IP address\n\n");
			}
		} else if (isAddress(host)) {
			if (response) response.write(host + " is (hopefully) a valid domain name\n\n");
		} else {
			if (response) {
				response.end(record + " does not appear to be a valid domain name or IP address\n");
			}
			return false;
		}
		
		// Handle DKIM
		var selector = record.match(/^DKIM:([a-zA-Z0-9-_.]+)$/);
		if (selector) {
			record = 'TXT';
			host = selector[1] + '._domainkey.' + host;
		
		} else if (validRecords.indexOf(record) < 0) {
			if (response) {
				response.write(record + " is not a valid/supported DNS record type.\n");
				response.write("Please try: A, AAAA, MX, TXT, SRV, NS or CNAME lookups for domain names and PTR lookups for IP addresses.\n");
				response.end("DKIM lookups can also be performed by specifying DKIM:<selector> as the dns record type.\n");
			}
			return false;
		}

		if (isAddress(host) && record == 'PTR') {
			if (response) {
				response.end(record + " is only a valid DNS lookup for IP addresses.\n");
			}
			return false;
		}
		// Print action to be performed
		if (response) response.write("Looking up the " + record + " record for " + host + "\n");
		
		return true;
	},
	objectArraySort = function(a) {
        var obj,
            key,
            newObj,
            properties = [],
            newArray = [];

        // For each object in the array
        // get their properties into one array
        // and store their values in another (the keys in the array being the property names)
        // then sort the properties alphabetically and construct a new object with the
        // properties added alphabetically
        for (obj in a) {
            newObj = {};
            properties[obj] = [];
			if (typeof(a[obj])=='string' || typeof(a[obj])=='number') {
				return a.sort();
			}
            if (a.hasOwnProperty(obj)) {
                //console.log("Object " + obj);
                // Get properties
                for (key in a[obj]) {
                    if (a[obj].hasOwnProperty(key)) {
                        //console.log("Object[" + obj + "] has " + key + " = " + a[obj][key]);
                        properties[obj].push( key );
                    }
                }
                //console.log(properties);
                // Sort properties
                properties[obj].sort();
                //console.log(properties[obj]);
                // Create new object
                for (key in properties[obj]) {
                    if (properties[obj].hasOwnProperty(key)) {
                        newObj[ properties[obj][key] ] = a[obj][ properties[obj][key] ];
                    }
                }
                //console.log(newObj);
                // Store newly sorted object
                newArray.push(newObj);
            }
        }
        //console.log(newArray);
        // The sort the array, a, using a compare function which iterates over the properties
        // of a, comparing them to b and returning 1, -1 or 0 at the point at which the values differ
		newArray.sort(
			function(a,b) {
				var prop;
				// Loop through properties in a
				for (prop in a) {
					if (a.hasOwnProperty(prop)) {
						if (!b.hasOwnProperty(prop)) {
							// If b is missing the property it is LESS THAN
							//console.log("b doesnt have " + prop);
							return -1;
						} else {
							// If b has property, and its less than or greater than
							// return a value, otherwise continue the loop through
							// a's properties
							if (a[prop] > b[prop]) {
								//console.log(a[prop] + " > " + b[prop]);
								return 1;
							} else if (a[prop] < b[prop]) {
								//console.log(a[prop] + " < " + b[prop]);
								return -1;
							}
						}
					}
				}
				return 0;
			}
		);
        return newArray;
	},
	objectsEqual = function(a,b) {
		// If string, number, boolean
		if (a === b) {
			return true;
		}
		
		if (typeof(a) !== typeof(b)){
			return false;
		} else if (typeof(a) == 'string' || typeof(a) == 'number' || typeof(a) == 'boolean' || typeof(a) == 'undefined') {
			return (a === b);
		}
		
		// Arrays
		var aIsArray = (Object.prototype.toString.call(a) === "[object Array]"),
			bIsArray = (Object.prototype.toString.call(b) === "[object Array]"),
			key,
			okKeys = [];
		// Check both are same type: array or not array
		if (aIsArray !== bIsArray) {
			return false;
		}
		// Check all properties
		for(key in a) {
			if (a.hasOwnProperty(key)) {
				if (b.hasOwnProperty(key)) {
					// Return false if the two properties aren't equal
					if (!objectsEqual(a[key], b[key])) {
						return false;
					} else {
						// Store keys that have been dealt with
						okKeys.push(key);
					}
				} else {
					return false;
				}
			}
		}
		// Check all properties
		for(key in b) {
			if (okKeys.indexOf(key) != -1) {
				// Ignore keys that have been dealt with
				continue;
			}
			if (b.hasOwnProperty(key)) {
				if (a.hasOwnProperty(key)) {
					// This should never run, as we've already checked a's properties
					// Return false if the two properties aren't equal
					if (!objectsEqual(b[key], a[key])) {
						return false;
					}
				} else {
					return false;
				}
			}
		}
		return true;
	},
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

exports.checkRequest = checkRequest;
exports.lookup = lookup;
exports.objectsEqual = objectsEqual;
