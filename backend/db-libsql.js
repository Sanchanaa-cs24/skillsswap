const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { createClient } = require('@libsql/client');
const {
  DATABASE_URL,
  DATABASE_AUTH_TOKEN,
  SEED_DATA_FILE,
} = require('./config');

const seed = JSON.parse(fs.readFileSync(SEED_DATA_FILE, 'utf8'));
const client = createClient({
  url: DATABASE_URL,
  authToken: DATABASE_AUTH_TOKEN || undefined,
});

const parseList = (value) => {
  try {
    return JSON.parse(value || '[]');
  } catch {
    return [];
  }
};

const boolInt = (value) => (value ? 1 : 0);
const nowIso = () => new Date().toISOString();
const newId = (prefix) => `${prefix}-${crypto.randomUUID()}`;
const defaultList = (list, fallback) => (Array.isArray(list) && list.length ? list : fallback);
const sessionPlaybook = (skill = '') => {
  const value = String(skill).toLowerCase();
  if (value.includes('design')) {
    return {
      checklist: ['Bring one screen to review', 'Share your main UX friction', 'Define the design decision you need'],
      resources: ['Current screen export', 'Relevant design file link', 'A short product context note'],
      followUp: 'Revise the screen with the strongest direction and send it back in-thread.',
      meetingLink: 'https://meet.skillsswap.app/design-review',
    };
  }
  if (value.includes('english') || value.includes('communication')) {
    return {
      checklist: ['Pick one speaking scenario', 'Write 3 phrases you want to improve', 'Bring one recent communication challenge'],
      resources: ['Prompt sheet', 'Example speaking structure', 'Optional recording note'],
      followUp: 'Repeat the exercise once more within 24 hours and note what improved.',
      meetingLink: 'https://meet.skillsswap.app/language-coaching',
    };
  }
  return {
    checklist: ['Bring one concrete blocker', 'Share current context or links', 'Define the one outcome the session should unlock'],
    resources: ['Relevant links or screenshots', 'Current blocker summary', 'Desired outcome note'],
    followUp: 'Turn the session into one clear next move and confirm it in the thread.',
    meetingLink: 'https://meet.skillsswap.app/session-room',
  };
};
const enrichCard = (card) => ({
  ...card,
  verifiedSkills: defaultList(card.verifiedSkills, [card.skill, card.category]),
  helpOffered: defaultList(card.helpOffered, [`Live guidance in ${card.skill}`, `Practical feedback on ${card.category.toLowerCase()} work`]),
  helpWanted: defaultList(card.helpWanted, card.persona === 'learner' ? [card.skill, 'Peer exchange'] : ['High-context learners', 'Focused session goals']),
  portfolioProjects: defaultList(card.portfolioProjects, [`${card.skill} Sprint`, `${card.category} Case Review`]),
  endorsements: defaultList(card.endorsements, [`Trusted for ${card.skill}`, `Known for strong follow-through`]),
  reviews: defaultList(card.reviews, ['Clear, practical, and easy to apply.', 'High-signal sessions with strong momentum.']),
  completedSessions: Number(card.completedSessions ?? Math.round(Number(card.rating || 4.6) * 8)),
  repeatLearners: Number(card.repeatLearners ?? Math.max(2, Math.round(Number(card.rating || 4.6) * 3))),
  featured: Boolean(card.featured ?? Number(card.rating || 0) >= 4.85),
});
const enrichUser = (user) => ({
  ...user,
  portfolioProjects: defaultList(user.portfolioProjects, ['Mobile UI System Refresh', 'Design Critique Sprint']),
  verifiedSkills: defaultList(user.verifiedSkills, user.skillsOffered || []),
  endorsements: defaultList(user.endorsements, ['Strong product taste', 'Helpful collaborator']),
  reviews: defaultList(user.reviews, ['Always clear, thoughtful, and practical.']),
  helpOffered: defaultList(user.helpOffered, user.skillsOffered || []),
  helpWanted: defaultList(user.helpWanted, user.skillsToLearn || []),
  operatorMode: Boolean(user.operatorMode ?? true),
});
const enrichEvent = (event) => ({
  ...event,
  format: event.format || 'Small-group room',
  host: event.host || 'SkillSwap host',
  location: event.location || 'Live in-app room',
  category: event.category || 'General',
  agenda: defaultList(event.agenda, ['Quick welcome', 'Focused discussion blocks', 'Action recap']),
  attendeePreview: defaultList(event.attendeePreview, ['Mentors', 'Explorers', 'Builders']),
  recurringLabel: event.recurringLabel || 'Recurring weekly',
  reminderSet: Boolean(event.reminderSet),
  recap: event.recap || 'Room recap will appear here after the session closes.',
  threadId: event.threadId || '',
});
const enrichThread = (thread) => ({
  ...thread,
  category: thread.category || (thread.topic.toLowerCase().includes('session') ? 'booking' : 'mentor'),
  participantRole: thread.participantRole || 'Member',
  quickReplies: defaultList(thread.quickReplies, ['Sounds good', 'Can we reschedule?', 'Sharing updates now']),
});

const rowValue = (row, key) => row[key];
const rowCount = (row, key = 'count') => Number(rowValue(row, key) || 0);

const sanitizeUserRow = (row) => {
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
    skillsOffered: parseList(row.skills_offered),
    skillsToLearn: parseList(row.skills_to_learn),
    portfolioProjects: parseList(row.portfolio_projects),
    verifiedSkills: parseList(row.verified_skills),
    endorsements: parseList(row.endorsements),
    reviews: parseList(row.reviews),
    helpOffered: parseList(row.help_offered),
    helpWanted: parseList(row.help_wanted),
    operatorMode: Boolean(row.operator_mode),
    createdAt: row.created_at,
  };
};

