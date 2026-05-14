const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { MongoClient } = require('mongodb');
const {
  MONGODB_URI,
  MONGODB_DB_NAME,
  SEED_DATA_FILE,
} = require('./config');

const seed = JSON.parse(fs.readFileSync(SEED_DATA_FILE, 'utf8'));

const nowIso = () => new Date().toISOString();
const newId = (prefix) => `${prefix}-${crypto.randomUUID()}`;

let client;
let database;
let initPromise;

const profileCompleted = (user) =>
  Boolean(
    user.headline &&
      user.bio &&
      user.country &&
      user.skillsOffered.length &&
      user.skillsToLearn.length
  );

const rowToUser = (row) => {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    headline: row.headline,
    bio: row.bio,
    country: row.country,
    skillsOffered: row.skills_offered || [],
    skillsToLearn: row.skills_to_learn || [],
    portfolioProjects: row.portfolio_projects || [],
    verifiedSkills: row.verified_skills || [],
    endorsements: row.endorsements || [],
    reviews: row.reviews || [],
    helpOffered: row.help_offered || [],
    helpWanted: row.help_wanted || [],
    operatorMode: Boolean(row.operator_mode),
    createdAt: row.created_at,
  };
};

const rowToCard = (row, state = {}) => ({
  id: row.id,
  name: row.name,
  persona: row.persona,
  title: row.title,
  skill: row.skill,
  category: row.category,
  country: row.country,
  rating: Number(row.rating),
  bio: row.bio,
  nextSessionSlots: row.next_session_slots || [],
  connected: Boolean(state.connected),
  favorited: Boolean(state.favorited),
  verifiedSkills: row.verified_skills || [],
  helpOffered: row.help_offered || [],
  helpWanted: row.help_wanted || [],
  portfolioProjects: row.portfolio_projects || [],
  endorsements: row.endorsements || [],
  reviews: row.reviews || [],
  completedSessions: Number(row.completed_sessions || 0),
  repeatLearners: Number(row.repeat_learners || 0),
  featured: Boolean(row.featured),
});

const rowToSession = (row) => ({
  id: row.id,
  cardId: row.card_id,
  with: row.with_name,
  skill: row.skill,
  time: row.time,
  status: row.status,
  createdAt: row.created_at,
  calendarUrl: row.calendar_url,
  format: row.format,
  goal: row.goal,
  note: row.note,
  reminderSet: Boolean(row.reminder_set),
  meetingLink: row.meeting_link,
  checklist: row.checklist || [],
  resources: row.resources || [],
  followUp: row.follow_up,
});

const rowToEvent = (row, joined = false, participants = 0) => ({
  id: row.id,
  title: row.title,
  description: row.description,
  participants,
  joined,
  format: row.format,
  host: row.host,
  location: row.location,
  category: row.category,
  agenda: row.agenda || [],
  attendeePreview: row.attendee_preview || [],
  recurringLabel: row.recurring_label || '',
  reminderSet: Boolean(row.reminder_set),
  recap: row.recap || '',
  threadId: row.thread_id || '',
});

const rowToLearningPlan = (row) => ({
  profileCompleted: Boolean(row.profile_completed),
  firstSessionBooked: Boolean(row.first_session_booked),
  challengeJoined: Boolean(row.challenge_joined),
  skillsTarget: Number(row.skills_target),
  skillsCompleted: Number(row.skills_completed),
  completedSessions: Number(row.completed_sessions || 0),
  roomsJoined: Number(row.rooms_joined || 0),
  savedProfiles: Number(row.saved_profiles || 0),
});

const rowToNotification = (row) => ({
  id: row.id,
  title: row.title,
  detail: row.detail,
  createdAt: row.created_at,
  read: Boolean(row.read),
  kind: row.kind,
  actor: row.actor,
});

const rowToThread = (row) => ({
  id: row.id,
  participant: row.participant,
  topic: row.topic,
  unread: Number(row.unread),
  lastMessage: row.last_message,
  lastAt: row.last_at,
  category: row.category,
  participantRole: row.participant_role,
  quickReplies: row.quick_replies || [],
});

const rowToPortfolioAsset = (row) => ({
  id: row.id,
  title: row.title,
  url: row.url,
  kind: row.kind,
  createdAt: row.created_at,
});

const rowToRoomMessage = (row) => ({
  id: row.id,
  eventId: row.event_id,
  author: row.author,
  role: row.role,
  message: row.message,
  createdAt: row.created_at,
  pinned: Boolean(row.pinned),
  system: Boolean(row.system),
});

const collections = () => ({
  users: database.collection('users'),
  categories: database.collection('categories'),
  discoveryCards: database.collection('discovery_cards'),
  userCardState: database.collection('user_card_state'),
  sessions: database.collection('sessions'),
  events: database.collection('events'),
  userEventState: database.collection('user_event_state'),
  learningPlans: database.collection('learning_plans'),
  messages: database.collection('messages'),
  notifications: database.collection('notifications'),
  messageThreads: database.collection('message_threads'),
  portfolioAssets: database.collection('portfolio_assets'),
  roomMessages: database.collection('room_messages'),
  adminReports: database.collection('admin_reports'),
});

