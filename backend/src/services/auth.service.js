const bcrypt = require('bcryptjs');
const AppError = require('../utils/AppError');
const { signToken } = require('../utils/token');
const userService = require('./user.service');

const SALT_ROUNDS = 10;
const UNIQUE_VIOLATION = '23505'; // PostgreSQL error code

async function register({ name, email, password, role }) {
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  try {
    return await userService.createUser({ name, email, passwordHash, role });
  } catch (err) {
    // The UNIQUE constraint on users.email is the source of truth, so two
    // simultaneous sign-ups with one email cannot both succeed.
    if (err.code === UNIQUE_VIOLATION) {
      throw new AppError(409, 'An account with this email already exists', {
        email: 'This email is already registered',
      });
    }
    throw err;
  }
}

async function login({ email, password }) {
  const user = await userService.findByEmail(email);
  const passwordMatches = user ? await bcrypt.compare(password, user.password) : false;

  // Same message for "no such user" and "wrong password" so emails cannot be probed.
  if (!passwordMatches) {
    throw new AppError(401, 'Invalid email or password');
  }

  const { password: _passwordHash, ...publicUser } = user;
  return { token: signToken(user), user: publicUser };
}

async function getProfile(userId) {
  const user = await userService.findById(userId);
  if (!user) {
    throw new AppError(401, 'Account no longer exists');
  }
  return user;
}

module.exports = { register, login, getProfile };
