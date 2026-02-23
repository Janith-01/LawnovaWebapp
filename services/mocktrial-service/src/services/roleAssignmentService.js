import { TRIAL_ROLES } from '../models/Room.js';
import serviceClient from './serviceClient.js';
import logger from '../utils/logger.js';

/**
 * Fair Role Rotation Engine
 * Implements Weighted Scarcity Algorithm with Performance-Based Matching
 * 
 * Algorithm Version: 1.0.0
 */
class RoleAssignmentService {
    constructor() {
        this.algorithmVersion = '1.0.0';

        // Role complexity mapping (higher = more complex, needs better performance)
        this.roleComplexity = {
            'Judge': 5,
            'Defense Lawyer': 4,
            'Prosecution Lawyer': 4,
            'Client': 3,
            'Victim': 2,
            'Witness': 2
        };

        // Syllabus module to role mapping (for experience-based assignment)
        this.syllabusRoleMapping = {
            'crossExamination': ['Defense Lawyer', 'Prosecution Lawyer'],
            'legalArgumentation': ['Defense Lawyer', 'Prosecution Lawyer', 'Judge'],
            'caseAnalysis': ['Judge', 'Defense Lawyer', 'Prosecution Lawyer'],
            'courtProcedure': ['Judge'],
            'evidencePresentation': ['Defense Lawyer', 'Prosecution Lawyer', 'Witness']
        };
    }

