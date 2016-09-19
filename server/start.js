'use strict';

const AWS = require('aws-sdk');

const Sync = require('sync');

var ec2 = new AWS.EC2();
var cloudwatchevents = new AWS.CloudWatchEvents();
var ssm = new AWS.SSM();

const gpuInstance = 'i-606b8aee';
//const gpuInstance = 'i-02ff8d6926d54def2'; // test instance id

var ec2Params = {
	InstanceIds: [
		gpuInstance
	]
};

var eventParams = {
	Name: 'neutral-style-dev-StopGPUEventsRuleSchedule1-1WERG1W6W0Y94'
};

var ssmRunParams = {
	DocumentName: 'AWS-RunShellScript',
	InstanceIds: [
		gpuInstance
	]
};

var ssmDescInstParams = {
	"InstanceInformationFilterList": [{
		"key": "InstanceIds",
		"valueSet": [
			gpuInstance
		]
	}]
};

function descInstances(params, cb) {
	ec2.describeInstances(params, function(err, data) {
		if (err)
			cb(err);
		else {
			cb(null, data);
		}
	});
}

function startInstances(params, cb) {
	ec2.startInstances(params, function(err, data) {
		if (err)
			cb(err);
		else {
			cb(null, data);
		}
	});
}

function waitForRunning(params, cb) {
	ec2.waitFor('instanceRunning', params, function(err, data) {
		if (err)
			cb(err);
		else {
			cb(null, data);
		}
	});
}

function enableRule(params, cb) {
	cloudwatchevents.enableRule(params, function(err, data) {
		if (err)
			cb(err);
		else {
			cb(null, data);
		}
	});
}

function disableRule(params, cb) {
	cloudwatchevents.disableRule(params, function(err, data) {
		if (err)
			cb(err);
		else {
			cb(null, data);
		}
	});
}

function runNeutralStyleCommand(params, cb) {
	ssm.sendCommand(params, function(err, data) {
		if (err)
			cb(err);
		else {
			cb(null, data);
		}
	});
}

function ssmDescInstInfo(params, cb) {
	ssm.describeInstanceInformation(params, function(err, data) {
		if (err)
			cb(err);
		else {
			cb(null, data);
		}
	});
}

function sleep(time) {
	var now = new Date().getTime();
	while (new Date().getTime() < now + time) { /* do nothing */ }
}


module.exports.run = function(event, context, callback) {
	var message = {};

	Sync(function() {
		try {
			const descData = descInstances.sync(null, ec2Params);
			const instanceStatus = descData.Reservations[0].Instances[0].State.Code;


			if (instanceStatus && (instanceStatus === 80 || instanceStatus === 16)) {
				if (instanceStatus === 80) {
					startInstances.sync(null, ec2Params);

					waitForRunning.sync(null, ec2Params);
					disableRule.sync(null, eventParams);
				}

				var ssmInstanceStatus = true;
				console.log("Begin waiting...");
				while (ssmInstanceStatus) {
					sleep(1000);
					var ssmInstInfo = ssmDescInstInfo.sync(null, ssmDescInstParams);
					console.log(ssmInstInfo);
					if (ssmInstInfo.InstanceInformationList[0] && ssmInstInfo.InstanceInformationList[0].PingStatus)
						ssmInstanceStatus = ssmInstInfo.InstanceInformationList[0].PingStatus !== 'Online';

				}
				console.log("End waiting...");

				ssmRunParams.Parameters = {
					commands: ['/root/run-neutral-style.sh ' + event.Records[0].s3.object.key]
				};

				const commandData = runNeutralStyleCommand.sync(null, ssmRunParams);
				enableRule.sync(null, eventParams);

				message = {
					message: 'Run command successful',
					commandData
				};

				console.info(message);


			} else {
				message = {
					message: 'Describe Instance i-606b8aee not in a right status',
					descData
				};

				console.info(message);
			}

		} catch (e) {
			message = {
				message: 'Some Request errors',
				e
			};

			console.error(message);
		}

		callback(null, message);

	});
};