import { successResponse } from '../utils/responses.js';
import {
  getUserProfile,
  updateUserProfile,
  changePassword,
  deactivateAccount,
} from '../services/userService.js';
import logger from '../utils/logger.js';

/**
 * GET /me
 */
export const getMeController = async (req, res, next) => {
  try {
    const user = await getUserProfile(req.user.id);

    return res.status(200).json(successResponse(user));
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /me
 */
export const updateMeController = async (req, res, next) => {
  try {
    const user = await updateUserProfile(
      req.user.id,
      req.body,
      req.ip,
      req.get('user-agent')
    );

    return res.status(200).json(
      successResponse(user, {
        message: 'Profile updated successfully',
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * POST /me/change-password
 */
export const changePasswordController = async (req, res, next) => {
  try {
    const result = await changePassword(
      req.user.id,
      req.body,
      req.ip,
      req.get('user-agent')
    );

    return res.status(200).json(
      successResponse(null, {
        message: result.message,
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * POST /me/deactivate
 */
export const deactivateAccountController = async (req, res, next) => {
  try {
    const result = await deactivateAccount(
      req.user.id,
      req.ip,
      req.get('user-agent')
    );

    return res.status(200).json(
      successResponse(null, {
        message: result.message,
      })
    );
  } catch (error) {
    next(error);
  }
};
