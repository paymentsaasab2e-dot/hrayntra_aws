import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export const signToken = (payload, secret = env.JWT_ACCESS_SECRET || env.JWT_SECRET, expiresIn = env.JWT_ACCESS_EXPIRES || env.JWT_EXPIRES_IN) => {
  return jwt.sign(payload, secret, { expiresIn });
};

export const verifyToken = (token, secret = env.JWT_ACCESS_SECRET || env.JWT_SECRET) => {
  try {
    return jwt.verify(token, secret);
  } catch (error) {
    return null;
  }
};

export const signRefreshToken = (payload) => {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET || env.REFRESH_TOKEN_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES || env.REFRESH_TOKEN_EXPIRES_IN,
  });
};

export const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, env.JWT_REFRESH_SECRET || env.REFRESH_TOKEN_SECRET);
  } catch (error) {
    return null;
  }
};