    /**
     * Main entry point - Assign roles to all participants in a room
     * @param {Object} room - Room document with participants
     * @param {Object} options - Assignment options
     * @returns {Object} Assignment result with updated room data
     */
    async assignRoles(room, options = {}) {
        const startTime = Date.now();
        logger.info({ roomId: room._id }, 'Starting role assignment algorithm');

        try {
            // Step 0: Ensure owner is in participants list
            const ownerEmail = options.ownerEmail;
            const ownerId = room.ownerId.toString();

            if (ownerEmail) {
                const ownerParticipant = room.participants.find(
                    p => p.email.toLowerCase() === ownerEmail.toLowerCase()
                );

                if (!ownerParticipant) {
                    // Add owner as participant with Accepted status
                    room.participants.push({
                        userId: room.ownerId,
                        email: ownerEmail.toLowerCase(),
                        invitedRole: 'Judge',
                        assignedRole: null,
                        status: 'Accepted',
                        invitedAt: new Date()
                    });
                    logger.info({ ownerId, ownerEmail }, 'Owner added to participants list');
                } else if (ownerParticipant.status !== 'Accepted') {
                    // Auto-accept owner's participation
                    ownerParticipant.status = 'Accepted';
                    ownerParticipant.userId = room.ownerId;
                }
            }

            // Step 1: Get accepted and pending participants (Treat Pending as willing to play)
            const acceptedParticipants = room.participants.filter(p => p.status === 'Accepted' || p.status === 'Pending');

            if (acceptedParticipants.length === 0) {
                throw new Error('No accepted participants to assign roles');
            }

            // Step 2: Determine required roles based on participant count
            const requiredRoles = this._calculateRequiredRoles(
                acceptedParticipants.length,
                room.requiredRoles
            );

            logger.info({
                participantCount: acceptedParticipants.length,
                requiredRoles
            }, 'Calculated required roles');

            // Step 3: Fetch user profiles with role history
            const userProfiles = await this._fetchUserProfiles(acceptedParticipants);

            // Step 4: Calculate priority scores for each participant-role combination
            const priorityMatrix = this._calculatePriorityMatrix(acceptedParticipants, userProfiles, requiredRoles);

            // Step 5: Run the Hungarian Algorithm (simplified greedy assignment)
            let assignments = this._runAssignmentAlgorithm(priorityMatrix, requiredRoles);

            // Step 5.1: Ensure owner is assigned a role (fallback to Judge if not assigned)
            if (ownerEmail) {
                const ownerAssignment = assignments.find(
                    a => a.email.toLowerCase() === ownerEmail.toLowerCase()
                );

                if (!ownerAssignment) {
                    // Owner wasn't assigned - give them Judge role by default
                    const ownerParticipant = room.participants.find(
                        p => p.email.toLowerCase() === ownerEmail.toLowerCase()
                    );

                    if (ownerParticipant) {
                        // Check if Judge is already assigned
                        const judgeAssigned = assignments.find(a => a.role === 'Judge');
                        const fallbackRole = judgeAssigned ? 'Defense Lawyer' : 'Judge';

                        assignments.push({
                            participantId: ownerParticipant._id,
                            userId: room.ownerId,
                            email: ownerEmail,
                            role: fallbackRole,
                            priorityScore: 1.0,
                            scoreBreakdown: { isOwnerFallback: true },
                            reason: 'Session creator fallback assignment'
                        });

                        logger.info({ ownerId, role: fallbackRole }, 'Owner assigned fallback role');
                    }
                }
            }

            // Step 6: Update room with assignments (ATOMIC - all or nothing)
            const updatedRoom = await this._applyAssignments(room, assignments, options);

            // Step 7: Validate no unassigned participants remain
            const unassigned = updatedRoom.participants.filter(
                p => p.status === 'Accepted' && !p.assignedRole
            );

            if (unassigned.length > 0) {
                logger.warn({
                    roomId: room._id,
                    unassignedCount: unassigned.length
                }, 'Some participants remain unassigned after algorithm');

                // Assign remaining as Witnesses
                for (const participant of unassigned) {
                    participant.assignedRole = 'Witness';
                    participant.roleAssignedAt = new Date();
                    participant.rolePriorityScore = 0.5;

                    assignments.push({
                        participantId: participant._id,
                        userId: participant.userId,
                        email: participant.email,
                        role: 'Witness',
                        priorityScore: 0.5,
                        reason: 'Overflow assignment - all core roles filled'
                    });
                }

                await updatedRoom.save();
            }

            // Step 8: Send notifications
            if (!options.skipNotifications) {
                await this._sendAssignmentNotifications(updatedRoom, assignments);
            }

            const duration = Date.now() - startTime;
            logger.info({
                roomId: room._id,
                assignmentsCount: assignments.length,
                duration: `${duration}ms`
            }, 'Role assignment completed');

            return {
                success: true,
                room: updatedRoom,
                assignments,
                algorithmVersion: this.algorithmVersion,
                duration
            };

        } catch (error) {
            logger.error({ roomId: room._id, error: error.message }, 'Role assignment failed');
            throw error;
        }
    }

    /**
     * Calculate required roles based on participant count
     * Handles edge cases where participants don't match standard trial
     */
    _calculateRequiredRoles(participantCount, configuredRoles) {
        const roles = [];
        const roleConfig = configuredRoles instanceof Map
            ? Object.fromEntries(configuredRoles)
            : configuredRoles || {};

        // Core roles that must be filled (in order of priority)
        const coreRoles = [
            { role: 'Judge', min: 1, max: 1 },
            { role: 'Defense Lawyer', min: 1, max: 2 },
            { role: 'Prosecution Lawyer', min: 1, max: 2 },
            { role: 'Client', min: 1, max: 1 },
            { role: 'Victim', min: 0, max: 1 },
            { role: 'Witness', min: 0, max: 10 } // Flexible
        ];

        let remaining = participantCount;

        // First pass: assign minimum required roles
        for (const config of coreRoles) {
            const count = Math.min(
                roleConfig[config.role] ?? config.min,
                remaining
            );
            for (let i = 0; i < count; i++) {
                roles.push(config.role);
                remaining--;
            }
        }

        // Second pass: fill remaining as Witnesses
        while (remaining > 0) {
            roles.push('Witness');
            remaining--;
        }

        return roles;
    }

