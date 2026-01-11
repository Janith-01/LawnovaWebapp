import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://janithviranga2001_db_user:EZIjTsPS3lDIrCtf@mocktrails.gl9ftpc.mongodb.net/?appName=Mocktrails';
const BASE_URL = process.env.MOCKTRIAL_BASE_URL || 'http://localhost:5003';

const Session = mongoose.model(
  'SmokeSession',
  new mongoose.Schema(
    {
      title: String,
      caseType: String,
      scheduledAt: Date,
      endsAt: Date,
      durationMinutes: Number,
      createdBy: String,
      maxParticipants: Number,
    },
    { collection: 'sessions' }
  )
);

const Invitation = mongoose.model(
  'SmokeInvitation',
  new mongoose.Schema(
    {
      sessionId: mongoose.Schema.Types.ObjectId,
      invitedBy: String,
      invitedUserId: String,
      invitedEmail: String,
      role: String,
      status: String,
      expiresAt: Date,
      respondedAt: Date,
    },
    { collection: 'invitations' }
  )
);

const main = async () => {
  await mongoose.connect(MONGODB_URI);

  const now = Date.now();
  const invitedUserId = `invited-user-smoke-${Math.random().toString(16).slice(2, 10)}`;

  const session = await Session.create({
    title: 'Smoke Accept Invite',
    caseType: 'civil',
    scheduledAt: new Date(now + 60 * 60 * 1000),
    endsAt: new Date(now + 2 * 60 * 60 * 1000),
    durationMinutes: 60,
    createdBy: 'owner-smoke',
    maxParticipants: 10,
  });

  const invitation = await Invitation.create({
    sessionId: session._id,
    invitedBy: 'owner-smoke',
    invitedUserId,
    invitedEmail: null,
    role: 'judge',
    status: 'pending',
    expiresAt: new Date(now + 24 * 60 * 60 * 1000),
  });

  const acceptUrl = `${BASE_URL}/invitations/${invitation._id}/accept`;
  const res = await fetch(acceptUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-user-id': invitedUserId,
      'x-user-role': 'student',
      // Intentionally omit x-user-email to verify identifier-based invites can be accepted.
    },
    body: JSON.stringify({}),
  });

  const bodyText = await res.text();

  if (!res.ok) {
    throw new Error(`Accept failed: HTTP ${res.status} ${res.statusText} :: ${bodyText}`);
  }

  console.log(`OK: Accepted invitation ${invitation._id} for user ${invitedUserId}`);
  console.log(bodyText);

  await mongoose.disconnect();
};

main().catch((err) => {
  console.error(err?.stack || String(err));
  process.exit(1);
});
