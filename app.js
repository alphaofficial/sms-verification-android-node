/*
    Load Twilio configuration from .env config file - the following environment
    variables should be set:
    process.env.TWILIO_ACCOUNT_SID
    process.env.TWILIO_API_KEY
    process.env.TWILIO_API_SECRET
    process.env.SENDING_PHONE_NUMBER
    process.env.APP_HASH
*/
require('dotenv').load();
const http = require('http');
const path = require('path');
const express = require('express');
const jsonBodyParser = require('body-parser').json();

// Twilio Library
const Twilio = require('twilio');


// Check configuration variables
if (process.env.TWILIO_API_KEY == null ||
    process.env.TWILIO_API_SECRET == null ||
    process.env.TWILIO_ACCOUNT_SID == null) {
        console.log('Please copy the .env.example file to .env, ' +
                    'and then add your Twilio API Key, API Secret, ' +
                    'and Account SID to the .env file. ' +
                    'Find them on https://www.twilio.com/console');
        process.exit();
}

if (process.env.SENDING_PHONE_NUMBER == null) {
    console.log('Please provide a valid phone number, ' +
                'such as +15125551212, in the .env file');
    process.exit();
}

if (process.env.APP_HASH == null) {
    console.log('Please provide a valid Android app hash, ' +
                'in the .env file');
    process.exit();
}

if (process.env.CLIENT_SECRET == null) {
    console.log('Please provide a secret string to share, ' +
                'between the app and the server ' +
                'in the .env file');
    process.exit();
}

const configuredClientSecret = process.env.CLIENT_SECRET;

// Initialize the Twilio Client
const twilioClient = new Twilio(process.env.TWILIO_API_KEY,
                        process.env.TWILIO_API_SECRET,
                        {accountSid: process.env.TWILIO_ACCOUNT_SID});

const SMSVerify = require('./SMSVerify.js');
const smsVerify = new SMSVerify(twilioClient,
                    process.env.SENDING_PHONE_NUMBER,
                    process.env.APP_HASH);

// Create Express webapp
const app = express();
app.use(express.static(path.join(__dirname, 'public')));

/*
    Sends a one-time code to the user's phone number for verification
*/
app.post('/api/request', jsonBodyParser, function(request, response) {
    const clientSecret = request.body.client_secret;
    const phone = request.body.phone;

    if (clientSecret == null || phone == null) {
        // send an error saying that both client_secret and phone are required
        response.send(500, 'Both client_secret and phone are required.');
        return;
    }

    if (configuredClientSecret != clientSecret) {
        response.send(500, 'The client_secret parameter does not match.');
        return;
    }

    smsVerify.request(phone);
    response.send({
        success: true,
        time: smsVerify.getExpiration(),
    });
});

/*
    Verifies the one-time code for a phone number
*/
app.post('/api/verify', jsonBodyParser, function(request, response) {
    const clientSecret = request.body.client_secret;
    const phone = request.body.phone;
    const smsMessage = request.body.sms_message;

    if (clientSecret == null || phone == null || smsMessage == null) {
        // send an error saying that all parameters are required
        response.send(500, 'The client_secret, phone, ' +
                    'and sms_message parameters are required');
        return;
    }

    if (configuredClientSecret != clientSecret) {
        response.send(500, 'The client_secret parameter does not match.');
        return;
    }

    const isSuccessful = smsVerify.verify(phone, smsMessage);

    if (isSuccessful) {
        response.send({
            success: true,
            phone: phone,
        });
    } else {
        response.send({
            success: false,
            msg: 'Unable to validate code for this phone number',
        });
    }
});

/*
    Resets the one-time code for a phone number
*/
app.post('/api/reset', jsonBodyParser, function(request, response) {
    const clientSecret = request.body.client_secret;
    const phone = request.body.phone;

    if (clientSecret == null || phone == null) {
        // send an error saying that all parameters are required
        response.send(500, 'The client_secret and phone parameters are required');
        return;
    }

    if (configuredClientSecret != clientSecret) {
        response.send(500, 'The client_secret parameter does not match.');
        return;
    }

    const isSuccessful = smsVerify.reset(phone);

    if (isSuccessful) {
        response.send({
            success: true,
            phone: phone,
        });
    } else {
        response.send({
            success: false,
            msg: 'Unable to reset code for this phone number',
        });
    }
});

/*
 * Basic health check - check environment variables have been
 * configured correctly
 */
app.get('/config', function(request, response) {
  response.json( {
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
    TWILIO_API_KEY: process.env.TWILIO_API_KEY,
    TWILIO_API_SECRET: process.env.TWILIO_API_SECRET != '',
    SENDING_PHONE_NUMBER: process.env.SENDING_PHONE_NUMBER,
    CLIENT_SECRET: process.env.CLIENT_SECRET,
    APP_HASH: process.env.APP_HASH,
  });
});


// Create http server and run it
const server = http.createServer(app);
const port = process.env.PORT || 3000;
server.listen(port, function() {
    console.log('Express server running on *:' + port);
});