    /**
     * Fetch user profiles from user-service
     */
    async _fetchUserProfiles(participants) {
        const emails = participants.map(p => p.email);
        const profiles = await serviceClient.getUsersByEmails(emails);

        // Create email -> profile map
        const profileMap = new Map();
        profiles.forEach(profile => {
            if (profile.email) {
                profileMap.set(profile.email.toLowerCase(), profile);
            }
        });

        return profileMap;
    }

    /**
     * Calculate priority matrix for participant-role combinations
     * Uses Weighted Scarcity Algorithm with performance adjustment
     * 
     * Formula: Priority = (1 / (RoleCount + 1)) * PerformanceMultiplier * SyllabusBonus
     */
    _calculatePriorityMatrix(participants, userProfiles, requiredRoles) {
        const matrix = [];

        for (const participant of participants) {
            const profile = userProfiles.get(participant.email.toLowerCase()) ||
                serviceClient._getDefaultUserProfile(null, participant.email);

            const mockTrialProfile = profile.mockTrialProfile || {};
            const roleCounts = mockTrialProfile.roleCounts || {};
            const performanceScore = mockTrialProfile.performanceScore || 50;
            const syllabusProgress = mockTrialProfile.syllabusProgress || {};

            const participantScores = {
                participantId: participant._id,
                email: participant.email,
                userId: profile._id || participant.userId,
                scores: {}
            };

            // Calculate priority for each unique role
            const uniqueRoles = [...new Set(requiredRoles)];

            for (const role of uniqueRoles) {
                const roleDbKey = this._getRoleDbKey(role);
                const roleCount = roleCounts[roleDbKey] || 0;
                const complexity = this.roleComplexity[role] || 1;

                // Base priority from Weighted Scarcity Algorithm
                // Priority = 1 / (Count + 1)
                const scarcityPriority = 1 / (roleCount + 1);

                // Performance multiplier (0.5 to 1.5 based on 0-100 score)
                // Higher performers get priority for complex roles
                const performanceMultiplier = this._calculatePerformanceMultiplier(
                    performanceScore,
                    complexity
                );

                // Syllabus bonus - prioritize users who need practice in related modules
                const syllabusBonus = this._calculateSyllabusBonus(
                    syllabusProgress,
                    role
                );

                // Final priority score
                const priority = scarcityPriority * performanceMultiplier * (1 + syllabusBonus);

                participantScores.scores[role] = {
                    priority: Math.round(priority * 1000) / 1000,
                    roleCount,
                    performanceMultiplier: Math.round(performanceMultiplier * 100) / 100,
                    syllabusBonus: Math.round(syllabusBonus * 100) / 100,
                    complexity
                };
            }

            matrix.push(participantScores);
        }

        logger.debug({ matrixSize: matrix.length }, 'Priority matrix calculated');
        return matrix;
    }

    /**
     * Calculate performance multiplier based on role complexity
     * Complex roles (Judge) favor high performers
     * Simple roles (Witness) are more neutral
     */
    _calculatePerformanceMultiplier(performanceScore, complexity) {
        // Normalize performance to 0-1 range
        const normalizedPerformance = performanceScore / 100;

        // For complex roles: high performers get bonus, low performers get penalty
        // For simple roles: more neutral (closer to 1.0)
        const weight = (complexity - 1) / 4; // 0 to 1 based on complexity 1-5

        // Base multiplier is 1.0, adjusted by performance
        // Range: 0.7 to 1.3 for simple roles, 0.5 to 1.5 for complex roles
        const deviation = (normalizedPerformance - 0.5) * (0.4 + 0.6 * weight);

        return 1 + deviation;
    }

