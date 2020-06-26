module.exports = function(RED) {
    var SSDP = require('node-ssdp').Client;

    var SSDPIP = '239.255.255.250';
    var SSDPPORT = 1900;
    var SSDPSIG = 'UDAP/2.0';

    function DiscoveryNode(config) {
        RED.nodes.createNode(this,config);
        // Perform B-SEARCH when multicase is not supported by network
        if(config.broadcast) {
            SSDPIP = config.broadcastIP || '255.255.255.255';
            SSDPPORT = 1990;
        }
        var node = this;
		var ssdp = new SSDP(ssdpSig = SSDPSIG, ssdpIp = SSDPIP, ssdpPort = SSDPPORT);
        ssdp.on('response', function(headers, statusCode, rinfo) {
			var newmsg = {
				payload: {
					headers: headers,
					statusCode: statusCode,
					rinfo: rinfo
				}
			};
			node.send(newmsg);
        });
		node.on('input', function(msg) {
       		ssdp.search('udap:rootservice');
        });
    }
    RED.nodes.registerType("udap-discovery",DiscoveryNode);
}
