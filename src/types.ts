export type Persona = 'teacher' | 'learner';

export type Tab = 'Discover' | 'Sessions' | 'Community' | 'Progress' | 'Profile';

export type DiscoveryCard = {
  id: string;
  name: string;
  persona: Persona;
  title: string;
  skill: string;
  category: string;
  country: string;
  rating: number;
  bio: string;
  nextSessionSlots: string[];
  connected: boolean;
  favorited: boolean;
  verifiedSkills?: string[];
  helpOffered?: string[];
  helpWanted?: string[];
  portfolioProjects?: string[];
  endorsements?: string[];
  reviews?: string[];
  completedSessions?: number;
  repeatLearners?: number;
  featured?: boolean;
};

export type Session = {
  id: string;
  cardId: string;
  with: string;
  skill: string;
  time: string;
  status: 'upcoming' | 'live' | 'completed';
  createdAt: string;
  calendarUrl: string;
  format?: 'Video call' | 'Audio call' | 'Async review';
  goal?: string;
  note?: string;
  reminderSet?: boolean;
  meetingLink?: string;
  checklist?: string[];
  resources?: string[];
  followUp?: string;
};

export type CommunityEvent = {
  id: string;
  title: string;
  description: string;
  participants: number;
  joined: boolean;
  format?: string;
  host?: string;
  location?: string;
  category?: string;
  agenda?: string[];
  attendeePreview?: string[];
  recurringLabel?: string;
  reminderSet?: boolean;
  recap?: string;
  threadId?: string;
};

export type LearningPlan = {
  profileCompleted: boolean;
  firstSessionBooked: boolean;
  challengeJoined: boolean;
  skillsTarget: number;
  skillsCompleted: number;
  completedSessions?: number;
  roomsJoined?: number;
  savedProfiles?: number;
};

export type Messages = {
  unreadCount: number;
  humanUnread?: number;
  systemUnread?: number;
  bookingUnread?: number;
};

export type AppNotification = {
  id: string;
  title: string;
  detail: string;
  createdAt: string;
  read: boolean;
  kind?: 'system' | 'human' | 'booking' | 'community';
  actor?: string;
};

export type MessageThread = {
  id: string;
  participant: string;
  topic: string;
  unread: number;
  lastMessage: string;
  lastAt: string;
  category?: 'mentor' | 'booking' | 'community' | 'system';
  participantRole?: string;
  quickReplies?: string[];
};

export type User = {
  id: string;
  name: string;
  email: string;
  headline: string;
  bio: string;
  country: string;
  skillsOffered: string[];
  skillsToLearn: string[];
  portfolioProjects: string[];
  verifiedSkills: string[];
  endorsements: string[];
  reviews: string[];
  helpOffered: string[];
  helpWanted: string[];
  operatorMode?: boolean;
  createdAt?: string;
};

export type AuthResponse = {
  token: string;
  user: User;
};

export type PublicOverview = {
  totalMembers: number;
  mentorCount: number;
  learnerCount: number;
  sessionCount: number;
  categories: string[];
  featuredCards: DiscoveryCard[];
  featuredEvents: CommunityEvent[];
};

export type AdminDashboard = {
  featuredMentors: DiscoveryCard[];
  trendingSkills: string[];
  bookingHealth: {
    total: number;
    upcoming: number;
    live: number;
    completed: number;
  };
  roomHealth: Array<{
    id: string;
    title: string;
    participants: number;
    joined: boolean;
  }>;
  reports: Array<{
    id: string;
    label: string;
    severity: 'low' | 'medium' | 'high';
  }>;
};