const rowToCard = (row) => ({
  id: row.id,
  name: row.name,
  persona: row.persona,
  title: row.title,
  skill: row.skill,
  category: row.category,
  country: row.country,
  rating: Number(row.rating),
  bio: row.bio,
  nextSessionSlots: parseList(row.next_session_slots),
  connected: Boolean(row.connected),
  favorited: Boolean(row.favorited),
  verifiedSkills: parseList(row.verified_skills),
  helpOffered: parseList(row.help_offered),
  helpWanted: parseList(row.help_wanted),
  portfolioProjects: parseList(row.portfolio_projects),
  endorsements: parseList(row.endorsements),
  reviews: parseList(row.reviews),
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
  checklist: parseList(row.checklist),
  resources: parseList(row.resources),
  followUp: row.follow_up,
});

const rowToEvent = (row) => ({
  id: row.id,
  title: row.title,
  description: row.description,
  participants: Number(row.participants),
  joined: Boolean(row.joined),
  format: row.format,
  host: row.host,
  location: row.location,
  category: row.category,
  agenda: parseList(row.agenda),
  attendeePreview: parseList(row.attendee_preview),
  recurringLabel: row.recurring_label,
  reminderSet: Boolean(row.reminder_set),
  recap: row.recap,
  threadId: row.thread_id,
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
  quickReplies: parseList(row.quick_replies),
});

const profileCompleted = (user) =>
  Boolean(
    user.headline &&
      user.bio &&
      user.country &&
      user.skillsOffered.length &&
      user.skillsToLearn.length
  );

const execute = async (sql, args = []) => client.execute({ sql, args });

const getRow = async (sql, args = []) => {
  const result = await execute(sql, args);
  return result.rows[0] || null;
};

const getAll = async (sql, args = []) => {
  const result = await execute(sql, args);
  return result.rows;
};

const safeExecute = async (sql, args = []) => {
  try {
    await execute(sql, args);
  } catch (error) {
    const message = String(error?.message || error);
    if (message.includes('duplicate column name') || message.includes('already exists')) {
      return;
    }
    throw error;
  }
};