const ensureIndexes = async () => {
  const c = collections();
  await Promise.all([
    c.users.createIndex({ id: 1 }, { unique: true }),
    c.users.createIndex({ email: 1 }, { unique: true }),
    c.categories.createIndex({ name: 1 }, { unique: true }),
    c.discoveryCards.createIndex({ id: 1 }, { unique: true }),
    c.userCardState.createIndex({ user_id: 1, card_id: 1 }, { unique: true }),
    c.sessions.createIndex({ id: 1 }, { unique: true }),
    c.sessions.createIndex({ user_id: 1, created_at: -1 }),
    c.events.createIndex({ id: 1 }, { unique: true }),
    c.userEventState.createIndex({ user_id: 1, event_id: 1 }, { unique: true }),
    c.learningPlans.createIndex({ user_id: 1 }, { unique: true }),
    c.messages.createIndex({ user_id: 1 }, { unique: true }),
    c.notifications.createIndex({ id: 1 }, { unique: true }),
    c.notifications.createIndex({ user_id: 1, created_at: -1 }),
    c.messageThreads.createIndex({ id: 1 }, { unique: true }),
    c.messageThreads.createIndex({ user_id: 1, last_at: -1 }),
    c.portfolioAssets.createIndex({ id: 1 }, { unique: true }),
    c.portfolioAssets.createIndex({ user_id: 1, created_at: -1 }),
    c.roomMessages.createIndex({ id: 1 }, { unique: true }),
    c.roomMessages.createIndex({ user_id: 1, event_id: 1, created_at: 1 }),
    c.adminReports.createIndex({ id: 1 }, { unique: true }),
    c.adminReports.createIndex({ user_id: 1, status: 1 }),
  ]);
};

const ensureUserState = async (userId, overrides = {}) => {
  const c = collections();
  await c.learningPlans.updateOne(
    { user_id: userId },
    {
      $setOnInsert: {
        user_id: userId,
        profile_completed: Boolean(overrides.profileCompleted),
        first_session_booked: Boolean(overrides.firstSessionBooked),
        challenge_joined: Boolean(overrides.challengeJoined),
        skills_target: overrides.skillsTarget ?? 4,
        skills_completed: overrides.skillsCompleted ?? 0,
        completed_sessions: overrides.completedSessions ?? 0,
        rooms_joined: overrides.roomsJoined ?? 0,
        saved_profiles: overrides.savedProfiles ?? 0,
      },
    },
    { upsert: true }
  );

  await c.messages.updateOne(
    { user_id: userId },
    {
      $setOnInsert: {
        user_id: userId,
        unread_count: overrides.unreadCount ?? 0,
        human_unread: overrides.humanUnread ?? 0,
        system_unread: overrides.systemUnread ?? 0,
        booking_unread: overrides.bookingUnread ?? 0,
      },
    },
    { upsert: true }
  );
};

const pushNotification = async (userId, title, detail, kind = 'system', actor = '') => {
  await collections().notifications.insertOne({
    id: newId('n'),
    user_id: userId,
    title,
    detail,
    created_at: nowIso(),
    read: false,
    kind,
    actor,
  });
};

