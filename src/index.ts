import express from "express";
import * as http from "http";
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

const server = http.createServer(app);
const webSocketServer = new WebSocket.Server({ server });
const users: UserModel[] = [];
const posts: PostModel[] = [];
let userWebSockets: UserWebSocket[] = [];

app.listen(process.env.PORT || 8080, () => {
  console.log("Server started");
});

server.listen(process.env.PORT || 8081, () => {
  console.log("Server started");
});

webSocketServer.on("connection", (socket: WebSocket) => {
  let localname = "";
  console.log("client connected");
  socket.send(
    JSON.stringify({
      type: "post",
      data: posts,
    })
  );

  socket.on("message", (data: string) => {
    const response = JSON.parse(data);

    if (response.type === "login") {
      const user = response.data;
      localname = user.nickname;
      userWebSockets.push({ name: user.nickname, socket });

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
                el.messages.push({ sender: from, text: message || "" });
              }
            });
          }
        } else if (e.nickname === to) {
          if (e.talks.findIndex((e) => e.interlocutor === from) === -1) {
            e.talks.push({ interlocutor: from, messages: [] });
          } else {
            e.talks.forEach((el) => {
              if (el.interlocutor === from) {
                el.messages.push({ sender: from, text: message || "" });
              }
            });
          }
        }
      });

      const toUser = userWebSockets.filter((e) => e.name === to);
      const fromUser = userWebSockets.filter((e) => e.name === from);

      webSocketServer.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          if (toUser[0].socket === client) {
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

app.post("/login", (req, res) => {
  const user = users.find((e) => e.nickname === req.body.nickname);

  if (!user) {
    const data = {
      err: true,
      message: "Неправильный логин / пароль",
    };

    res.send(JSON.stringify(data));
  }

  if (user) {
    passCheck(req.body.pass, user.pass).then((e) => {
      if (!e) {
        const data = {
          err: true,
          message: "Неправильный логин / пароль",
        };

        res.send(JSON.stringify(data));
      } else {
        const data = {
          err: false,
          message: "Успешный вход",
          data: {
            nickname: user.nickname,
          },
        };

        res.send(JSON.stringify(data));
      }
    });
  }
});

app.post("/register", (req, res) => {
  const user = users.find((e) => e.nickname === req.body.nickname);

  if (user) {
    const data = {
      err: true,
      message: "Пользователь уже существует",
    };

    res.send(JSON.stringify(data));
  }

  if (!user) {
    createUser(req.body.nickname, req.body.pass).then((us) => {
      users.push(us);
    });

    const data = {
      err: false,
      message: "Пользователь создан",
      data: {
        nickname: req.body.nickname,
      },
    };

    res.send(JSON.stringify(data));
  }
});
