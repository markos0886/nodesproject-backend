const jwt = require('jsonwebtoken');
const shortid = require('shortid');
const moment = require('moment');
const farmhash = require('farmhash');
const _ = require('lodash');

const API_ERRORS = require('../constants/APIErrors');

const LOCK_INTERVAL_SEC = 120;
const LOCK_TRY_COUNT = 5;

function doesUsernameExist(email) {
	return new Promise((resolve, reject) => {
		User
			.findOne({ email: email })
			.exec((err, user) => {
				if (err) return reject(err);
				return resolve(!!user);
			});
	});
}

function updateUserLockState(user, done) {
	const now = moment().utc();

	let prevFailure = null;
	if (user.lastPasswordFailure && user.lastPasswordFailure !== '') {
		prevFailure = moment(user.lastPasswordFailure);
	}

	if (prevFailure !== null && now.diff(prevFailure, 'seconds') < LOCK_INTERVAL_SEC) {
		user.passwordFailures += 1;

		// lock if this is the 4th incorrect attempt
		if (user.passwordFailures >= LOCK_TRY_COUNT) {
			user.locked = true;
		}
	}
	else {
		// reset the failed attempts
		user.passwordFailures = 1;
	}

	user.lastPasswordFailure = now.toDate();
	User.update({ email: user.email }).set(user).then(user => {
		done();
	});
}