const seedDatabase = async () => {
  const c = collections();
  if ((await c.users.countDocuments()) > 0) {
    return;
  }

  if (seed.categories.length) {
    await c.categories.insertMany(seed.categories.map((name) => ({ name })));
  }

  if (seed.discoveryCards.length) {
    await c.discoveryCards.insertMany(
      seed.discoveryCards.map((card) => ({
        id: card.id,
        name: card.name,
        persona: card.persona,
        title: card.title,
        skill: card.skill,
        category: card.category,
        country: card.country,
        rating: Number(card.rating),
        bio: card.bio,
        next_session_slots: card.nextSessionSlots,
        verified_skills: card.verifiedSkills || [card.skill, card.category],
        help_offered: card.helpOffered || [card.skill],
        help_wanted: card.helpWanted || ['Peer exchange'],
        portfolio_projects: card.portfolioProjects || [`${card.skill} Sprint`],
        endorsements: card.endorsements || [`Trusted for ${card.skill}`],
        reviews: card.reviews || ['Clear, practical, and easy to apply.'],
        completed_sessions: Number(card.completedSessions || 0),
        repeat_learners: Number(card.repeatLearners || 0),
        featured: Boolean(card.featured),
      }))
    );
  }

  if (seed.events.length) {
    await c.events.insertMany(
      seed.events.map((event) => ({
        id: event.id,
        title: event.title,
        description: event.description,
        base_participants: Math.max(
          event.participants - (event.joined ? 1 : 0),
          0
        ),
        format: event.format || 'Small-group room',
        host: event.host || 'SkillSwap host',
        location: event.location || 'Live in-app room',
        category: event.category || 'General',
        agenda: event.agenda || ['Quick welcome', 'Focused discussion blocks', 'Action recap'],
        attendee_preview: event.attendeePreview || ['Mentors', 'Explorers', 'Builders'],
        recurring_label: event.recurringLabel || 'Recurring weekly',
        recap: event.recap || '',
        thread_id: event.threadId || '',
        reminder_set: Boolean(event.reminderSet),
      }))
    );
  }

  const demoUser = seed.users[0];
  const demoUserId = demoUser.id;
  await c.users.insertOne({
    id: demoUser.id,
    name: demoUser.name,
    email: demoUser.email.toLowerCase(),
    password_hash: bcrypt.hashSync(demoUser.password, 10),
    headline: demoUser.headline,
    bio: demoUser.bio,
    country: demoUser.country,
    skills_offered: demoUser.skillsOffered,
    skills_to_learn: demoUser.skillsToLearn,
    portfolio_projects: demoUser.portfolioProjects || [],
    verified_skills: demoUser.verifiedSkills || demoUser.skillsOffered,
    endorsements: demoUser.endorsements || [],
    reviews: demoUser.reviews || [],
    help_offered: demoUser.helpOffered || demoUser.skillsOffered,
    help_wanted: demoUser.helpWanted || demoUser.skillsToLearn,
    operator_mode: Boolean(demoUser.operatorMode ?? true),
    created_at: nowIso(),
  });

  await ensureUserState(demoUserId, {
    profileCompleted: seed.learningPlan.profileCompleted,
    firstSessionBooked: seed.learningPlan.firstSessionBooked,
    challengeJoined: seed.learningPlan.challengeJoined,
    skillsTarget: seed.learningPlan.skillsTarget,
    skillsCompleted: seed.learningPlan.skillsCompleted,
    unreadCount: seed.messages.unreadCount,
    humanUnread: seed.messages.unreadCount,
    systemUnread: seed.notifications.filter((item) => !item.read).length,
    bookingUnread: seed.sessions.filter((item) => item.status !== 'completed').length,
    completedSessions: seed.sessions.filter((item) => item.status === 'completed').length,
    roomsJoined: seed.events.filter((item) => item.joined).length,
    savedProfiles: seed.discoveryCards.filter((item) => item.favorited).length,
  });

  const initialCardState = seed.discoveryCards
    .filter((card) => card.connected || card.favorited)
    .map((card) => ({
      user_id: demoUserId,
      card_id: card.id,
      connected: Boolean(card.connected),
      favorited: Boolean(card.favorited),
    }));
  if (initialCardState.length) {
    await c.userCardState.insertMany(initialCardState);
  }

  if (seed.sessions.length) {
    await c.sessions.insertMany(
      seed.sessions.map((session) => ({
        id: session.id,
        user_id: demoUserId,
        card_id: session.cardId,
        with_name: session.with,
        skill: session.skill,
        time: session.time,
        status: session.status,
        created_at: session.createdAt,
        calendar_url: session.calendarUrl,
        format: session.format || 'Video call',
        goal: session.goal || `Make progress on ${session.skill}.`,
        note: session.note || '',
        reminder_set: Boolean(session.reminderSet),
        meeting_link: session.meetingLink || 'https://meet.skillsswap.app/session-room',
        checklist: session.checklist || ['Bring one concrete blocker'],
        resources: session.resources || ['Relevant links or screenshots'],
        follow_up: session.followUp || 'Turn the session into one clear next move and confirm it in the thread.',
      }))
    );
  }

  const joinedEvents = seed.events
    .filter((event) => event.joined)
    .map((event) => ({
      user_id: demoUserId,
      event_id: event.id,
      joined_at: nowIso(),
    }));
  if (joinedEvents.length) {
    await c.userEventState.insertMany(joinedEvents);
  }

  if (seed.notifications.length) {
    await c.notifications.insertMany(
      seed.notifications.map((notification) => ({
        id: notification.id,
        user_id: demoUserId,
        title: notification.title,
        detail: notification.detail,
        created_at: notification.createdAt,
        read: Boolean(notification.read),
        kind: notification.kind || 'system',
        actor: notification.actor || '',
      }))
    );
  }

  if (seed.messageThreads.length) {
    await c.messageThreads.insertMany(
      seed.messageThreads.map((thread) => ({
        id: thread.id,
        user_id: demoUserId,
        participant: thread.participant,
        topic: thread.topic,
        unread: Number(thread.unread),
        last_message: thread.lastMessage,
        last_at: thread.lastAt,
        category: thread.category || 'mentor',
        participant_role: thread.participantRole || 'Member',
        quick_replies: thread.quickReplies || ['Sounds good', 'Can we reschedule?', 'Sharing updates now'],
      }))
    );
  }

  if (demoUser.portfolioProjects?.length) {
    await c.portfolioAssets.insertMany(
      demoUser.portfolioProjects.slice(0, 2).map((title) => ({
        id: newId('asset'),
        user_id: demoUserId,
        title,
        url: `https://portfolio.skillsswap.app/${encodeURIComponent(String(title).toLowerCase().replace(/\s+/g, '-'))}`,
        kind: 'link',
        created_at: nowIso(),
      }))
    );
  }

  await c.roomMessages.insertMany(
    seed.events.slice(0, 4).map((event) => ({
      id: newId('roommsg'),
      user_id: demoUserId,
      event_id: event.id,
      author: event.host || 'SkillSwap host',
      role: 'Host',
      message: `Welcome to ${event.title}. Share what you want to learn or contribute before we start.`,
      created_at: nowIso(),
      pinned: true,
      system: true,
    }))
  );

  await c.adminReports.insertMany([
    { id: 'report-1', user_id: demoUserId, label: '2 room summaries need host recap', severity: 'medium', status: 'open' },
    { id: 'report-2', user_id: demoUserId, label: '1 trending mentor should be featured', severity: 'low', status: 'open' },
    { id: 'report-3', user_id: demoUserId, label: 'Booking completion dipped in one thread cluster', severity: 'high', status: 'open' },
  ]);
};

