const express = require("express");
const http = require("http");
const axios = require("axios");
const crypto = require("crypto");

const keys = require("./keys.json");

const app = express();
const http_port = process.env.PORT || 8080;

let state_token = {};

const responseMessage = (res, is_success, message) => {
	res.json({
		result: is_success ? 1 : 0,
		message: message
	});
};

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));

app.get('/github_login', (req, res) => {
	let state = req.query.state;
	console.log(`github_login with state: ${state}. state_token: ${state_token[state]}`);
	if (!state) {
		responseMessage(res, false, 'State not provided.');
	} else if (state_token[state]) {
		responseMessage(res, false, 'Already used state.');
	} else {
		state_token[state] = 'reserved';
		console.log(`set state_token: ${state_token[state]}`);
		res.redirect(`https://github.com/login/oauth/authorize?client_id=${keys.github_client_id}&state=${state}`);
	}
});
app.get('/github_login/callback', (req, res) => {
	let code = req.query.code;
	let state = req.query.state;

	if (!state) {
		return responseMessage(res, false, 'State not provided.');
	} else if (!code) {
		delete state_token[state];
		return responseMessage(res, false, 'Failed to login by Github.');
	}

	axios.post('https://github.com/login/oauth/access_token', {
		client_id: keys.github_client_id,
		client_secret: keys.github_client_secret,
		code: code,
		state: state
	}, {
		headers: {
			'Accept': 'application/json'
		}
	})
	.then(response => {
		let token = response.data.access_token;
		state_token[state] = token;
		responseMessage(res, true, response.data);
	})
	.catch(err => {
		console.log(err);
		delete state_token[state];
		responseMessage(res, false, 'Failed to get an access-token.');
	});
});
app.get('/state', (req, res) => {
	let state;

	// generate a random state
	do {
		state = crypto.randomBytes(20).toString('hex');
	} while (state_token[state]);

	responseMessage(res, true, state);
});
app.get('/token', (req, res) => {
	let state = req.query.state;
	let token;

	if (!state) {
		return responseMessage(res, false, 'State not provided.');
	}
	
	// return a token from the state
	token = state_token[state];
	if (!token || token == 'reserved') {
		responseMessage(res, false, 'Invalid state');
	} else {
		responseMessage(res, true, token);
	}
});

http.createServer(app).listen(http_port);
console.log(`Server started with port: ${http_port}`);