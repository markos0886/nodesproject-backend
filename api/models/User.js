/**
 * User.js
 *
 * @description :: User model
 * @docs        :: http://sailsjs.org/documentation/concepts/models-and-orm/models
 */

const uuid = require('uuid');

module.exports = {

	attributes: {
		email: {
			type: 'string',
			required: true,
			unique: true
		},
		/*
				encryptedPassword: {
					type: 'string'
				},*/

		role: {
			type: 'string',
			defaultsTo: 'user'
		},

		locked: {
			type: 'boolean',
			defaultsTo: false
		},

		passwordFailures: {
			type: 'number',
			defaultsTo: 0
		},

		lastPasswordFailure: {
			type: 'ref',
			columnType: 'datetime'
		},

		resetToken: {
			type: 'string'
		},

		apiKey: {
			type: 'string',
			unique: true
		},

	},

	/**
	 * Encrypt password before creating a User
	 * @param values
	 * @param next
	 */
	beforeCreate: function (values, next) {
		values.apiKey = uuid.v4();
		Utils.generatePasswordHash(values.password)
			.then(hash => {
				delete (values.password);
				values.encryptedPassword = hash;
				next();
			})
			.catch(err => {
				/* istanbul ignore next */
				next(err);
			});
	}
};

