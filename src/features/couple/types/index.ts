export interface Couple {
  id: string;
  name: string | null;
  anniversaryDate: string | null;
  pendingDeletion: boolean;
  deleteAt: string | null;
  heroBgUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CoupleMember {
  coupleId: string;
  userId: string;
}

export interface CoupleInvitation {
  id: string;
  senderId: string;
  receiverId: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  createdAt: string;
  expiresAt: string;
  senderNickname?: string;
  senderEmail?: string;
  receiverNickname?: string;
  receiverEmail?: string;
}

export interface CoupleComment {
  id: string;
  entryId: string;
  userId: string;
  body: string;
  createdAt: string;
  userNickname?: string;
  userAvatarUrl?: string;
}

export interface CoupleReaction {
  entryId: string;
  userId: string;
  emoji: string;
}

export interface CoupleJournal {
  id: string;
  coupleId: string;
  userId: string;
  title: string | null;
  body: string;
  moodId: string | null;
  imageUrls: string[];
  tags: string[];
  entryDate: string;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
  comments?: CoupleComment[];
  reactions?: CoupleReaction[];
  userNickname?: string;
  userAvatarUrl?: string;
}

export interface CoupleMemory {
  id: string;
  coupleId: string;
  title: string;
  description: string | null;
  imageUrls: string[];
  memoryDate: string;
  tags: string[];
  createdAt: string;
  location?: string | null;
  mood?: string | null;
  memoryTime?: string | null;
  lastEditedBy?: string | null;
  lastEditedNickname?: string | null;
}

export interface CoupleGoal {
  id: string;
  coupleId: string;
  title: string;
  description: string | null;
  category: string;
  status: 'active' | 'completed' | 'paused' | 'abandoned';
  progress: number;
  targetDate: string | null;
  completedAt: string | null;
  emoji: string;
  createdAt: string;
  updatedAt: string;
}

export interface CoupleLetter {
  id: string;
  coupleId: string;
  senderId: string;
  subject: string;
  deliverAt: string;
  isUnlocked: boolean;
  createdAt: string;
  body?: string;
  imageUrls?: string[];
  senderNickname?: string;
  isRead?: boolean;
  isFavorite?: boolean;
  isDraft?: boolean;
  isArchived?: boolean;
  reactions?: { userId: string; emoji: string }[];
  parentLetterId?: string | null;
  deliveredAt?: string | null;
  readAt?: string | null;
  updatedAt?: string | null;
}

export interface CoupleDailyQuestion {
  id: string;
  content: string;
  activeDate: string;
}

export interface CoupleAnswer {
  id: string;
  questionId: string;
  coupleId: string;
  userId: string;
  response: string;
  createdAt: string;
  userNickname?: string;
}

export interface RelationshipEvent {
  id: string;
  coupleId: string;
  title: string;
  description: string | null;
  eventDate: string;
  eventType: 'anniversary' | 'birthday' | 'date_night' | 'trip' | 'other';
  createdAt: string;
  updatedAt: string;
}