const init = async () => {
  if (!initPromise) {
    initPromise = (async () => {
      client = new MongoClient(MONGODB_URI, {
        appName: 'SkillsSwap',
      });
      await client.connect();
      database = client.db(MONGODB_DB_NAME);
      await ensureIndexes();
      await seedDatabase();
    })();
  }
  return initPromise;
};

const getUserByEmail = async (email) =>
  collections().users.findOne({
    email: String(email).toLowerCase().trim(),
  });

const getUserById = async (userId) =>
  rowToUser(await collections().users.findOne({ id: userId }));

const requireOperator = async (userId) => {
  const user = await getUserById(userId);
  return Boolean(user?.operatorMode);
};

const verifyPassword = (userRow, password) =>
  Boolean(userRow && bcrypt.compareSync(String(password), userRow.password_hash));

const createUser = async ({ name, email, password }) => {
  await init();
  const id = newId('user');
  await collections().users.insertOne({
    id,
    name: String(name).trim(),
    email: String(email).toLowerCase().trim(),
    password_hash: bcrypt.hashSync(String(password), 10),
    headline: '',
    bio: '',
    country: '',
    skills_offered: [],
    skills_to_learn: [],
    portfolio_projects: [],
    verified_skills: [],
    endorsements: [],
    reviews: [],
    help_offered: [],
    help_wanted: [],
    operator_mode: false,
    created_at: nowIso(),
  });
  await ensureUserState(id);
  return getUserById(id);
};

const updateProfile = async (userId, updates) => {
  await init();
  const current = await collections().users.findOne({ id: userId });
  if (!current) {
    return null;
  }
  const next = {
    name: updates.name ?? current.name,
    headline: updates.headline ?? current.headline,
    bio: updates.bio ?? current.bio,
    country: updates.country ?? current.country,
    skillsOffered: updates.skillsOffered ?? current.skills_offered ?? [],
    skillsToLearn: updates.skillsToLearn ?? current.skills_to_learn ?? [],
    portfolioProjects: updates.portfolioProjects ?? current.portfolio_projects ?? [],
    verifiedSkills: updates.verifiedSkills ?? current.verified_skills ?? [],
    endorsements: updates.endorsements ?? current.endorsements ?? [],
    reviews: updates.reviews ?? current.reviews ?? [],
    helpOffered: updates.helpOffered ?? current.help_offered ?? [],
    helpWanted: updates.helpWanted ?? current.help_wanted ?? [],
    operatorMode: updates.operatorMode ?? Boolean(current.operator_mode),
  };

  await collections().users.updateOne(
    { id: userId },
    {
      $set: {
        name: next.name,
        headline: next.headline,
        bio: next.bio,
        country: next.country,
        skills_offered: next.skillsOffered,
        skills_to_learn: next.skillsToLearn,
        portfolio_projects: next.portfolioProjects,
        verified_skills: next.verifiedSkills,
        endorsements: next.endorsements,
        reviews: next.reviews,
        help_offered: next.helpOffered,
        help_wanted: next.helpWanted,
        operator_mode: next.operatorMode,
      },
    }
  );

  await collections().learningPlans.updateOne(
    { user_id: userId },
    { $set: { profile_completed: profileCompleted(next) } },
    { upsert: true }
  );

  return getUserById(userId);
};

const getPublicOverview = async () => {
  await init();
  const c = collections();
  const [totalUsers, totalCards, mentorCount, learnerCount, sessionCount] =
    await Promise.all([
      c.users.countDocuments(),
      c.discoveryCards.countDocuments(),
      c.discoveryCards.countDocuments({ persona: 'teacher' }),
      c.discoveryCards.countDocuments({ persona: 'learner' }),
      c.sessions.countDocuments(),
    ]);

  const featuredCards = (
    await c.discoveryCards.find({}).sort({ rating: -1, name: 1 }).limit(4).toArray()
  ).map((row) => rowToCard(row));

  const featuredEvents = (await c.events
    .find({})
    .sort({ base_participants: -1, title: 1 })
    .limit(3)
    .toArray()).map((event) => rowToEvent(event, false, Number(event.base_participants)));

  return {
    totalMembers: totalUsers + totalCards,
    mentorCount,
    learnerCount,
    sessionCount,
    categories: (await c.categories.find({}).sort({ name: 1 }).toArray()).map(
      (row) => row.name
    ),
    featuredCards,
    featuredEvents,
  };
};

const getCategories = async () =>
  (await collections().categories.find({}).sort({ name: 1 }).toArray()).map(
    (row) => row.name
  );

const getUserCardStateMap = async (userId, cardIds) => {
  const rows = await collections()
    .userCardState
    .find({ user_id: userId, card_id: { $in: cardIds } })
    .toArray();
  return new Map(rows.map((row) => [row.card_id, row]));
};

