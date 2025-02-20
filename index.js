
const express = require("express");
const fs = require("fs");
const login = require("ws3-fca");
const axios  = require ("axios");

const app = express();
const port = 3000;

// Error handling for unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Check and create appstate.json if it doesn't exist
if (!fs.existsSync('appstate.json')) {
    fs.writeFileSync('appstate.json', JSON.stringify([], null, 2));
    console.log('Created empty appstate.json file. Please fill it with your Facebook cookies.');
}

// Initialize Facebook Chat API
login({
    appState: JSON.parse(fs.readFileSync('appstate.json', 'utf8'))
}, (err, api) => {
    if(err) return console.error(err);

    // Load and set options from config
    const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
    api.setOptions(config);

    let lastKnownIPs = [];

    // Function to check for new IPs
    const checkNewIPs = async () => {
        try {
            const response = await axios.get('https://zenoontoppanel.onrender.com/get-ip-list');
            const currentIPs = response.data;

            // Find new IPs
            const newIPs = currentIPs.filter(ip => !lastKnownIPs.includes(ip));
            
            // If there are new IPs, send notification
            if (newIPs.length > 0) {
                const msg = `🔔 New IP(s) Detected:\n\n${newIPs.join('\n')}`;
                // Send to all active threads (you may want to set a specific threadID instead)
                api.getThreadList(20, null, ['INBOX'], (err, threads) => {
                    if (err) return console.error(err);
                    threads.forEach(thread => {
                        api.sendMessage(msg, thread.threadID);
                    });
                });
            }

            lastKnownIPs = currentIPs;
        } catch (error) {
            console.error('Error checking IPs:', error);
        }
    };

    // Check for new IPs every 30 seconds
    setInterval(checkNewIPs, 30000);

    // Listen for messages
    api.listenMqtt(async (err, message) => {
        if(err) return console.error(err);

        if(message.body && message.type === "message") {
            if(message.body === "!ip") {
                try {
                    const response = await axios.get('https://zenoontoppanel.onrender.com/get-ip-list');
                    const ipList = response.data;
                    let msg = "📊 IP Address List:\n\n";
                    ipList.forEach((ip, index) => {
                        msg += `${index + 1}. ${ip}\n`;
                    });
                    api.sendMessage(msg, message.threadID);
                } catch (error) {
                    api.sendMessage("❌ Error fetching IP list", message.threadID);
                    console.error(error);
                }
            }
        }
    });

// Start express server
app.listen(port, '0.0.0.0', () => {
    console.log(`Bot server running on port ${port}`);
});
