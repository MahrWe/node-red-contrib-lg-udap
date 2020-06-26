module.exports = function(RED) {
	var request = require("request");
    var URL = require('url').URL;
	var parseString = require('xml2js').parseString;
    function ApiNode(config) {
        RED.nodes.createNode(this,config);
        var node = this;
		node.on('input', function(msg) {
			msg.headers = {'USER-AGENT':'UDAP/2.0', 'CONTENT-TYPE':'text/xml'};
			msg.timeout = 120000;
			var loc = msg.url || config.url;
			if(!loc){
				node.error('No URL specified!');
			}
			var api = msg.api || config.api;	// [command, event, query]
			var action = msg.action || config.action;	// [HandleKeyInput, AppExecute, AppList]
			loc = new URL(loc);
			msg.url = loc.origin + '/udap/api/' + api;
			if (!((msg.url.indexOf("http://") === 0) || (msg.url.indexOf("https://") === 0))) {
                msg.url = "http://"+msg.url;
            }
			if(action === 'HandleKeyInput'){
				msg.body = '<?xml version="1.0" encoding="utf-8"?><envelope><api type="command"><name>HandleKeyInput</name><value>'+msg.payload+'</value></api></envelope>';
			} else if(action === 'AppExecute'){
				msg.body = '<?xml version="1.0" encoding="utf-8"?><envelope><api type="command"><name>AppExecute</name><auid>'+msg.payload.auid+'</auid><appname>'+msg.payload.appname+'</appname><contentId>'+msg.payload.contentID+'</contentId></api></envelope>';
			} else if(action === 'AppList'){
				msg.method = 'query';
				if(msg.payload){
					msg.url = loc.origin + '/udap/api/data?'+msg.payload;
				} else {
					msg.url = loc.origin + '/udap/api/data?target=applist_get&type=1&index=1&number=1024';
				}
				msg.payload = {};
			} else {
				msg.body = '<?xml version="1.0" encoding="utf-8"?><envelope><api type="'+api+'"><name>'+action+'</name>'+msg.payload+'</api></envelope>';
			}
			if(api === 'query'){
				msg.method = 'GET';
			} else {
				msg.method = 'POST';
			}
			
			request(msg, function(err, res, body) {
                if(err){
                    if(err.code === 'ETIMEDOUT' || err.code === 'ESOCKETTIMEDOUT') {
                        node.error(RED._("common.notification.errors.no-response"), msg);
                        node.status({fill:"red", shape:"ring", text:"common.notification.errors.no-response"});
                    }else{
                        node.error(err,msg);
                        node.status({fill:"red", shape:"ring", text:err.code});
                    }
                    msg.payload = err.toString() + " : " + url;
                    msg.statusCode = err.code;
                    node.send(msg);
                }else{
                    msg.statusCode = res.statusCode;
                    msg.headers = res.headers;
                    msg.responseUrl = res.request.uri.href;
					// Store original Post message
					msg.message = msg.body;
                    msg.body = body;

                    if (node.metric()) {
                        // Calculate request time
                        var diff = process.hrtime(preRequestTimestamp);
                        var ms = diff[0] * 1e3 + diff[1] * 1e-6;
                        var metricRequestDurationMillis = ms.toFixed(3);
                        node.metric("duration.millis", msg, metricRequestDurationMillis);
                        if (res.client && res.client.bytesRead) {
                            node.metric("size.bytes", msg, res.client.bytesRead);
                        }
                    }

                    // Convert the payload to the required return type
                    if (node.ret !== "bin") {
                        value = msg.body.toString('utf8'); // txt

                        options = {};
						if (msg.hasOwnProperty("options") && typeof msg.options === "object") { options = msg.options; }
						options.async = true;
						options.attrkey = options.attrkey || '$';
						options.charkey = options.charkey || '_';
						parseString(value, options, function (err, result) {
							if (err) { node.error(err, msg); }
							else {
								msg.payload = result;
								node.status({});
								node.send(msg);
							}
						});
                    }
                }
            });
		});
    }
    RED.nodes.registerType("udap-api",ApiNode);
}
