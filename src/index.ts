import express from "express";
import * as WebSocket from "ws";
import * as cors from "cors";
import {
  UserModel,
  PostModel,
  UserWebSocket,
  ReceiveTalkModel,
} from "./models";
import { createUser, passCheck } from "./utils";

const app = express();
app.use(cors.default());
app.use(express.json());

const port = 8080;
const webSocketServer = new WebSocket.Server({ port });
const users: UserModel[] = [];
const posts: PostModel[] = [];
let userWebSockets: UserWebSocket[] = [];

webSocketServer.on("connection", (socket: WebSocket) => {
  let localname = "";
  console.log("client connected");

  socket.on("message", (data: string) => {
    const response = JSON.parse(data);

    if (response.type === "registration") {
      const credentials = response.data;
      const user = users.find((e) => e.nickname === credentials.nickname);

      const data = {
        err: false,
        message: "Пользователь создан",
        data: {
          nickname: "",
        },
      };

      if (user) {
        data.err = true;
        data.message = "Пользователь уже существует";
      } else {
        createUser(credentials.nickname, credentials.pass).then((us) => {
          users.push(us);
        });
        data.data.nickname = credentials.nickname;
      }

      socket.send(
        JSON.stringify({
          type: "registration",
          data,
        })
      );
    }

    if (response.type === "auth") {
      const credentials = response.data;
      const user = users.find((e) => e.nickname === credentials.nickname);

      const data = {
        err: false,
        message: "Успешный вход",
        data: {
          nickname: "",
        },
      };

      if (!user) {
        data.err = true;
        data.message = "Неправильный логин / пароль";
        socket.send(JSON.stringify({ type: "auth", data }));
      }

      if (user) {
        passCheck(credentials.pass, user.pass).then((e) => {
          if (!e) {
            data.err = true;
            data.message = "Неправильный логин / пароль";
            socket.send(JSON.stringify({ type: "auth", data }));
          } else {
            data.data.nickname = user.nickname;
            socket.send(JSON.stringify({ type: "auth", data }));
          }
        });
      }
    }

    if (response.type === "login") {
      const user = response.data;
      localname = user.nickname;
      userWebSockets.push({ name: user.nickname, socket });

      socket.send(
        JSON.stringify({
          type: "post",
          data: posts,
        })
      );

      webSocketServer.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          const message = {
            type: "online",
            data: userWebSockets.map((e) => e.name),
          };
          client.send(JSON.stringify(message));

          if (client === socket) {
            const msg = {
              type: "talks",
              data: users
                .filter((e) => e.nickname === localname)
                .map((e) => e.talks)[0],
            };
            client.send(JSON.stringify(msg));
          }
        }
      });
    }

    if (response.type === "talks") {
      const receivedTalk: ReceiveTalkModel = response.data;
      const { from, to, message } = receivedTalk;

      users.forEach((e) => {
        if (e.nickname === from) {
          if (e.talks.findIndex((e) => e.interlocutor === to) === -1) {
            e.talks.push({ interlocutor: to, messages: [] });
          } else {
            e.talks.forEach((el) => {
              if (el.interlocutor === to) {
                if (message) {
                  el.messages.push({ sender: from, text: message });
                }
              }
            });
          }
        } else if (e.nickname === to) {
          if (e.talks.findIndex((e) => e.interlocutor === from) === -1) {
            e.talks.push({ interlocutor: from, messages: [] });
          } else {
            e.talks.forEach((el) => {
              if (el.interlocutor === from) {
                if (message) {
                  el.messages.push({ sender: from, text: message });
                }
              }
            });
          }
        }
      });

      const toUser = userWebSockets.filter((e) => e.name === to);
      const fromUser = userWebSockets.filter((e) => e.name === from);

      webSocketServer.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          if (toUser[0] && toUser[0].socket === client) {
            const toUserTalks = users.filter(
              (e) => e.nickname === toUser[0].name
            )[0].talks;
            client.send(JSON.stringify({ type: "talks", data: toUserTalks }));
          } else if (fromUser[0].socket === client) {
            const fromUserTalks = users.filter(
              (e) => e.nickname === fromUser[0].name
            )[0].talks;
            client.send(JSON.stringify({ type: "talks", data: fromUserTalks }));
          }
        }
      });
    }

    if (response.type === "post") {
      const post: PostModel = response.data;
      posts.push(post);

      webSocketServer.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          const message = {
            type: "post",
            data: posts,
          };
          client.send(JSON.stringify(message));
        }
      });
    }

    socket.on("error", () => {
      userWebSockets = userWebSockets.filter((e) => e.name !== localname);
      localname = "";
      webSocketServer.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          const message = {
            type: "online",
            data: userWebSockets.map((e) => e.name),
          };
          client.send(JSON.stringify(message));
        }
      });

      socket.close();
    });

    socket.on("close", () => {
      userWebSockets = userWebSockets.filter((e) => e.name !== localname);
      localname = "";
      webSocketServer.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          const message = {
            type: "online",
            data: userWebSockets.map((e) => e.name),
          };
          client.send(JSON.stringify(message));
        }
      });
    });
  });
});