const runMigrations = async () => {
  const statements = [
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      headline TEXT NOT NULL DEFAULT '',
      bio TEXT NOT NULL DEFAULT '',
      country TEXT NOT NULL DEFAULT '',
      skills_offered TEXT NOT NULL DEFAULT '[]',
      skills_to_learn TEXT NOT NULL DEFAULT '[]',
      portfolio_projects TEXT NOT NULL DEFAULT '[]',
      verified_skills TEXT NOT NULL DEFAULT '[]',
      endorsements TEXT NOT NULL DEFAULT '[]',
      reviews TEXT NOT NULL DEFAULT '[]',
      help_offered TEXT NOT NULL DEFAULT '[]',
      help_wanted TEXT NOT NULL DEFAULT '[]',
      operator_mode INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS categories (
      name TEXT PRIMARY KEY
    )`,
    `CREATE TABLE IF NOT EXISTS discovery_cards (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      persona TEXT NOT NULL,
      title TEXT NOT NULL,
      skill TEXT NOT NULL,
      category TEXT NOT NULL,
      country TEXT NOT NULL,
      rating REAL NOT NULL,
      bio TEXT NOT NULL,
      next_session_slots TEXT NOT NULL DEFAULT '[]',
      verified_skills TEXT NOT NULL DEFAULT '[]',
      help_offered TEXT NOT NULL DEFAULT '[]',
      help_wanted TEXT NOT NULL DEFAULT '[]',
      portfolio_projects TEXT NOT NULL DEFAULT '[]',
      endorsements TEXT NOT NULL DEFAULT '[]',
      reviews TEXT NOT NULL DEFAULT '[]',
      completed_sessions INTEGER NOT NULL DEFAULT 0,
      repeat_learners INTEGER NOT NULL DEFAULT 0,
      featured INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS user_card_state (
      user_id TEXT NOT NULL,
      card_id TEXT NOT NULL,
      connected INTEGER NOT NULL DEFAULT 0,
      favorited INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, card_id)
    )`,
    `CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      card_id TEXT NOT NULL,
      with_name TEXT NOT NULL,
      skill TEXT NOT NULL,
      time TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      calendar_url TEXT NOT NULL,
      format TEXT NOT NULL DEFAULT 'Video call',
      goal TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      reminder_set INTEGER NOT NULL DEFAULT 0,
      meeting_link TEXT NOT NULL DEFAULT '',
      checklist TEXT NOT NULL DEFAULT '[]',
      resources TEXT NOT NULL DEFAULT '[]',
      follow_up TEXT NOT NULL DEFAULT ''
    )`,
    `CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      base_participants INTEGER NOT NULL DEFAULT 0,
      format TEXT NOT NULL DEFAULT 'Small-group room',
      host TEXT NOT NULL DEFAULT 'SkillSwap host',
      location TEXT NOT NULL DEFAULT 'Live in-app room',
      category TEXT NOT NULL DEFAULT 'General',
      agenda TEXT NOT NULL DEFAULT '[]',
      attendee_preview TEXT NOT NULL DEFAULT '[]',
      recurring_label TEXT NOT NULL DEFAULT '',
      recap TEXT NOT NULL DEFAULT '',
      thread_id TEXT NOT NULL DEFAULT ''
    )`,
    `CREATE TABLE IF NOT EXISTS user_event_state (
      user_id TEXT NOT NULL,
      event_id TEXT NOT NULL,
      joined_at TEXT NOT NULL,
      PRIMARY KEY (user_id, event_id)
    )`,
    `CREATE TABLE IF NOT EXISTS learning_plans (
      user_id TEXT PRIMARY KEY,
      profile_completed INTEGER NOT NULL DEFAULT 0,
      first_session_booked INTEGER NOT NULL DEFAULT 0,
      challenge_joined INTEGER NOT NULL DEFAULT 0,
      skills_target INTEGER NOT NULL DEFAULT 4,
      skills_completed INTEGER NOT NULL DEFAULT 0,
      completed_sessions INTEGER NOT NULL DEFAULT 0,
      rooms_joined INTEGER NOT NULL DEFAULT 0,
      saved_profiles INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS messages (
      user_id TEXT PRIMARY KEY,
      unread_count INTEGER NOT NULL DEFAULT 0,
      human_unread INTEGER NOT NULL DEFAULT 0,
      system_unread INTEGER NOT NULL DEFAULT 0,
      booking_unread INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      detail TEXT NOT NULL,
      created_at TEXT NOT NULL,
      read INTEGER NOT NULL DEFAULT 0,
      kind TEXT NOT NULL DEFAULT 'system',
      actor TEXT NOT NULL DEFAULT ''
    )`,
    `CREATE TABLE IF NOT EXISTS message_threads (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      participant TEXT NOT NULL,
      topic TEXT NOT NULL,
      unread INTEGER NOT NULL DEFAULT 0,
      last_message TEXT NOT NULL,
      last_at TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'mentor',
      participant_role TEXT NOT NULL DEFAULT 'Member',
      quick_replies TEXT NOT NULL DEFAULT '[]'
    )`,
  ];

  for (const sql of statements) {
    await execute(sql);
  }

  const alterStatements = [
    `ALTER TABLE users ADD COLUMN portfolio_projects TEXT NOT NULL DEFAULT '[]'`,
    `ALTER TABLE users ADD COLUMN verified_skills TEXT NOT NULL DEFAULT '[]'`,
    `ALTER TABLE users ADD COLUMN endorsements TEXT NOT NULL DEFAULT '[]'`,
    `ALTER TABLE users ADD COLUMN reviews TEXT NOT NULL DEFAULT '[]'`,
    `ALTER TABLE users ADD COLUMN help_offered TEXT NOT NULL DEFAULT '[]'`,
    `ALTER TABLE users ADD COLUMN help_wanted TEXT NOT NULL DEFAULT '[]'`,
    `ALTER TABLE users ADD COLUMN operator_mode INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE discovery_cards ADD COLUMN verified_skills TEXT NOT NULL DEFAULT '[]'`,
    `ALTER TABLE discovery_cards ADD COLUMN help_offered TEXT NOT NULL DEFAULT '[]'`,
    `ALTER TABLE discovery_cards ADD COLUMN help_wanted TEXT NOT NULL DEFAULT '[]'`,
    `ALTER TABLE discovery_cards ADD COLUMN portfolio_projects TEXT NOT NULL DEFAULT '[]'`,
    `ALTER TABLE discovery_cards ADD COLUMN endorsements TEXT NOT NULL DEFAULT '[]'`,
    `ALTER TABLE discovery_cards ADD COLUMN reviews TEXT NOT NULL DEFAULT '[]'`,
    `ALTER TABLE discovery_cards ADD COLUMN completed_sessions INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE discovery_cards ADD COLUMN repeat_learners INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE discovery_cards ADD COLUMN featured INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE sessions ADD COLUMN format TEXT NOT NULL DEFAULT 'Video call'`,
    `ALTER TABLE sessions ADD COLUMN goal TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE sessions ADD COLUMN note TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE sessions ADD COLUMN reminder_set INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE sessions ADD COLUMN meeting_link TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE sessions ADD COLUMN checklist TEXT NOT NULL DEFAULT '[]'`,
    `ALTER TABLE sessions ADD COLUMN resources TEXT NOT NULL DEFAULT '[]'`,
    `ALTER TABLE sessions ADD COLUMN follow_up TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE events ADD COLUMN format TEXT NOT NULL DEFAULT 'Small-group room'`,
    `ALTER TABLE events ADD COLUMN host TEXT NOT NULL DEFAULT 'SkillSwap host'`,
    `ALTER TABLE events ADD COLUMN location TEXT NOT NULL DEFAULT 'Live in-app room'`,
    `ALTER TABLE events ADD COLUMN category TEXT NOT NULL DEFAULT 'General'`,
    `ALTER TABLE events ADD COLUMN agenda TEXT NOT NULL DEFAULT '[]'`,
    `ALTER TABLE events ADD COLUMN attendee_preview TEXT NOT NULL DEFAULT '[]'`,
    `ALTER TABLE events ADD COLUMN recurring_label TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE events ADD COLUMN recap TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE events ADD COLUMN thread_id TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE learning_plans ADD COLUMN completed_sessions INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE learning_plans ADD COLUMN rooms_joined INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE learning_plans ADD COLUMN saved_profiles INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE messages ADD COLUMN human_unread INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE messages ADD COLUMN system_unread INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE messages ADD COLUMN booking_unread INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE notifications ADD COLUMN kind TEXT NOT NULL DEFAULT 'system'`,
    `ALTER TABLE notifications ADD COLUMN actor TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE message_threads ADD COLUMN category TEXT NOT NULL DEFAULT 'mentor'`,
    `ALTER TABLE message_threads ADD COLUMN participant_role TEXT NOT NULL DEFAULT 'Member'`,
    `ALTER TABLE message_threads ADD COLUMN quick_replies TEXT NOT NULL DEFAULT '[]'`,
  ];

  for (const sql of alterStatements) {
    await safeExecute(sql);
  }
};

const ensureUserState = async (userId, overrides = {}) => {
  await execute(
    `INSERT OR IGNORE INTO learning_plans (
      user_id, profile_completed, first_session_booked, challenge_joined, skills_target, skills_completed, completed_sessions, rooms_joined, saved_profiles
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      boolInt(overrides.profileCompleted),
      boolInt(overrides.firstSessionBooked),
      boolInt(overrides.challengeJoined),
      overrides.skillsTarget ?? 4,
      overrides.skillsCompleted ?? 0,
      overrides.completedSessions ?? 0,
      overrides.roomsJoined ?? 0,
      overrides.savedProfiles ?? 0,
    ]
  );

  await execute(
    'INSERT OR IGNORE INTO messages (user_id, unread_count, human_unread, system_unread, booking_unread) VALUES (?, ?, ?, ?, ?)',
    [
      userId,
      overrides.unreadCount ?? 0,
      overrides.humanUnread ?? 0,
      overrides.systemUnread ?? 0,
      overrides.bookingUnread ?? 0,
    ]
  );
};