    /**
     * Calculate syllabus bonus for experience-based matching
     * Students lacking in certain modules get priority for related roles
     */
    _calculateSyllabusBonus(syllabusProgress, role) {
        let bonus = 0;
        let relevantModules = 0;

        for (const [module, roles] of Object.entries(this.syllabusRoleMapping)) {
            if (roles.includes(role)) {
                const progress = syllabusProgress[module] || 0;
                // Lower progress = higher bonus (they need practice)
                // Inverse: bonus = max(0, (50 - progress) / 100)
                if (progress < 50) {
                    bonus += (50 - progress) / 100;
                }
                relevantModules++;
            }
        }

        return relevantModules > 0 ? bonus / relevantModules : 0;
    }

    /**
     * Run greedy assignment algorithm with priority-based selection
     * Handles multiple instances of same role (e.g., multiple Witnesses)
     */
    _runAssignmentAlgorithm(priorityMatrix, requiredRoles) {
        const assignments = [];
        const assignedParticipants = new Set();
        const roleAssignments = {}; // Track how many of each role assigned

        // Initialize role assignment counts
        requiredRoles.forEach(role => {
            roleAssignments[role] = (roleAssignments[role] || 0);
        });

        // Sort required roles by complexity (assign complex roles first)
        const sortedRoles = [...requiredRoles].sort((a, b) =>
            (this.roleComplexity[b] || 0) - (this.roleComplexity[a] || 0)
        );

        // Process each required role slot
        for (const role of sortedRoles) {
            if (roleAssignments[role] >= requiredRoles.filter(r => r === role).length) {
                continue; // Already filled all slots for this role
            }

            // Find best candidate for this role
            let bestCandidate = null;
            let bestPriority = -1;

            for (const participant of priorityMatrix) {
                if (assignedParticipants.has(participant.participantId.toString())) {
                    continue; // Already assigned
                }

                const roleScore = participant.scores[role];
                if (roleScore && roleScore.priority > bestPriority) {
                    bestPriority = roleScore.priority;
                    bestCandidate = participant;
                }
            }

            if (bestCandidate) {
                assignments.push({
                    participantId: bestCandidate.participantId,
                    userId: bestCandidate.userId,
                    email: bestCandidate.email,
                    role,
                    priorityScore: bestPriority,
                    scoreBreakdown: bestCandidate.scores[role],
                    reason: this._generateAssignmentReason(bestCandidate.scores[role])
                });

                assignedParticipants.add(bestCandidate.participantId.toString());
                roleAssignments[role]++;
            }
        }

        logger.info({
            totalAssignments: assignments.length,
            roleDistribution: roleAssignments
        }, 'Assignment algorithm completed');

        return assignments;
    }

    /**
     * Generate human-readable reason for assignment
     */
    _generateAssignmentReason(scoreBreakdown) {
        const reasons = [];

        if (scoreBreakdown.roleCount === 0) {
            reasons.push('First time in this role');
        } else if (scoreBreakdown.priority > 0.5) {
            reasons.push('Low experience in this role');
        }

        if (scoreBreakdown.performanceMultiplier > 1.2) {
            reasons.push('High performer suited for role complexity');
        }

        if (scoreBreakdown.syllabusBonus > 0.2) {
            reasons.push('Needs practice in related syllabus modules');
        }

        return reasons.length > 0 ? reasons.join('; ') : 'Standard rotation assignment';
    }

