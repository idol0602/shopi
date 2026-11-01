export interface ChatMessage {
  id: string;
  senderId: string;
  senderRole: "BUYER" | "SELLER";
  senderName: string;
  text: string;
  imageUrl?: string;
  timestamp: number;
  isRead: boolean;
}

export interface ChatConversation {
  id: string;
  productId: string;
  productTitle: string;
  productPrice: number;
  productImage: string;
  otherUserId: string;
  otherUserName: string;
  otherUserAvatar?: string;
  lastMessage: string;
  lastMessageTime: number;
  unreadCount: number;
  messages: ChatMessage[];
}
