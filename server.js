// Requires
const WebSocketServer = require('ws').Server
const log             = require('./modules/log.js');
const tools           = require('./modules/tools.js');
const lrcreader       = require('./modules/lrcdata-reader.js');
const datahandler     = require('./modules/data-handler.js');

// Array of autrorized clients
let clients = new Array();

// Start websocket server
const wss = new WebSocketServer({ port: 8080 });
wss.on('connection', onConnection);
log.info('Server started');

// On new connection
function onConnection(ws) {

    // Event handlers
    ws.on('open', onOpen);
    ws.on('message', onMessage);
    ws.on('close', onClose);

    // On connection open
    function onOpen() {
	    log.info('Socket connected');
    }

    // On new message
    function onMessage(message, flags) {
        if (flags.binary) {
            handleBinaryMessage(message);
        } else {
            handleTextMessage(message);
        }
    }

    // On connection close
    function onClose(code, message) {
        if (clients[ws] != undefined) {
            delete clients[ws];
        }
        log.info('Socket disconnected');
    }

    // On text message
    function handleTextMessage(message) {

        // Get request object
        var request = {};
        try {
            request = JSON.parse(message);
            log.info('[Client] ' + message);
        } catch (ex) {
            log.error('Can\'t parse json from client');
            return;
        }

        // Skip bad JSONs
        if (request.name == undefined || request.data == undefined) {
            log.error('Bad json');
            return;
        }
        
        // Handle request object
        switch (request.name) {

            // Client's request for new sha256
            case 'get-uid':
            var uid = tools.newUID();
            ws.send('uid:' + uid);
            break;

            // Client's authorization
            case 'set-uid':
            // Skip authorization if client is already authorized
            if (clients[ws] != undefined) {
                break;
            }

            datahandler.getUserID(ws, request.data, authorizeClient);
            break;

        }

    }

    // On binary message
    function handleBinaryMessage(message) {

        // Skip binary message if user isn't authorized
        if (clients[ws] == undefined) {
            log.error('Binary message from unauthorized user. Disconnecting.');
            ws.terminate();
            return;
        }

        // Parse binary data from client into object
        var lrcdata = lrcreader.read(message);
        
        // Skip binary message if cannot parse data into object
        if (!lrcdata.ok) {
            log.error('Can\'t parse LRCData');
            return;
        }
        
        // Save parsed data into database
        datahandler.saveData(clients[ws].id, lrcdata);
    }

    // Add client to authorized clients array
    function authorizeClient(userID, sha256) {
        if (userID == -1) return;

        clients[ws] = {
            id: userID,
            sha256: sha256
        };

        ws.send('inf:uid-accepted');
    }
}