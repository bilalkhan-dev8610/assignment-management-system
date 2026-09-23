const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { validateRegister, validateLogin } = require('../utils/validators');
const authService = require('../services/auth.service');

const hasErrors = (errors) => Object.keys(errors).length > 0;

const register = asyncHandler(async (req, res) => {
  const { errors, value } = validateRegister(req.body);
  if (hasErrors(errors)) throw new AppError(400, 'Validation failed', errors);

  const user = await authService.register(value);
  res.status(201).json({ success: true, message: 'Account created successfully', data: { user } });
});

const login = asyncHandler(async (req, res) => {
  const { errors, value } = validateLogin(req.body);
  if (hasErrors(errors)) throw new AppError(400, 'Validation failed', errors);

  const { token, user } = await authService.login(value);
  res.json({ success: true, message: 'Login successful', data: { token, user } });
});

// Returns the user behind the token; also proves authenticate works end to end.
const me = asyncHandler(async (req, res) => {
  const user = await authService.getProfile(req.user.id);
  res.json({ success: true, data: { user } });
});

module.exports = { register, login, me };