module.exports = {

	/**
	 * Creates a new user
	 * @param values
	 * @returns {Promise}
	 */
	createUser: (values) => {
		const email = values.email;

		return new Promise((resolve, reject) => {
			doesUsernameExist(email)
				.then(async (exists) => {
					if (exists) {
						return reject(API_ERRORS.EMAIL_IN_USE);
					}
					var createdUser = await User.create(values).fetch();

					UserManager._generateUserToken(createdUser, token => {
						resolve(token);
						EmailService.sendWelcome(email);
					});
				})
				.catch(reject);
		});
	},


	/**
	 * Generates JWT token
	 * TODO Promisify
	 * @param user
	 * @param done
	 * @returns {*}
	 * @private
	 */
	_generateUserToken: function (user, done) {

		// Password hash helps to invalidate token when password is changed
		const passwordHash = farmhash.hash32(user.encryptedPassword);

		const payload = {
			id: user.id,
			pwh: passwordHash
		};

		const token = jwt.sign(
			payload,
			sails.config.jwt.secretKey,
			{
				issuer: sails.config.jwt.issuer,
				algorithm: sails.config.jwt.algorithm,
				expiresIn: sails.config.jwt.expiresIn
			}
		);
		return done(token);
	},


	/**
	 * Authenticates user by a JWT token.
	 *
	 * Uses in JWT Policy
	 * @see api/policies/jwtAuth.js
	 *
	 * @param token
	 * @returns {Promise}
	 */
	authenticateUserByToken: function (token) {
		return new Promise((resolve, reject) => {
			jwt.verify(token, sails.config.jwt.secretKey, {}, (err, tokenData) => {
				if (err) return reject(err); // JWT parse error

				User
					.findOne({ id: tokenData.id })
					.exec((err, user) => {
						if (err) return reject(err); // Query error
						if (!user) return reject(API_ERRORS.USER_NOT_FOUND);
						if (user.locked) return reject(API_ERRORS.USER_LOCKED);

						const passwordHash = farmhash.hash32(user.encryptedPassword);
						if (tokenData.pwh !== passwordHash) { // Old token, built with inactive password
							return reject(API_ERRORS.INACTIVE_TOKEN);
						}
						return resolve(user);
					});
			});
		});
	},


	/**
	 * Validates user password
	 * @param email
	 * @param password
	 * @returns {Promise}
	 */
	validatePassword(email, password) {
		return new Promise(async (resolve, reject) => {
			var user = await User.findOne({ email: email });
			/*if (err) return reject(err);*/
			if (!user) return reject(API_ERRORS.USER_NOT_FOUND);
			if (user.locked) return reject(API_ERRORS.USER_LOCKED);

			Utils.validatePassword(password, user)
				.then(isValid => {
					resolve({ isValid, user });
				})
				.catch(reject);
		});
	},


	/**
	 * Validates user api key
	 * @param apiKey
	 * @returns {Promise}
	 */
	validateApiKey(apiKey) {
		return new Promise(async (resolve, reject) => {
			var user = await User.findOne({ apiKey: apiKey });
			/*if (err) return reject(err);*/
			if (!user) return reject(API_ERRORS.USER_NOT_FOUND);
			if (user.locked) return reject(API_ERRORS.USER_LOCKED);
			var isValid = true; 
			resolve({ isValid, user });
		});
	},


	/**
	 * Authenticates user by email and password.
	 * @param email
	 * @param password
	 * @returns {Promise}
	 */
	authenticateUserByPassword: function (email, password) {
		return new Promise((resolve, reject) => {
			UserManager
				.validatePassword(email, password)
				.then(({ isValid, user }) => {
					if (!isValid) {
						updateUserLockState(user, saveErr => {
							if (saveErr) return reject(saveErr);
						});
						return reject(API_ERRORS.INVALID_EMAIL_PASSWORD);
					}
					else {
						UserManager._generateUserToken(user, token => {
							resolve(token);
						});
					}
				})
				.catch(reject);
		});
	},

	/**
	 * Authenticates user by email and password.
	 * @param email
	 * @param password
	 * @returns {Promise}
	 */
	authenticateUserByApiKey: function (apiKey) {
		return new Promise((resolve, reject) => {
			UserManager
				.validateApiKey(apiKey)
				.then(({ isValid, user }) => {
					if (!isValid) {
						return reject(API_ERRORS.INVALID_EMAIL_PASSWORD);
					}
					else {
						UserManager._generateUserToken(user, token => {
							resolve(token);
						});
					}
				})
				.catch(reject);
		});
	},


	/**
	 * Generates password reset token
	 * @param email
	 * @returns {Promise}
	 */
	generateResetToken: function (email) {
		return new Promise((resolve, reject) => {
			User
				.findOne({ email })
				.exec((err, user) => {
					if (err) return reject(err); // Query error
					if (!user) return reject(API_ERRORS.USER_NOT_FOUND);

					const resetToken = shortid.generate();
					user.resetToken = resetToken;
					User.update({ email: user.email }).set(user).then(user => {
						EmailService.sendResetToken(email, resetToken);
						resolve();
					}).catch(reject);
				});
		});
	},


	/**
	 * Changes password
	 * @param email
	 * @param currentPassword
	 * @param newPassword
	 * @returns {Promise}
	 */
	changePassword: function (email, currentPassword, newPassword) {
		return new Promise((resolve, reject) => {
			UserManager
				.validatePassword(email, currentPassword)
				.then(({ isValid, user }) => {
					if (!isValid) {
						return reject(API_ERRORS.INVALID_PASSWORD);
					}
					else {
						Utils.generatePasswordHash(newPassword).then(async hash => {
							user.encryptedPassword = hash;
							user.resetToken = '';
							user.passwordFailures = 0;
							user.lastPasswordFailure = '';
							var changedUser = await User.update({ email: user.email }).set(user).fetch();
							UserManager._generateUserToken(changedUser[0], token => {
								resolve(token);
							});

						}).catch(reject);

					}
				})
				.catch(reject);
		});
	},


	/**
	 * Resets password to a new one by reset token.
	 * @param email
	 * @param resetToken
	 * @param newPassword
	 * @returns {Promise}
	 */
	resetPasswordByResetToken: function (email, resetToken, newPassword) {
		return new Promise((resolve, reject) => {
			User
				.findOne({ email: email, resetToken: resetToken })
				.exec((err, user) => {
					if (err) return reject(err); // Query error
					if (!user) return reject(API_ERRORS.USER_NOT_FOUND);

					// TODO Check reset token validity
					Utils.generatePasswordHash(newPassword).then(async hash => {
						user.encryptedPassword = hash;
						user.resetToken = '';
						user.passwordFailures = 0;
						user.lastPasswordFailure = '';
						User.update({ email: user.email }).set(user).then(user => {
							resolve();
						}).catch(reject);
					}).catch(reject);
				});
		});
	}
};