const pushNotification = async (userId, title, detail, kind = 'system', actor = '') => {
  await execute(
    `INSERT INTO notifications (id, user_id, title, detail, created_at, read, kind, actor)
     VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
    [newId('n'), userId, title, detail, nowIso(), kind, actor]
  );
};

const seedDatabase = async () => {
  const hasUsers = await getRow('SELECT COUNT(*) AS count FROM users');
  if (rowCount(hasUsers) > 0) {
    return;
  }

  for (const name of seed.categories) {
    await execute('INSERT INTO categories (name) VALUES (?)', [name]);
  }

  for (const card of seed.discoveryCards) {
    const enriched = enrichCard(card);
    await execute(
      `INSERT INTO discovery_cards (
        id, name, persona, title, skill, category, country, rating, bio, next_session_slots,
        verified_skills, help_offered, help_wanted, portfolio_projects, endorsements, reviews,
        completed_sessions, repeat_learners, featured
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        enriched.id,
        enriched.name,
        enriched.persona,
        enriched.title,
        enriched.skill,
        enriched.category,
        enriched.country,
        enriched.rating,
        enriched.bio,
        JSON.stringify(enriched.nextSessionSlots),
        JSON.stringify(enriched.verifiedSkills),
        JSON.stringify(enriched.helpOffered),
        JSON.stringify(enriched.helpWanted),
        JSON.stringify(enriched.portfolioProjects),
        JSON.stringify(enriched.endorsements),
        JSON.stringify(enriched.reviews),
        enriched.completedSessions,
        enriched.repeatLearners,
        boolInt(enriched.featured),
      ]
    );
  }

  for (const event of seed.events) {
    const enriched = enrichEvent(event);
    await execute(
      `INSERT INTO events (
        id, title, description, base_participants, format, host, location, category,
        agenda, attendee_preview, recurring_label, recap, thread_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        enriched.id,
        enriched.title,
        enriched.description,
        Math.max(enriched.participants - (enriched.joined ? 1 : 0), 0),
        enriched.format,
        enriched.host,
        enriched.location,
        enriched.category,
        JSON.stringify(enriched.agenda),
        JSON.stringify(enriched.attendeePreview),
        enriched.recurringLabel,
        enriched.recap,
        enriched.threadId,
      ]
    );
  }

  const demoUser = enrichUser(seed.users[0]);
  const demoUserId = demoUser.id;
  await execute(
    `INSERT INTO users (
      id, name, email, password_hash, headline, bio, country, skills_offered, skills_to_learn,
      portfolio_projects, verified_skills, endorsements, reviews, help_offered, help_wanted, operator_mode, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      demoUser.id,
      demoUser.name,
      demoUser.email.toLowerCase(),
      bcrypt.hashSync(demoUser.password, 10),
      demoUser.headline,
      demoUser.bio,
      demoUser.country,
      JSON.stringify(demoUser.skillsOffered),
      JSON.stringify(demoUser.skillsToLearn),
      JSON.stringify(demoUser.portfolioProjects),
      JSON.stringify(demoUser.verifiedSkills),
      JSON.stringify(demoUser.endorsements),
      JSON.stringify(demoUser.reviews),
      JSON.stringify(demoUser.helpOffered),
      JSON.stringify(demoUser.helpWanted),
      boolInt(demoUser.operatorMode),
      nowIso(),
    ]
  );

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

  for (const card of seed.discoveryCards) {
    if (card.connected || card.favorited) {
      await execute(
        `INSERT INTO user_card_state (user_id, card_id, connected, favorited)
         VALUES (?, ?, ?, ?)`,
        [
          demoUserId,
          card.id,
          boolInt(card.connected),
          boolInt(card.favorited),
        ]
      );
    }
  }

  for (const session of seed.sessions) {
    const playbook = sessionPlaybook(session.skill);
    await execute(
      `INSERT INTO sessions (
        id, user_id, card_id, with_name, skill, time, status, created_at, calendar_url,
        format, goal, note, reminder_set, meeting_link, checklist, resources, follow_up
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        session.id,
        demoUserId,
        session.cardId,
        session.with,
        session.skill,
        session.time,
        session.status,
        session.createdAt,
        session.calendarUrl,
        session.format || 'Video call',
        session.goal || `Make progress on ${session.skill}.`,
        session.note || '',
        boolInt(Boolean(session.reminderSet)),
        session.meetingLink || playbook.meetingLink,
        JSON.stringify(session.checklist || playbook.checklist),
        JSON.stringify(session.resources || playbook.resources),
        session.followUp || playbook.followUp,
      ]
    );
  }

  for (const event of seed.events.filter((item) => item.joined)) {
    await execute(
      'INSERT OR IGNORE INTO user_event_state (user_id, event_id, joined_at) VALUES (?, ?, ?)',
      [demoUserId, event.id, nowIso()]
    );
  }

  for (const notification of seed.notifications) {
    await execute(
      `INSERT INTO notifications (id, user_id, title, detail, created_at, read, kind, actor)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        notification.id,
        demoUserId,
        notification.title,
        notification.detail,
        notification.createdAt,
        boolInt(notification.read),
        notification.kind || 'system',
        notification.actor || '',
      ]
    );
  }

  for (const thread of seed.messageThreads) {
    const enriched = enrichThread(thread);
    await execute(
      `INSERT INTO message_threads (
        id, user_id, participant, topic, unread, last_message, last_at, category, participant_role, quick_replies
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        enriched.id,
        demoUserId,
        enriched.participant,
        enriched.topic,
        enriched.unread,
        enriched.lastMessage,
        enriched.lastAt,
        enriched.category,
        enriched.participantRole,
        JSON.stringify(enriched.quickReplies),
      ]
    );
  }
};

let initPromise;

const init = async () => {
  if (!initPromise) {
    initPromise = (async () => {
      await runMigrations();
      await seedDatabase();
    })();
  }
  return initPromise;
};

const createUser = async ({ name, email, password }) => {
  await init();
  const id = newId('user');
  const normalizedEmail = String(email).toLowerCase().trim();
  const passwordHash = bcrypt.hashSync(String(password), 10);

  await execute(
    `INSERT INTO users (
      id, name, email, password_hash, headline, bio, country, skills_offered, skills_to_learn,
      portfolio_projects, verified_skills, endorsements, reviews, help_offered, help_wanted, operator_mode, created_at
    ) VALUES (?, ?, ?, ?, '', '', '', '[]', '[]', '[]', '[]', '[]', '[]', '[]', '[]', 0, ?)`,
    [id, String(name).trim(), normalizedEmail, passwordHash, nowIso()]
  );

  await ensureUserState(id);
  return getUserById(id);
};

const getUserByEmail = async (email) =>
  getRow('SELECT * FROM users WHERE email = ?', [
    String(email).toLowerCase().trim(),
  ]);

const getUserById = async (userId) =>
  enrichUser(sanitizeUserRow(await getRow('SELECT * FROM users WHERE id = ?', [userId])));

const verifyPassword = (userRow, password) =>
  Boolean(userRow && bcrypt.compareSync(String(password), userRow.password_hash));

const updateProfile = async (userId, updates) => {
  await init();
  const current = await getRow('SELECT * FROM users WHERE id = ?', [userId]);
  if (!current) {
    return null;
  }

  const next = {
    name: updates.name ?? current.name,
    headline: updates.headline ?? current.headline,
    bio: updates.bio ?? current.bio,
    country: updates.country ?? current.country,
    skillsOffered: updates.skillsOffered ?? parseList(current.skills_offered),
    skillsToLearn: updates.skillsToLearn ?? parseList(current.skills_to_learn),
    portfolioProjects: updates.portfolioProjects ?? parseList(current.portfolio_projects),
    verifiedSkills: updates.verifiedSkills ?? parseList(current.verified_skills),
    endorsements: updates.endorsements ?? parseList(current.endorsements),
    reviews: updates.reviews ?? parseList(current.reviews),
    helpOffered: updates.helpOffered ?? parseList(current.help_offered),
    helpWanted: updates.helpWanted ?? parseList(current.help_wanted),
    operatorMode: updates.operatorMode ?? Boolean(current.operator_mode),
  };

  await execute(
    `UPDATE users
     SET name = ?, headline = ?, bio = ?, country = ?, skills_offered = ?, skills_to_learn = ?,
         portfolio_projects = ?, verified_skills = ?, endorsements = ?, reviews = ?,
         help_offered = ?, help_wanted = ?, operator_mode = ?
     WHERE id = ?`,
    [
      next.name,
      next.headline,
      next.bio,
      next.country,
      JSON.stringify(next.skillsOffered),
      JSON.stringify(next.skillsToLearn),
      JSON.stringify(next.portfolioProjects),
      JSON.stringify(next.verifiedSkills),
      JSON.stringify(next.endorsements),
      JSON.stringify(next.reviews),
      JSON.stringify(next.helpOffered),
      JSON.stringify(next.helpWanted),
      boolInt(next.operatorMode),
      userId,
    ]
  );

  await execute(
    'UPDATE learning_plans SET profile_completed = ? WHERE user_id = ?',
    [boolInt(profileCompleted(next)), userId]
  );

  return getUserById(userId);
};

const getPublicOverview = async () => {
  await init();
  const mentorCount = rowCount(
    await getRow(
      "SELECT COUNT(*) AS count FROM discovery_cards WHERE persona = 'teacher'"
    )
  );
  const learnerCount = rowCount(
    await getRow(
      "SELECT COUNT(*) AS count FROM discovery_cards WHERE persona = 'learner'"
    )
  );
  const featuredCards = (
    await getAll(
      `SELECT id, name, persona, title, skill, category, country, rating, bio, next_session_slots,
              0 AS connected, 0 AS favorited
       FROM discovery_cards
       ORDER BY rating DESC
       LIMIT 4`
    )
  ).map(rowToCard);
  const featuredEvents = (
    await getAll(
    `SELECT id, title, description, base_participants AS participants, 0 AS joined,
            format, host, location, category, agenda, attendee_preview, recurring_label,
            0 AS reminder_set, recap, thread_id
     FROM events
     ORDER BY base_participants DESC
     LIMIT 3`
    )
  ).map(rowToEvent);

  return {
    totalMembers:
      rowCount(await getRow('SELECT COUNT(*) AS count FROM users')) +
      rowCount(await getRow('SELECT COUNT(*) AS count FROM discovery_cards')),
    mentorCount,
    learnerCount,
    sessionCount: rowCount(await getRow('SELECT COUNT(*) AS count FROM sessions')),
    categories: (await getAll('SELECT name FROM categories ORDER BY name')).map(
      (row) => row.name
    ),
    featuredCards,
    featuredEvents,
  };
};

const getCategories = async () =>
  (await getAll('SELECT name FROM categories ORDER BY name')).map(
    (row) => row.name
  );

const getDiscoveryCards = async (
  userId,
  { q = '', category = 'All', persona = 'All' }
) => {
  await init();
  const query = String(q).toLowerCase().trim();
  return (
    await getAll(
      `SELECT c.*,
              COALESCE(s.connected, 0) AS connected,
              COALESCE(s.favorited, 0) AS favorited
       FROM discovery_cards c
       LEFT JOIN user_card_state s
         ON s.card_id = c.id AND s.user_id = ?
       WHERE (? = '' OR lower(c.name) LIKE ? OR lower(c.skill) LIKE ? OR lower(c.title) LIKE ?)
         AND (? = 'All' OR c.category = ?)
         AND (? = 'All' OR c.persona = ?)
       ORDER BY c.rating DESC, c.name ASC`,
      [
        userId,
        query,
        `%${query}%`,
        `%${query}%`,
        `%${query}%`,
        category,
        category,
        persona,
        persona,
      ]
    )
  ).map(rowToCard);
};

const upsertCardState = async (userId, cardId, next) => {
  await execute(
    `INSERT INTO user_card_state (user_id, card_id, connected, favorited)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, card_id)
     DO UPDATE SET connected = excluded.connected, favorited = excluded.favorited`,
    [userId, cardId, boolInt(next.connected), boolInt(next.favorited)]
  );
};

const getCardForUser = async (userId, cardId) =>
  getRow(
    `SELECT c.*,
            COALESCE(s.connected, 0) AS connected,
            COALESCE(s.favorited, 0) AS favorited
     FROM discovery_cards c
     LEFT JOIN user_card_state s
       ON s.card_id = c.id AND s.user_id = ?
     WHERE c.id = ?`,
    [userId, cardId]
  );

const incrementUnreadMessages = async (userId, amount = 1) => {
  await execute(
    'UPDATE messages SET unread_count = unread_count + ?, human_unread = human_unread + ? WHERE user_id = ?',
    [amount, amount, userId]
  );
};

const incrementBookingUnread = async (userId, amount = 1) => {
  await execute(
    'UPDATE messages SET unread_count = unread_count + ?, booking_unread = booking_unread + ? WHERE user_id = ?',
    [amount, amount, userId]
  );
};

const incrementSystemUnread = async (userId, amount = 1) => {
  await execute(
    'UPDATE messages SET unread_count = unread_count + ?, system_unread = system_unread + ? WHERE user_id = ?',
    [amount, amount, userId]
  );
};

const toggleConnect = async (userId, cardId) => {
  await init();
  const current = await getCardForUser(userId, cardId);
  if (!current) {
    return null;
  }
  const nextConnected = !Boolean(current.connected);
  await upsertCardState(userId, cardId, {
    connected: nextConnected,
    favorited: Boolean(current.favorited),
  });
  if (nextConnected) {
    await incrementUnreadMessages(userId, 1);
    await pushNotification(
      userId,
      'New connection',
      `You connected with ${current.name} for ${current.skill}.`,
      'human',
      current.name
    );
  }
  return rowToCard(await getCardForUser(userId, cardId));
};

const toggleFavorite = async (userId, cardId) => {
  await init();
  const current = await getCardForUser(userId, cardId);
  if (!current) {
    return null;
  }
  const nextFavorited = !Boolean(current.favorited);
  await upsertCardState(userId, cardId, {
    connected: Boolean(current.connected),
    favorited: nextFavorited,
  });
  await execute(
    'UPDATE learning_plans SET saved_profiles = saved_profiles + ? WHERE user_id = ?',
    [nextFavorited ? 1 : -1, userId]
  );
  if (nextFavorited) {
    await pushNotification(
      userId,
      'Saved profile',
      `${current.name} was added to your favorites list.`,
      'system',
      current.name
    );
  }
  return rowToCard(await getCardForUser(userId, cardId));
};

const getSessions = async (userId) =>
  (
    await getAll(
      `SELECT * FROM sessions
       WHERE user_id = ?
       ORDER BY datetime(created_at) DESC`,
      [userId]
    )
  ).map(rowToSession);

const bookSession = async (userId, cardId, time, details = {}) => {
  await init();
  const card = await getRow('SELECT * FROM discovery_cards WHERE id = ?', [cardId]);
  if (!card) {
    return null;
  }
  const id = newId('session');
  const createdAt = nowIso();
  const calendarUrl = `/api/sessions/${id}/calendar`;
  const playbook = sessionPlaybook(card.skill);
  const format = details.format || 'Video call';
  const goal = String(details.goal || `Make progress on ${card.skill}.`).trim();
  const note = String(details.note || '').trim();

  await execute(
    `INSERT INTO sessions (
      id, user_id, card_id, with_name, skill, time, status, created_at, calendar_url,
      format, goal, note, reminder_set, meeting_link, checklist, resources, follow_up
    ) VALUES (?, ?, ?, ?, ?, ?, 'upcoming', ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
    [
      id,
      userId,
      card.id,
      card.name,
      card.skill,
      time,
      createdAt,
      calendarUrl,
      format,
      goal,
      note,
      playbook.meetingLink,
      JSON.stringify(playbook.checklist),
      JSON.stringify(playbook.resources),
      playbook.followUp,
    ]
  );

  await execute(
    `UPDATE learning_plans
     SET first_session_booked = 1
     WHERE user_id = ?`,
    [userId]
  );

  await incrementBookingUnread(userId, 1);
  await pushNotification(
    userId,
    'Booking confirmed',
    `${card.name} session is booked for ${time}.`,
    'booking',
    card.name
  );
  return rowToSession(await getRow('SELECT * FROM sessions WHERE id = ?', [id]));
};