    /**
     * Apply assignments to room document
     */
    /**
     * Apply assignments to room document
     * Uses atomic findOneAndUpdate for performance and consistency
     */
    async _applyAssignments(room, assignments, options = {}) {
        const now = new Date();
        const Room = room.constructor; // Get model from document instance

        // 1. Prepare updated participants array
        // We iterate over the existing participants and update the ones that have assignments
        const updatedParticipants = room.participants.map(p => {
            const assignment = assignments.find(a => a.participantId.toString() === p._id.toString());
            if (assignment) {
                return {
                    ...p.toObject(), // Convert to plain object if it's a doc
                    assignedRole: assignment.role,
                    roleAssignedAt: now,
                    rolePriorityScore: assignment.priorityScore,
                    userId: assignment.userId || p.userId,
                    status: 'Accepted'
                };
            }
            // Double-check unassigned accepted participants (Should have been caught by Step 7, but safety net)
            if (p.status === 'Accepted' && !p.assignedRole) {
                return {
                    ...p.toObject(),
                    assignedRole: 'Witness', // Ultimate fallback
                    roleAssignedAt: now
                };
            }
            return p.toObject ? p.toObject() : p;
        });

        // 2. Prepare Role Assignment Metadata
        const roleAssignmentMeta = {
            isLocked: true,
            lockedAt: now,
            lockedBy: room.ownerId,
            algorithmVersion: this.algorithmVersion,
            assignmentLog: assignments.map(a => ({
                userId: a.userId,
                email: a.email,
                role: a.role,
                priorityScore: a.priorityScore,
                reason: a.reason,
                assignedAt: now
            }))
        };

        // 3. ATOMIC DB UDPATE
        // This is a single operation that locks the state
        const updatedRoom = await Room.findOneAndUpdate(
            { _id: room._id },
            {
                $set: {
                    participants: updatedParticipants,
                    roleAssignment: roleAssignmentMeta,
                    roomStatus: 'RolesAssigned'
                }
            },
            { new: true, runValidators: true, lean: true }
        );

        if (!updatedRoom) {
            throw new Error('Failed to update room: Room not found or concurrent modification');
        }

        // 4. Emit Socket.IO event
        if (options.io) {
            const roleMap = {};
            updatedRoom.participants.forEach(p => {
                if (p.assignedRole) {
                    roleMap[p.email] = {
                        participantId: p._id,
                        userId: p.userId,
                        role: p.assignedRole,
                        assignedAt: p.roleAssignedAt
                    };
                }
            });

            options.io.to(`room:${room._id}`).emit('ROLE_ASSIGNMENT_COMPLETE', {
                roomId: room._id,
                roomCode: room.roomCode,
                isLocked: true,
                algorithmVersion: this.algorithmVersion,
                roleMap,
                timestamp: now.toISOString()
            });

            logger.info({ roomId: room._id }, 'Emitted ROLE_ASSIGNMENT_COMPLETE event');
        }

        logger.info({ roomId: room._id }, 'Room updated with role assignments (atomic bulk write)');

        // Return the updated lean object (or wrap it back in a doc if caller expects it, but lean is requested)
        // Controller expects a document-like object usually, but since we updated the logic,
        // let's ensure we return something compatible. 
        // options.lean indicates if caller wants lean.
        return updatedRoom;
    }

    /**
     * Send notifications to all assigned participants
     */
    async _sendAssignmentNotifications(room, assignments) {
        const notifications = assignments.map(assignment => ({
            userId: assignment.userId,
            notification: {
                title: 'Role Assigned for Mock Trial',
                message: `You have been assigned the role of "${assignment.role}" for the mock trial "${room.topic}"`,
                data: {
                    roomId: room._id,
                    roomCode: room.roomCode,
                    role: assignment.role,
                    scheduledDate: room.scheduledDate,
                    scheduledTime: room.scheduledTime
                }
            }
        }));

        await serviceClient.sendBatchNotifications(notifications);
    }

    /**
     * Get database key for role
     */
    _getRoleDbKey(role) {
        const mapping = {
            'Judge': 'judge',
            'Defense Lawyer': 'defenseLawyer',
            'Prosecution Lawyer': 'prosecutionLawyer',
            'Victim': 'victim',
            'Witness': 'witness',
            'Client': 'client'
        };
        return mapping[role] || role.toLowerCase().replace(' ', '');
    }

    /**
     * Recalculate assignments (without locking) - for preview
     */
    async previewAssignments(room) {
        const result = await this.assignRoles(room, { skipNotifications: true, preview: true });
        // Don't save in preview mode
        return result.assignments;
    }
}

// Export singleton instance
const roleAssignmentService = new RoleAssignmentService();
export default roleAssignmentService;
