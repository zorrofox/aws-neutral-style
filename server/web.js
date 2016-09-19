'use strict';

const AWS = require('aws-sdk');
var docClient = new AWS.DynamoDB.DocumentClient();
var s3 = new AWS.S3();
var lambda = new AWS.Lambda();
var ssm = new AWS.SSM();

const config = require('./config.js');
const Sync = require('sync');
const bcrypt = require('bcryptjs');
var moment = require('moment');
var jwt = require('jwt-simple');

const USER_TABLE_NAME = 'neutral-style-users';
const ORIGINAL_PHOTOS_BUCKET = 'neutral-style-photos';
const STYLE_PHOTOS_BUCKET = 'neutral-style';
const OUTPUT_PHOTOS_BUCKET = 'neutral-style-output';
const gpuInstance = 'i-606b8aee';
const RUN_GPU_FUNCTION = 'neutral-style-dev-runGPU';


function userSaveOne(user, cb) {
	docClient.put({
		TableName: USER_TABLE_NAME,
		Item: user
	}, function(err, data) {
		if (err)
			cb(err);
		else
			cb(null, data);
	});
}

function userFindOne(email, cb) {
	docClient.get({
			TableName: USER_TABLE_NAME,
			Key: {
				"email": email
			}
		},
		function(err, data) {
			if (err)
				cb(err);
			else
				cb(null, data);
		});
}

function getSalt(cb) {
	bcrypt.genSalt(10, function(err, salt) {
		if (err)
			cb(err);
		else
			cb(null, salt);
	});
}

function getSaltHash(val, salt, cb) {
	bcrypt.hash(val, salt, function(err, hash) {
		if (err)
			cb(err);
		else
			cb(null, hash);
	});
}

function hashIsMatch(val1, val2, cb) {
	bcrypt.compare(val1, val2, function(err, isMatch) {
		if (err)
			cb(err);
		else
			cb(null, isMatch);
	});
}

function createToken(user) {
	var payload = {
		exp: moment().add(14, 'days').unix(),
		iat: moment().unix(),
		sub: user.email
	};

	return jwt.encode(payload, config.tokenSecret);
}

function getObjectList(bucket, cb) {
	s3.listObjects({
		Bucket: bucket
	}, function(err, data) {
		if (err)
			cb(err);
		else
			cb(null, data);
	});
}

function getSignedUrl(bucket, key, cb) {
	s3.getSignedUrl('getObject', {
		Bucket: bucket,
		Key: key
	}, function(err, data) {
		if (err)
			cb(err)
		else
			cb(null, data);
	});
}

function getPutSingedUrl(bucket, key, contentType, cb) {
	s3.getSignedUrl('putObject', {
		Bucket: bucket,
		Key: key,
		ContentType: contentType
	}, function(err, url) {
		if (err)
			cb(err);
		else
			cb(null, url);
	});
}

function getObjectInfo(bucket, key, cb) {
	s3.headObject({
		Bucket: bucket,
		Key: key
	}, function(err, data) {
		if (err)
			cb(err)
		else
			cb(null, data);
	});
}

function delObject(bucket, objs, cb) {
	s3.deleteObjects({
		Bucket: bucket,
		Delete: {
			Objects: objs
		}
	}, function(err, data) {
		if (err)
			cb(err);
		else
			cb(null, data);
	});
}

function descSSMCommand(params, cb) {
	ssm.listCommandInvocations(params, function(err, data) {
		if (err)
			cb(err);
		else
			cb(null, data);
	});
}

function signup(event, context, callback) {

	Sync(function() {

		try {
			var user = userFindOne.sync(null, event.body.email);

			if (user.Item)
				callback(new Error('[400] Email is already taken.'));
			else {
				user = {
					email: event.body.email,
					password: event.body.password
				};
				var salt = getSalt.sync(null);
				var hash = getSaltHash.sync(null, user.password, salt);
				user.password = hash;
				var data = userSaveOne.sync(null, user);
				var token = createToken(user);
				callback(null, {
					token: token,
					user: user
				});

			}
		} catch (err) {
			callback(new Error('[500] ' + err))
		}

	});
}

function login(event, context, callback) {
	Sync(function() {
		try {
			var user = userFindOne.sync(null, event.body.email);
			if (!user.Item)
				callback(new Error('[401] Incorrect email'));
			else {
				var isMatch = hashIsMatch.sync(null, event.body.password, user.Item.password);
				if (isMatch) {
					user = user.Item;
					delete user.password;
					var token = createToken(user);
					callback(null, {
						token: token,
						user: user
					});
				} else
					callback(new Error('[401] Incorrect password'));
			}
		} catch (err) {
			callback(new Error('[500] ' + err))
		}
	});
}

function isAuthenticated(event, context) {

	try {

		var token = event.authorizationToken.split(' ')[1];

		var payload = jwt.decode(token, config.tokenSecret);
		var now = moment().unix();



		if (now > payload.exp) {
			console.log(now)
			console.log(payload);
			context.succeed(generatePolicy('user', 'Deny', event.methodArn));
		}

		Sync(function() {

			try {
				var user = userFindOne.sync(null, payload.sub);
				if (user.Item)
					context.succeed(generatePolicy('user', 'Allow', event.methodArn));
				else
					context.succeed(generatePolicy('user', 'Deny', event.methodArn));
			} catch (err) {
				console.log(err);
				context.fail(err);
			}

		});
	} catch (err) {
		console.log(err);
		context.succeed(generatePolicy('user', 'Deny', event.methodArn));
	}
}