const updateSessionStatus = async (userId, sessionId, status) => {
  await init();
  const session = await getRow(
    'SELECT * FROM sessions WHERE id = ? AND user_id = ?',
    [sessionId, userId]
  );
  if (!session) {
    return null;
  }
  await execute('UPDATE sessions SET status = ? WHERE id = ? AND user_id = ?', [
    status,
    sessionId,
    userId,
  ]);
  if (status === 'completed') {
    await execute(
      'UPDATE learning_plans SET completed_sessions = completed_sessions + 1, skills_completed = skills_completed + 1 WHERE user_id = ?',
      [userId]
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
    await getRow('SELECT * FROM sessions WHERE id = ? AND user_id = ?', [
      sessionId,
      userId,
    ])
  );
};

const updateSession = async (userId, sessionId, updates) => {
  await init();
  const session = await getRow(
    'SELECT * FROM sessions WHERE id = ? AND user_id = ?',
    [sessionId, userId]
  );
  if (!session) {
    return null;
  }
  const next = {
    status: updates.status ?? session.status,
    time: updates.time ?? session.time,
    format: updates.format ?? session.format,
    goal: updates.goal ?? session.goal,
    note: updates.note ?? session.note,
    reminderSet:
      typeof updates.reminderSet === 'boolean'
        ? boolInt(updates.reminderSet)
        : Number(session.reminder_set || 0),
  };
  await execute(
    `UPDATE sessions
     SET status = ?, time = ?, format = ?, goal = ?, note = ?, reminder_set = ?
     WHERE id = ? AND user_id = ?`,
    [
      next.status,
      next.time,
      next.format,
      next.goal,
      next.note,
      next.reminderSet,
      sessionId,
      userId,
    ]
  );
  if (typeof updates.reminderSet === 'boolean' && updates.reminderSet) {
    await pushNotification(
      userId,
      'Session reminder active',
      `${session.skill} with ${session.with_name} will stay visible in your alerts.`,
      'booking',
      session.with_name
    );
  }
  return rowToSession(
    await getRow('SELECT * FROM sessions WHERE id = ? AND user_id = ?', [sessionId, userId])
  );
};

const getSessionById = async (userId, sessionId) =>
  getRow('SELECT * FROM sessions WHERE id = ? AND user_id = ?', [
    sessionId,
    userId,
  ]);

const getEvents = async (userId) =>
  (
    await getAll(
      `SELECT e.id, e.title, e.description,
              e.base_participants + COUNT(ues.user_id) AS participants,
              MAX(CASE WHEN ues.user_id = ? THEN 1 ELSE 0 END) AS joined,
              e.format, e.host, e.location, e.category, e.agenda, e.attendee_preview,
              e.recurring_label, e.recap, e.thread_id, 0 AS reminder_set
       FROM events e
       LEFT JOIN user_event_state ues ON ues.event_id = e.id
       GROUP BY e.id
       ORDER BY participants DESC, e.title ASC`,
      [userId]
    )
  ).map(rowToEvent);

const joinEvent = async (userId, eventId) => {
  await init();
  const event = await getRow('SELECT * FROM events WHERE id = ?', [eventId]);
  if (!event) {
    return null;
  }
  const existing = await getRow(
    'SELECT 1 AS found FROM user_event_state WHERE user_id = ? AND event_id = ?',
    [userId, eventId]
  );
  if (!existing) {
    await execute(
      'INSERT INTO user_event_state (user_id, event_id, joined_at) VALUES (?, ?, ?)',
      [userId, eventId, nowIso()]
    );
    await execute(
      'UPDATE learning_plans SET challenge_joined = 1, rooms_joined = rooms_joined + 1 WHERE user_id = ?',
      [userId]
    );
    await incrementSystemUnread(userId, 1);
    await pushNotification(userId, 'Event joined', `You joined "${event.title}".`, 'community', event.title);
  }
  return (await getEvents(userId)).find((item) => item.id === eventId) || null;
};

const toggleEventReminder = async (userId, eventId) => {
  await init();
  const event = (await getEvents(userId)).find((item) => item.id === eventId);
  if (!event) return null;
  await pushNotification(
    userId,
    'Room reminder saved',
    `${event.title} will stay pinned in your room alerts.`,
    'community',
    event.title
  );
  return { ...event, reminderSet: true };
};

const getLearningPlan = async (userId) =>
  rowToLearningPlan(
    await getRow('SELECT * FROM learning_plans WHERE user_id = ?', [userId])
  );

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
  await execute(
    `UPDATE learning_plans
     SET profile_completed = ?, first_session_booked = ?, challenge_joined = ?, skills_target = ?, skills_completed = ?,
         completed_sessions = ?, rooms_joined = ?, saved_profiles = ?
     WHERE user_id = ?`,
    [
      boolInt(next.profileCompleted),
      boolInt(next.firstSessionBooked),
      boolInt(next.challengeJoined),
      next.skillsTarget,
      next.skillsCompleted,
      next.completedSessions,
      next.roomsJoined,
      next.savedProfiles,
      userId,
    ]
  );
  return getLearningPlan(userId);
};