const getDiscoveryCards = async (
  userId,
  { q = '', category = 'All', persona = 'All' }
) => {
  await init();
  const filter = {};
  const query = String(q).trim();
  if (query) {
    const regex = new RegExp(query, 'i');
    filter.$or = [{ name: regex }, { skill: regex }, { title: regex }];
  }
  if (category !== 'All') {
    filter.category = category;
  }
  if (persona !== 'All') {
    filter.persona = persona;
  }

  const cards = await collections()
    .discoveryCards
    .find(filter)
    .sort({ rating: -1, name: 1 })
    .toArray();
  const stateMap = await getUserCardStateMap(
    userId,
    cards.map((card) => card.id)
  );
  return cards.map((card) => rowToCard(card, stateMap.get(card.id)));
};

const getCardForUser = async (userId, cardId) => {
  const [card, state] = await Promise.all([
    collections().discoveryCards.findOne({ id: cardId }),
    collections().userCardState.findOne({ user_id: userId, card_id: cardId }),
  ]);
  if (!card) {
    return null;
  }
  return { card, state: state || { connected: false, favorited: false } };
};

const incrementUnreadMessages = async (userId, amount = 1) => {
  await collections().messages.updateOne(
    { user_id: userId },
    {
      $inc: { unread_count: amount, human_unread: amount },
      $setOnInsert: { user_id: userId },
    },
    { upsert: true }
  );
};

const incrementBookingUnread = async (userId, amount = 1) => {
  await collections().messages.updateOne(
    { user_id: userId },
    {
      $inc: { unread_count: amount, booking_unread: amount },
      $setOnInsert: { user_id: userId },
    },
    { upsert: true }
  );
};

const incrementSystemUnread = async (userId, amount = 1) => {
  await collections().messages.updateOne(
    { user_id: userId },
    {
      $inc: { unread_count: amount, system_unread: amount },
      $setOnInsert: { user_id: userId },
    },
    { upsert: true }
  );
};

const upsertThread = async ({
  id = newId('thread'),
  userId,
  participant,
  topic,
  category = 'mentor',
  participantRole = 'Member',
  message,
  unread = 1,
  quickReplies = ['Sounds good', 'Can we reschedule?', 'Sharing updates now'],
}) => {
  const existing = await collections().messageThreads.findOne({
    user_id: userId,
    participant,
    topic,
  });
  const threadId = existing?.id || id;
  await collections().messageThreads.updateOne(
    { id: threadId },
    {
      $set: {
        user_id: userId,
        participant,
        topic,
        unread: (existing?.unread || 0) + unread,
        last_message: message,
        last_at: nowIso(),
        category,
        participant_role: participantRole,
        quick_replies: quickReplies,
      },
    },
    { upsert: true }
  );
  return threadId;
};

const toggleConnect = async (userId, cardId) => {
  await init();
  const current = await getCardForUser(userId, cardId);
  if (!current) {
    return null;
  }
  const nextConnected = !Boolean(current.state.connected);
  await collections().userCardState.updateOne(
    { user_id: userId, card_id: cardId },
    {
      $set: {
        connected: nextConnected,
        favorited: Boolean(current.state.favorited),
      },
    },
    { upsert: true }
  );
  if (nextConnected) {
    await incrementUnreadMessages(userId, 1);
    await upsertThread({
      userId,
      participant: current.card.name,
      topic: `${current.card.skill} connection`,
      category: 'mentor',
      participantRole: current.card.persona === 'teacher' ? 'Mentor' : 'Explorer',
      message: `Connection opened for ${current.card.skill}.`,
      quickReplies: ['Excited to connect', 'Can we book a session?', 'Sharing context now'],
    });
    await pushNotification(
      userId,
      'New connection',
      `You connected with ${current.card.name} for ${current.card.skill}.`,
      'human',
      current.card.name
    );
  }
  const updated = await getCardForUser(userId, cardId);
  return rowToCard(updated.card, updated.state);
};

const toggleFavorite = async (userId, cardId) => {
  await init();
  const current = await getCardForUser(userId, cardId);
  if (!current) {
    return null;
  }
  const nextFavorited = !Boolean(current.state.favorited);
  await collections().userCardState.updateOne(
    { user_id: userId, card_id: cardId },
    {
      $set: {
        connected: Boolean(current.state.connected),
        favorited: nextFavorited,
      },
    },
    { upsert: true }
  );
  if (nextFavorited) {
    await pushNotification(
      userId,
      'Saved profile',
      `${current.card.name} was added to your favorites list.`,
      'system',
      current.card.name
    );
  }
  const updated = await getCardForUser(userId, cardId);
  return rowToCard(updated.card, updated.state);
};

const getSessions = async (userId) =>
  (await collections()
    .sessions
    .find({ user_id: userId })
    .sort({ created_at: -1 })
    .toArray()).map(rowToSession);

