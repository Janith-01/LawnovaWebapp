import { successResponse } from '../utils/responses.js';
import {
  getUserProfile,
  updateUserProfile,
  changePassword,
  deactivateAccount,
} from '../services/userService.js';
import User from '../models/User.js';
import MasteryTracker from '../models/MasteryTracker.js';
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

/**
 * GET /users/search
 * Search for users by name or email
 * Query params: q (search query), type (student/faculty/all), limit
 */
export const searchUsers = async (req, res, next) => {
  try {
    const { q = '', type = 'all', limit = 20 } = req.query;
    const currentUserId = req.headers['user-id'] || req.user?.id;

    // Build search query
    const searchQuery = {
      isActive: true,
    };

    // Exclude current user from results
    if (currentUserId) {
      searchQuery._id = { $ne: currentUserId };
    }

    // Add text search
    if (q && q.length >= 2) {
      searchQuery.$or = [
        { fullName: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
        { 'profile.department': { $regex: q, $options: 'i' } },
      ];
    }

    // Filter by role type
    if (type === 'student') {
      searchQuery.role = 'student';
    } else if (type === 'faculty') {
      searchQuery.role = { $in: ['admin', 'faculty'] };
    }

    const users = await User.find(searchQuery)
      .select('email fullName profile role mockTrialProfile')
      .limit(parseInt(limit))
      .sort({ fullName: 1 })
      .lean();

    // Transform to directory format
    const directory = users.map(user => ({
      id: user._id.toString(),
      name: user.fullName || user.email.split('@')[0],
      email: user.email,
      type: user.role === 'admin' || user.role === 'faculty' ? 'faculty' : 'student',
      department: user.profile?.department || 'General Law',
      avatar: (user.fullName?.[0] || user.email[0]).toUpperCase(),
    }));

    return res.status(200).json(successResponse({ users: directory }));
  } catch (error) {
    next(error);
  }
};

// ============================================
// MOCK TRIAL INTEGRATION ENDPOINTS
// ============================================

/**
 * GET /users/:userId/profile
 * Get user profile by ID (for service-to-service communication)
 */
export const getUserProfileById = async (req, res, next) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId)
      .select('email fullName profile mockTrialProfile')
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    return res.status(200).json(successResponse({ user }));
  } catch (error) {
    next(error);
  }
};

/**
 * POST /users/by-emails
 * Get multiple users by their emails (for mock trial role assignment)
 * This is a service-to-service endpoint
 */
export const getUsersByEmails = async (req, res, next) => {
  try {
    const { emails } = req.body;

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'emails array is required'
      });
    }

    // Normalize emails to lowercase
    const normalizedEmails = emails.map(e => e.toLowerCase());

    const users = await User.find({
      email: { $in: normalizedEmails },
      isActive: true
    })
      .select('email fullName profile mockTrialProfile')
      .lean();

    // Create a map for quick lookup
    const userMap = new Map(users.map(u => [u.email.toLowerCase(), u]));

    // Return users in same order as input emails, with defaults for missing
    const result = normalizedEmails.map(email => {
      const user = userMap.get(email);
      if (user) {
        return user;
      }
      // Return default profile for non-registered users
      return {
        _id: null,
        email,
        fullName: email.split('@')[0],
        mockTrialProfile: {
          roleCounts: {
            judge: 0,
            defenseLawyer: 0,
            prosecutionLawyer: 0,
            juryForeman: 0,
            expertWitness: 0,
            eyewitness: 0,
            courtClerk: 0,
            bailiff: 0,
            courtReporter: 0,
            investigatingOfficer: 0,

            victim: 0,
            witness: 0,
            client: 0
          },
          performanceScore: 50,
          syllabusProgress: {
            crossExamination: 0,
            legalArgumentation: 0,
            caseAnalysis: 0,
            courtProcedure: 0,
            evidencePresentation: 0
          },
          totalTrialsParticipated: 0
        }
      };
    });

    return res.status(200).json(successResponse({ users: result }));
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /users/:userId/mock-trial-profile
 * Update user's mock trial profile (role history, performance, etc.)
 * This is a service-to-service endpoint
 */
