module.exports = function(RED) {
	var request = require("request");
    var URL = require('url').URL;
    function PairingNode(config) {
        RED.nodes.createNode(this,config);
		var key = config.pairingKey || 0;
        var node = this;
		node.on('input', function(msg) {
			node.status({fill:"blue",shape:"dot",text:"httpin.status.requesting"});
			msg.headers = {'USER-AGENT':'UDAP/2.0', 'CONTENT-TYPE':'text/xml'};
			msg.method = 'POST';
			msg.timeout = 120000;
			var loc = msg.url || config.url;
			if(!loc){
				node.error('No URL specified!');
			}
			var api = msg.api || config.api;	// [pairing]
			var action = msg.action || config.action;	// [showKey, hello, byebye, update]
			loc = new URL(loc);
			msg.url = loc.origin + '/udap/api/' + api;
			if (!((msg.url.indexOf("http://") === 0) || (msg.url.indexOf("https://") === 0))) {
                msg.url = "http://"+msg.url;
            }
			if(action === 'showKey'){
				msg.body = '<?xml version="1.0" encoding="utf-8"?><envelope><api type="pairing"><name>showKey</name></api></envelope>';
			} else if(action === 'hello'){
				msg.body = '<?xml version="1.0" encoding="utf-8"?><envelope><api type="pairing"><name>hello</name><value>'+key+'</value><port>'+loc.port+'</port></api></envelope>';
			} else if(action === 'byebye'){
				msg.body = '<?xml version="1.0" encoding="utf-8"?><envelope><api type="pairing"><name>byebye</name><port>'+loc.port+'</port></api></envelope>';
			} else if(action === 'update'){
				msg.body = '<?xml version="1.0" encoding="utf-8"?><envelope><api type="pairing"><name>update</name><value>'+msg.payload.ip+'</value><expire>'+msg.payload.oldip+'</expire></api></envelope>';
			} else {
				msg.body = '<?xml version="1.0" encoding="utf-8"?><envelope><api type="pairing"><name>showKey</name></api></envelope>';
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
                        msg.body = msg.body.toString('utf8'); // txt
                    }
					switch(msg.statusCode) {
						case 200:
							msg.payload = "SUCCESS!";
							break;
						case 401:
							msg.payload = "Failed, maybe wrong pairing-key?";
							break;
						default:
							msg.payload = body;
							break;
					}
                    node.status({});
					node.send(msg);
                }
            });
		});
    }
    RED.nodes.registerType("udap-pairing",PairingNode);
}