const bookSession = async (userId, cardId, time, details = {}) => {
  await init();
  const card = await collections().discoveryCards.findOne({ id: cardId });
  if (!card) {
    return null;
  }
  const id = newId('session');
  const createdAt = nowIso();
  const calendarUrl = `/api/sessions/${id}/calendar`;

  await collections().sessions.insertOne({
    id,
    user_id: userId,
    card_id: card.id,
    with_name: card.name,
    skill: card.skill,
    time,
    status: 'upcoming',
    created_at: createdAt,
    calendar_url: calendarUrl,
    format: details.format || 'Video call',
    goal: String(details.goal || `Make progress on ${card.skill}.`).trim(),
    note: String(details.note || '').trim(),
    reminder_set: false,
    meeting_link: 'https://meet.skillsswap.app/session-room',
    checklist: ['Bring one concrete blocker', 'Share current context or links', 'Define the one outcome the session should unlock'],
    resources: ['Relevant links or screenshots', 'Current blocker summary', 'Desired outcome note'],
    follow_up: 'Turn the session into one clear next move and confirm it in the thread.',
  });

  await collections().learningPlans.updateOne(
    { user_id: userId },
    { $set: { first_session_booked: true }, $setOnInsert: { user_id: userId } },
    { upsert: true }
  );

  await incrementBookingUnread(userId, 1);
  await upsertThread({
    userId,
    participant: card.name,
    topic: `${card.skill} session`,
    category: 'booking',
    participantRole: card.persona === 'teacher' ? 'Mentor' : 'Explorer',
    message: `Booked for ${time}. Goal: ${String(details.goal || `Make progress on ${card.skill}.`).trim()}`,
    quickReplies: ['Confirming this works', 'Can we move the slot?', 'Sharing prep now'],
  });
  await pushNotification(
    userId,
    'Booking confirmed',
    `${card.name} session is booked for ${time}.`,
    'booking',
    card.name
  );

  return rowToSession(await collections().sessions.findOne({ id }));
};

const updateSessionStatus = async (userId, sessionId, status) => {
  await init();
  const session = await collections().sessions.findOne({
    id: sessionId,
    user_id: userId,
  });
  if (!session) {
    return null;
  }
  await collections().sessions.updateOne(
    { id: sessionId, user_id: userId },
    { $set: { status } }
  );
  if (status === 'completed') {
    await collections().learningPlans.updateOne(
      { user_id: userId },
      { $inc: { completed_sessions: 1, skills_completed: 1 } }
    );
  }
  await pushNotification(
    userId,
    'Session status updated',
    `${session.skill} with ${session.with_name} is now ${status}.`,
    'booking',
    session.with_name
  );
  return rowToSession(
    await collections().sessions.findOne({ id: sessionId, user_id: userId })
  );
};

const updateSession = async (userId, sessionId, updates) => {
  await init();
  const session = await collections().sessions.findOne({ id: sessionId, user_id: userId });
  if (!session) return null;
  const next = {
    status: updates.status ?? session.status,
    time: updates.time ?? session.time,
    format: updates.format ?? session.format,
    goal: updates.goal ?? session.goal,
    note: updates.note ?? session.note,
    reminder_set:
      typeof updates.reminderSet === 'boolean'
        ? updates.reminderSet
        : Boolean(session.reminder_set),
  };
  await collections().sessions.updateOne(
    { id: sessionId, user_id: userId },
    { $set: next }
  );
  return rowToSession(await collections().sessions.findOne({ id: sessionId, user_id: userId }));
};

const getSessionById = async (userId, sessionId) =>
  collections().sessions.findOne({ id: sessionId, user_id: userId });

const getEvents = async (userId) => {
  await init();
  const [events, joins] = await Promise.all([
    collections().events.find({}).sort({ base_participants: -1, title: 1 }).toArray(),
    collections().userEventState.find({}).toArray(),
  ]);
  const joinCounts = new Map();
  const userJoined = new Set();
  joins.forEach((join) => {
    joinCounts.set(join.event_id, (joinCounts.get(join.event_id) || 0) + 1);
    if (join.user_id === userId) {
      userJoined.add(join.event_id);
    }
  });
  return events.map((event) =>
    rowToEvent(
      event,
      userJoined.has(event.id),
      Number(event.base_participants) + (joinCounts.get(event.id) || 0)
    )
  );
};

const joinEvent = async (userId, eventId) => {
  await init();
  const event = await collections().events.findOne({ id: eventId });
  if (!event) {
    return null;
  }
  const existing = await collections().userEventState.findOne({
    user_id: userId,
    event_id: eventId,
  });
  if (!existing) {
    await collections().userEventState.insertOne({
      user_id: userId,
      event_id: eventId,
      joined_at: nowIso(),
    });
    await collections().learningPlans.updateOne(
      { user_id: userId },
      {
        $set: { challenge_joined: true },
        $inc: { rooms_joined: 1 },
        $setOnInsert: { user_id: userId },
      },
      { upsert: true }
    );
    await incrementSystemUnread(userId, 1);
    const threadId = await upsertThread({
      id: event.thread_id || newId('thread'),
      userId,
      participant: event.host || 'SkillSwap host',
      topic: event.title,
      category: 'community',
      participantRole: 'Host',
      message: `Joined room: ${event.title}.`,
      quickReplies: ['Looking forward to it', 'What should I prepare?', 'Joining with a question'],
    });
    await collections().events.updateOne({ id: eventId }, { $set: { thread_id: threadId } });
    await pushNotification(userId, 'Event joined', `You joined "${event.title}".`, 'community', event.title);
  }
  return (await getEvents(userId)).find((item) => item.id === eventId) || null;
};