export const updateMockTrialProfile = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { incrementRole, performanceScore, syllabusProgress, lastTrialDate } = req.body;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Initialize mockTrialProfile if it doesn't exist
    if (!user.mockTrialProfile) {
      user.mockTrialProfile = {
        roleCounts: {
          judge: 0,
          defenseLawyer: 0,
          prosecutionLawyer: 0,
          juryForeman: 0,
          expertWitness: 0,
          eyewitness: 0,
          courtClerk: 0,
          bailiff: 0,
          courtReporter: 0,
          investigatingOfficer: 0,

          victim: 0,
          witness: 0,
          client: 0
        },
        performanceScore: 50,
        syllabusProgress: {},
        totalTrialsParticipated: 0
      };
    }

    // Increment role count if specified
    if (incrementRole) {
      const roleKey = getRoleDbKey(incrementRole);
      if (roleKey && user.mockTrialProfile.roleCounts[roleKey] !== undefined) {
        user.mockTrialProfile.roleCounts[roleKey] += 1;
        user.mockTrialProfile.totalTrialsParticipated += 1;
        user.mockTrialProfile.lastRoleAssigned = incrementRole;
      }
    }

    // Update performance score if provided
    if (performanceScore !== undefined) {
      user.mockTrialProfile.performanceScore = Math.min(100, Math.max(0, performanceScore));
    }

    // Update syllabus progress if provided
    if (syllabusProgress) {
      Object.assign(user.mockTrialProfile.syllabusProgress, syllabusProgress);
    }

    // Update last trial date
    if (lastTrialDate) {
      user.mockTrialProfile.lastTrialDate = new Date(lastTrialDate);
    }

    await user.save();

    logger.info({ userId, incrementRole }, 'Mock trial profile updated');

    return res.status(200).json(
      successResponse({ mockTrialProfile: user.mockTrialProfile }, {
        message: 'Mock trial profile updated successfully'
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * POST /mastery-tracker
 * Save quiz results and update user syllabus mastery
 */
export const updateMasteryTrackerController = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const {
      roomId,
      topic,
      quizScore,
      totalQuestions,
      correctAnswers,
      answers
    } = req.body;

    // 1. Save detailed attempt to history
    const trackerEntry = new MasteryTracker({
      userId,
      roomId,
      topic: topic || 'Mock Trial',
      quizScore,
      totalQuestions,
      correctAnswers,
      answers,
      completedAt: new Date()
    });
    await trackerEntry.save();

    // 2. Update user's aggregate performance and syllabus progress
    const user = await User.findById(userId);
    if (user && user.mockTrialProfile) {
      // Smoothly update performance score (moving average)
      const currentScore = user.mockTrialProfile.performanceScore || 50;
      user.mockTrialProfile.performanceScore = Math.round((currentScore + quizScore) / 2);

      // Update relevant syllabus areas based on mock trial quiz
      // In a real RAG system, the topic would map to specific areas
      const increment = quizScore >= 70 ? 5 : 2; // Quality bonus

      const progress = user.mockTrialProfile.syllabusProgress || {};
      progress.courtProcedure = Math.min(100, (progress.courtProcedure || 0) + increment);
      progress.legalArgumentation = Math.min(100, (progress.legalArgumentation || 0) + (quizScore / 10));

      user.mockTrialProfile.syllabusProgress = progress;
      user.markModified('mockTrialProfile.syllabusProgress');

      await user.save();
    }

    logger.info({ userId, roomId, quizScore }, 'Mastery tracker updated with quiz results');

    return res.status(200).json(successResponse({
      masteryId: trackerEntry._id,
      newPerformanceScore: user?.mockTrialProfile?.performanceScore
    }, {
      message: 'Learning progress synchronized successfully'
    }));
  } catch (error) {
    next(error);
  }
};

/**
 * Helper: Convert role name to database key
 */
function getRoleDbKey(role) {
  const mapping = {
    'Judge': 'judge',
    'Defense Lawyer': 'defenseLawyer',
    'Prosecution Lawyer': 'prosecutionLawyer',
    'Jury Foreman': 'juryForeman',
    'Expert Witness': 'expertWitness',
    'Eyewitness': 'eyewitness',
    'Court Clerk': 'courtClerk',
    'Bailiff': 'bailiff',
    'Court Reporter': 'courtReporter',
    'Investigating Officer': 'investigatingOfficer',

    'Victim': 'victim',
    'Witness': 'witness',
    'Client': 'client'
  };
  return mapping[role] || null;
}