function generatePolicy(principalId, effect, resource) {
	var authResponse = {};
	authResponse.principalId = principalId;
	if (effect && resource) {
		var policyDocument = {};
		policyDocument.Version = '2012-10-17'; // default version
		policyDocument.Statement = [];
		var statementOne = {};
		statementOne.Action = 'execute-api:Invoke'; // default action
		statementOne.Effect = effect;
		statementOne.Resource = resource;
		policyDocument.Statement[0] = statementOne;
		authResponse.policyDocument = policyDocument;
	}
	return authResponse;
}

function feed(event, context, callback) {

	Sync(function() {
		try {
			if (!event.query.type) {
				var bucket = ORIGINAL_PHOTOS_BUCKET;
			} else if (event.query.type === 'style') {
				var bucket = STYLE_PHOTOS_BUCKET;
			} else if (event.query.type === 'output') {
				var bucket = OUTPUT_PHOTOS_BUCKET;
			} else {
				callback(new Error('[400] not good query'));
			}
			var data = getObjectList.sync(null, bucket);
			for (var i = 0; i < data.Contents.length; i++) {
				data.Contents[i].url = getSignedUrl.sync(null, bucket, data.Contents[i].Key);
			}
			callback(null, data.Contents);
		} catch (err) {
			callback(new Error('[500] Get photos list error: ' + err));
		}
	});
}

function media(event, context, callback) {
	Sync(function() {
		try {
			if (event.query.key) {
				var data = getObjectInfo.sync(null, ORIGINAL_PHOTOS_BUCKET, event.query.key);
				data.url = getSignedUrl.sync(null, ORIGINAL_PHOTOS_BUCKET, event.query.key);
				callback(null, data);
			} else {
				callback(new Error('[400] Invalid photo object key.'));
			}
		} catch (err) {
			callback(new Error('[500] Get photos info error: ' + err));
		}

	});
}

function uploadUrl(event, context, callback) {
	Sync(function() {
		try {
			if (event.body.type === 'ORIGINAL')
				var url = getPutSingedUrl.sync(null, ORIGINAL_PHOTOS_BUCKET, event.body.key, event.body.contentType);
			else if (event.body.type === 'STYLE')
				var url = getPutSingedUrl.sync(null, STYLE_PHOTOS_BUCKET, event.body.key, event.body.contentType);
			else
				callback(new Error('[400] Get photos upload url type not support'));
			callback(null, url);
		} catch (err) {
			callback(new Error('[500] Get photos upload url error: ' + err));
		}

	});
}

function delUpload(event, context, callback) {
	Sync(function() {
		try {
			var data = getObjectList.sync(null, OUTPUT_PHOTOS_BUCKET);
			var objectKey = [];

			if (event.query.type === 'ORIGINAL') {

				var del = delObject.sync(null, ORIGINAL_PHOTOS_BUCKET, [{
					Key: event.query.key
				}]);

				for (var i = 0; i < data.Contents.length; i++) {
					if (data.Contents[i].Key.indexOf(event.query.key.replace(/\./g,"")) == 0)
						objectKey.push({
							Key: data.Contents[i].Key
						});
				}

			} else if (event.query.type === 'STYLE') {

				var del = delObject.sync(null, STYLE_PHOTOS_BUCKET, [{
					Key: event.query.key
				}]);

				for (var i = 0; i < data.Contents.length; i++) {
					if (data.Contents[i].Key.indexOf(event.query.key.replace(/\./g,"")) > 0)
						objectKey.push({
							Key: data.Contents[i].Key
						});
				}

			} else{
				
				callback(new Error('[400] Delete photo type not support'));
			}

			if (objectKey.length > 0){

				var outputDel = delObject.sync(null, OUTPUT_PHOTOS_BUCKET, objectKey);	
			}
			
			callback(null, {
				del,
				outputDel
			});
		} catch (err) {
			callback(new Error('[500] Delete photo error: ' + err));
		}
	});
}

function runGPU(event, context, callback) {
	if (event.body.key) {
		const payload = {
			"Records": [{
				"s3": {
					"object": {
						"key": event.body.key
					}
				}
			}]
		};
		lambda.invoke({
			FunctionName: RUN_GPU_FUNCTION,
			Payload: JSON.stringify(payload)
		}, function(err, data) {
			if (err)
				callback(new Error('[500] Run GPU error: ' + err));
			else
				callback(null, data);
		});
	} else {
		callback(new Error('[400] Invalid photo object key.'));
	}
}

function listGPUTask(event, context, callback) {
	var ssmProgressParams = {
		InstanceId: gpuInstance,
		Filters: [{
			key: 'Status',
			value: 'InProgress'
		}]
	};

	var ssmPendingParams = {
		InstanceId: gpuInstance,
		Filters: [{
			key: 'Status',
			value: 'Pending'
		}]
	};

	Sync(function() {

		try {
			const progressCmd = descSSMCommand.sync(null, ssmProgressParams);
			const pendingCmd = descSSMCommand.sync(null, ssmPendingParams);
			if (pendingCmd.CommandInvocations.length > 0 || progressCmd.CommandInvocations.length > 0) {
				callback(null, {
					inProcess: true
				});
			} else {
				callback(null, {
					inProcess: false
				});
			}
		} catch (err) {
			callback(new Error('[500] List GPU Task error: ' + err));
		}

	});

}

module.exports.signup = signup;
module.exports.login = login;
module.exports.isAuthenticated = isAuthenticated;
module.exports.feed = feed;
module.exports.media = media;
module.exports.uploadUrl = uploadUrl;
module.exports.runGPU = runGPU;
module.exports.listGPUTask = listGPUTask;
module.exports.delUpload = delUpload;