const toggleEventReminder = async (userId, eventId) => {
  await init();
  const event = (await getEvents(userId)).find((item) => item.id === eventId);
  if (!event) return null;
  await collections().events.updateOne({ id: eventId }, { $set: { reminder_set: true } });
  await pushNotification(
    userId,
    'Room reminder saved',
    `${event.title} will stay pinned in your room alerts.`,
    'community',
    event.title
  );
  return { ...event, reminderSet: true };
};

const getLearningPlan = async (userId) => {
  const row = await collections().learningPlans.findOne({ user_id: userId });
  return row ? rowToLearningPlan(row) : null;
};

const updateLearningPlan = async (userId, updates) => {
  await init();
  const current = await getLearningPlan(userId);
  if (!current) {
    return null;
  }
  const next = {
    profileCompleted: updates.profileCompleted ?? current.profileCompleted,
    firstSessionBooked: updates.firstSessionBooked ?? current.firstSessionBooked,
    challengeJoined: updates.challengeJoined ?? current.challengeJoined,
    skillsTarget: updates.skillsTarget ?? current.skillsTarget,
    skillsCompleted: updates.skillsCompleted ?? current.skillsCompleted,
    completedSessions: updates.completedSessions ?? current.completedSessions,
    roomsJoined: updates.roomsJoined ?? current.roomsJoined,
    savedProfiles: updates.savedProfiles ?? current.savedProfiles,
  };
  await collections().learningPlans.updateOne(
    { user_id: userId },
    {
      $set: {
        profile_completed: next.profileCompleted,
        first_session_booked: next.firstSessionBooked,
        challenge_joined: next.challengeJoined,
        skills_target: next.skillsTarget,
        skills_completed: next.skillsCompleted,
        completed_sessions: next.completedSessions,
        rooms_joined: next.roomsJoined,
        saved_profiles: next.savedProfiles,
      },
    }
  );
  return getLearningPlan(userId);
};

const getMessages = async (userId) =>
  (await collections().messages.findOne({ user_id: userId })) || {
    unread_count: 0,
    human_unread: 0,
    system_unread: 0,
    booking_unread: 0,
  };

const markMessagesRead = async (userId) => {
  await init();
  await collections().messages.updateOne(
    { user_id: userId },
    {
      $set: { unread_count: 0, human_unread: 0, system_unread: 0, booking_unread: 0 },
      $setOnInsert: { user_id: userId },
    },
    { upsert: true }
  );
  await collections().messageThreads.updateMany(
    { user_id: userId },
    { $set: { unread: 0 } }
  );
  return { unreadCount: 0, humanUnread: 0, systemUnread: 0, bookingUnread: 0 };
};

const getNotifications = async (userId) =>
  (await collections()
    .notifications
    .find({ user_id: userId })
    .sort({ created_at: -1 })
    .toArray()).map(rowToNotification);

const markNotificationsRead = async (userId) => {
  await init();
  await collections().notifications.updateMany(
    { user_id: userId },
    { $set: { read: true } }
  );
  return getNotifications(userId);
};

const getMessageThreads = async (userId) =>
  (await collections()
    .messageThreads
    .find({ user_id: userId })
    .sort({ last_at: -1 })
    .toArray()).map(rowToThread);

const replyThread = async (userId, threadId, message) => {
  await init();
  const thread = await collections().messageThreads.findOne({
    id: threadId,
    user_id: userId,
  });
  if (!thread) {
    return null;
  }
  await collections().messageThreads.updateOne(
    { id: threadId, user_id: userId },
    {
      $set: {
        last_message: String(message).trim(),
        last_at: nowIso(),
        unread: 0,
      },
    }
  );
  await pushNotification(
    userId,
    'Message sent',
    `Your reply was sent to ${thread.participant}.`,
    thread.category === 'booking' ? 'booking' : 'human',
    thread.participant
  );
  return rowToThread(
    await collections().messageThreads.findOne({
      id: threadId,
      user_id: userId,
    })
  );
};

const getPortfolioAssets = async (userId) =>
  (await collections().portfolioAssets.find({ user_id: userId }).sort({ created_at: -1 }).toArray()).map(rowToPortfolioAsset);

const addPortfolioAsset = async (userId, payload) => {
  await init();
  const next = {
    id: newId('asset'),
    user_id: userId,
    title: String(payload.title || '').trim(),
    url: String(payload.url || '').trim(),
    kind: String(payload.kind || 'link').trim(),
    created_at: nowIso(),
  };
  await collections().portfolioAssets.insertOne(next);
  return rowToPortfolioAsset(next);
};

const removePortfolioAsset = async (userId, assetId) => {
  await init();
  const result = await collections().portfolioAssets.deleteOne({ id: assetId, user_id: userId });
  return result.deletedCount > 0;
};

const getEventDiscussion = async (userId, eventId) => {
  await init();
  const event = await collections().events.findOne({ id: eventId });
  if (!event) return [];
  return (await collections().roomMessages
    .find({ user_id: userId, event_id: eventId })
    .sort({ pinned: -1, created_at: 1 })
    .toArray()).map(rowToRoomMessage);
};