const getMessages = async (userId) =>
  (await getRow('SELECT unread_count, human_unread, system_unread, booking_unread FROM messages WHERE user_id = ?', [userId])) || {
    unread_count: 0,
    human_unread: 0,
    system_unread: 0,
    booking_unread: 0,
  };

const markMessagesRead = async (userId) => {
  await init();
  await execute('UPDATE messages SET unread_count = 0, human_unread = 0, system_unread = 0, booking_unread = 0 WHERE user_id = ?', [userId]);
  await execute('UPDATE message_threads SET unread = 0 WHERE user_id = ?', [userId]);
  return { unreadCount: 0, humanUnread: 0, systemUnread: 0, bookingUnread: 0 };
};

const getNotifications = async (userId) =>
  (
    await getAll(
      `SELECT * FROM notifications
       WHERE user_id = ?
       ORDER BY datetime(created_at) DESC`,
      [userId]
    )
  ).map(rowToNotification);

const markNotificationsRead = async (userId) => {
  await init();
  await execute('UPDATE notifications SET read = 1 WHERE user_id = ?', [userId]);
  return getNotifications(userId);
};

const getMessageThreads = async (userId) =>
  (
    await getAll(
      `SELECT * FROM message_threads
       WHERE user_id = ?
       ORDER BY datetime(last_at) DESC`,
      [userId]
    )
  ).map((row) => enrichThread(rowToThread(row)));

