'use strict';

const AWS = require('aws-sdk');
var ec2 = new AWS.EC2();
var ssm = new AWS.SSM();

const gpuInstance = 'i-606b8aee';

var ec2Params = {
	InstanceIds: [
		gpuInstance
	]
};

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

const Sync = require('sync');

function descInstances(params, cb) {
	ec2.describeInstances(params, function(err, data) {
		if (err)
			cb(err);
		else {
			cb(null, data);
		}
	});
}

function stopInstances(params, cb) {
	ec2.stopInstances(params, function(err, data) {
		if (err)
			cb(err);
		else {
			cb(null, data);
		}
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

module.exports.run = function(event, context, callback) {
	var message = {};

	Sync(function() {
		try {
			const descData = descInstances.sync(null, ec2Params);
			const status = descData.Reservations[0].Instances[0].State.Code;
			const now = new Date();
			const launchTime = now - descData.Reservations[0].Instances[0].LaunchTime;

			if (status && status === 16 && launchTime > 30 * 60 * 1000) {
				const progressCmd = descSSMCommand.sync(null, ssmProgressParams);
				const pendingCmd = descSSMCommand.sync(null, ssmPendingParams);
				console.log(progressCmd);
				if (pendingCmd.CommandInvocations.length > 0 || progressCmd.CommandInvocations.length > 0) {
					message = {
						message: 'Instance i-606b8aee are running command this time!',
						pendingCmd,
						progressCmd
					};
					console.info(message);
				} else {
					const stopData = stopInstances.sync(null, ec2Params);
					message = {
						message: 'Stop Instance i-606b8aee Success',
						stopData,
						launchTime: launchTime
					};
					console.info(message);
				}

			} else {
				message = {
					message: 'Instance i-606b8aee not running or not enought running time',
					descData
				};
				console.info(message);
			}
		} catch (e) {
			message = {
				message: 'Some request errors',
				e
			};
			console.error(message);
		}

		callback(null, message);

	});
};