const postEventDiscussion = async (userId, eventId, message) => {
  await init();
  const [event, user] = await Promise.all([
    collections().events.findOne({ id: eventId }),
    getUserById(userId),
  ]);
  if (!event || !user) return null;
  const next = {
    id: newId('roommsg'),
    user_id: userId,
    event_id: eventId,
    author: user.name,
    role: user.operatorMode ? 'Operator' : 'Member',
    message: String(message).trim(),
    created_at: nowIso(),
    pinned: false,
    system: false,
  };
  await collections().roomMessages.insertOne(next);
  const threadId = event.thread_id || newId('thread');
  await upsertThread({
    id: threadId,
    userId,
    participant: event.host || 'SkillSwap host',
    topic: event.title,
    category: 'community',
    participantRole: 'Host',
    message: next.message,
    quickReplies: ['Thanks for the context', 'I can help with that', 'Sharing my notes after the room'],
  });
  if (!event.thread_id) {
    await collections().events.updateOne({ id: eventId }, { $set: { thread_id: threadId } });
  }
  await incrementSystemUnread(userId, 1);
  return rowToRoomMessage(next);
};

const getAdminDashboard = async (userId) => {
  await init();
  const featuredMentors = (
    await collections().discoveryCards
      .find({ persona: 'teacher' })
      .sort({ featured: -1, rating: -1 })
      .limit(4)
      .toArray()
  ).map((row) => rowToCard(row));
  const bookingHealthRow = await collections().sessions
    .aggregate([
      { $match: { user_id: userId } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          upcoming: { $sum: { $cond: [{ $eq: ['$status', 'upcoming'] }, 1, 0] } },
          live: { $sum: { $cond: [{ $eq: ['$status', 'live'] }, 1, 0] } },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
        },
      },
    ])
    .next();
  const trendingSkills = (await collections().discoveryCards
    .aggregate([
      { $group: { _id: '$skill', count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
      { $limit: 5 },
    ])
    .toArray()).map((item) => item._id);
  const roomHealth = (await getEvents(userId)).slice(0, 4).map((item) => ({
    id: item.id,
    title: item.title,
    participants: item.participants,
    joined: item.joined,
    category: item.category,
    recap: item.recap,
  }));
  const reports = (await collections().adminReports
    .find({ user_id: userId })
    .sort({ severity: -1, id: 1 })
    .toArray()).map((row) => ({
      id: row.id,
      label: row.label,
      severity: row.severity,
      status: row.status,
    }));
  return {
    featuredMentors,
    trendingSkills,
    bookingHealth: {
      total: Number(bookingHealthRow?.total || 0),
      upcoming: Number(bookingHealthRow?.upcoming || 0),
      live: Number(bookingHealthRow?.live || 0),
      completed: Number(bookingHealthRow?.completed || 0),
    },
    roomHealth,
    reports,
  };
};

const featureMentor = async (userId, cardId, featured) => {
  await init();
  if (!(await requireOperator(userId))) return null;
  await collections().discoveryCards.updateOne(
    { id: cardId, persona: 'teacher' },
    { $set: { featured: Boolean(featured) } }
  );
  const updated = await getCardForUser(userId, cardId);
  return updated ? rowToCard(updated.card, updated.state) : null;
};

const resolveAdminReport = async (userId, reportId) => {
  await init();
  if (!(await requireOperator(userId))) return null;
  const existing = await collections().adminReports.findOne({ id: reportId, user_id: userId });
  if (!existing) return null;
  await collections().adminReports.updateOne(
    { id: reportId, user_id: userId },
    { $set: { status: 'resolved' } }
  );
  await pushNotification(
    userId,
    'Operator update',
    'One report has been resolved and removed from the open queue.',
    'system',
    'Operator console'
  );
  return getAdminDashboard(userId);
};

const updateAdminEvent = async (userId, eventId, updates) => {
  await init();
  if (!(await requireOperator(userId))) return null;
  const event = await collections().events.findOne({ id: eventId });
  if (!event) return null;
  await collections().events.updateOne(
    { id: eventId },
    { $set: { recap: typeof updates.recap === 'string' ? updates.recap.trim() : event.recap } }
  );
  return (await getEvents(userId)).find((item) => item.id === eventId) || null;
};

module.exports = {
  init,
  createUser,
  getUserByEmail,
  getUserById,
  verifyPassword,
  updateProfile,
  getPublicOverview,
  getCategories,
  getDiscoveryCards,
  toggleConnect,
  toggleFavorite,
  getSessions,
  bookSession,
  updateSession,
  updateSessionStatus,
  getSessionById,
  getEvents,
  joinEvent,
  toggleEventReminder,
  getLearningPlan,
  updateLearningPlan,
  getMessages,
  markMessagesRead,
  getNotifications,
  markNotificationsRead,
  getMessageThreads,
  replyThread,
  getPortfolioAssets,
  addPortfolioAsset,
  removePortfolioAsset,
  getEventDiscussion,
  postEventDiscussion,
  getAdminDashboard,
  featureMentor,
  resolveAdminReport,
  updateAdminEvent,
};