const replyThread = async (userId, threadId, message) => {
  await init();
  const thread = await getRow(
    'SELECT * FROM message_threads WHERE id = ? AND user_id = ?',
    [threadId, userId]
  );
  if (!thread) {
    return null;
  }
  await execute(
    `UPDATE message_threads
     SET last_message = ?, last_at = ?, unread = 0
     WHERE id = ? AND user_id = ?`,
    [String(message).trim(), nowIso(), threadId, userId]
  );
  await pushNotification(
    userId,
    'Message sent',
    `Your reply was sent to ${thread.participant}.`,
    thread.category === 'booking' ? 'booking' : 'human',
    thread.participant
  );
  return rowToThread(
    await getRow('SELECT * FROM message_threads WHERE id = ? AND user_id = ?', [
      threadId,
      userId,
    ])
  );
};

const getAdminDashboard = async (userId) => {
  await init();
  const featuredMentors = (
    await getAll(
      `SELECT c.*,
              COALESCE(s.connected, 0) AS connected,
              COALESCE(s.favorited, 0) AS favorited
       FROM discovery_cards c
       LEFT JOIN user_card_state s ON s.card_id = c.id AND s.user_id = ?
       WHERE c.persona = 'teacher'
       ORDER BY c.featured DESC, c.rating DESC
       LIMIT 4`,
      [userId]
    )
  ).map(rowToCard);
  const bookingHealthRow = await getRow(
    `SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN status = 'upcoming' THEN 1 ELSE 0 END) AS upcoming,
      SUM(CASE WHEN status = 'live' THEN 1 ELSE 0 END) AS live,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed
     FROM sessions WHERE user_id = ?`,
    [userId]
  );
  const trending = await getAll(
    `SELECT skill, COUNT(*) AS count FROM discovery_cards GROUP BY skill ORDER BY count DESC, rating DESC LIMIT 5`
  );
  const roomHealth = (await getEvents(userId)).slice(0, 4).map((item) => ({
    id: item.id,
    title: item.title,
    participants: item.participants,
    joined: item.joined,
  }));
  return {
    featuredMentors,
    trendingSkills: trending.map((item) => item.skill),
    bookingHealth: {
      total: Number(bookingHealthRow?.total || 0),
      upcoming: Number(bookingHealthRow?.upcoming || 0),
      live: Number(bookingHealthRow?.live || 0),
      completed: Number(bookingHealthRow?.completed || 0),
    },
    roomHealth,
    reports: [
      { id: 'report-1', label: '2 room summaries need host recap', severity: 'medium' },
      { id: 'report-2', label: '1 trending mentor should be featured', severity: 'low' },
      { id: 'report-3', label: 'Booking completion dipped in one thread cluster', severity: 'high' },
    ],
  };
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
  getAdminDashboard,
};
