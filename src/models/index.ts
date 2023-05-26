import { WebSocket } from "ws";

export type UserModel = {
  nickname: string;
  pass: string;
  talks: TalkModel[];
};

export type TalkModel = {
  interlocutor: string
  messages: MessageModel[]
}

export type MessageModel = {
  text: string
  sender: string
}

export type PostModel = {
  nickname: string;
  text: string;
  comments: {
    nickname: string;
    comment: string;
  }[];
};

export type ReceiveTalkModel = {
  from: string
  to: string
  message?: string
}

export interface UserWebSocket {
  name: string;
  socket: WebSocket;
}
