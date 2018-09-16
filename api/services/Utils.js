
const bcrypt = require('bcrypt');

/**
 * Utils
 * @type {object}
 */
module.exports = {

	/**
	 * Returns an object with error field for response
	 * @param errorMessage {string}
	 * @returns {{err_msg: {string}}}
	 */
	jsonErr(errorMessage) {
		return {
			err_msg: errorMessage
		};
	},


	generatePasswordHash(password) {
		return bcrypt.genSalt(10) // 10 is default
			.then((salt) => {
				return bcrypt.hash(password, salt);
			})
			.then(hash => {
				return Promise.resolve(hash);
			});
	},

	/**
	 * Validates user password with stored password hash
	 * @param password
	 * @param user
	 * @returns {Promise}
	 */
	validatePassword(password, user) {
		return bcrypt.compare(password, user.encryptedPassword);
	},
};
