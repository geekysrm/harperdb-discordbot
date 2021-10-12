"use strict";

const {
  InteractionResponseType,
  InteractionType,
  verifyKey,
} = require("discord-interactions");
const { nanoid } = require("nanoid");

const { SAY_JOKE, TOP, LIST_JOKES } = require("../helpers/commands");

// eslint-disable-next-line no-unused-vars,require-await
module.exports = async (server, { hdbCore, logger }) => {
  // GET, WITH NO preValidation AND USING hdbCore.requestWithoutAuthentication
  // BYPASSES ALL CHECKS: DO NOT USE RAW USER-SUBMITTED VALUES IN SQL STATEMENTS

  server.register(require("fastify-raw-body"), {
    field: "rawBody",
    global: false,
    encoding: "utf8",
    runFirst: true,
  });

  server.addHook("preHandler", async (request, response) => {
    if (request.method === "POST") {
      const signature = request.headers["x-signature-ed25519"];
      const timestamp = request.headers["x-signature-timestamp"];
      const isValidRequest = verifyKey(
        request.rawBody,
        signature,
        timestamp,
        "7171664534475faa2bccec6d8b1337650f78ff608143184ec16f4e31a37cb10e" // replace with <YOUR_PUBLIC_KEY> which we copied earlier
      );
      if (!isValidRequest) {
        server.log.info("Invalid Request");
        return response.status(401).send({ error: "Bad request signature " });
      }
    }
  });
  server.route({
    url: "/",
    method: "GET",
    handler: (request) => {
      return { status: "Server running!" };
    },
  });

  //discord stuff
  server.route({
    url: "/",
    method: "POST",
    config: {
      // add the rawBody to this route. if false, rawBody will be disabled when global is true
      rawBody: true,
    },
    handler: async (request) => {
      const myBody = request.body;

      if (myBody.type === InteractionType.PING) {
        return { type: InteractionResponseType.PONG };
      } else if (myBody.type === InteractionType.APPLICATION_COMMAND) {
        const user = myBody.member.user;
        const username = `${user.username}`;

        const id = user.id;
        switch (myBody.data.name.toLowerCase()) {
          case SAY_JOKE.name.toLowerCase():
            request.body = {
              operation: "sql",
              sql: `SELECT * FROM dev.users WHERE id = ${id}`,
            };
            const res = await hdbCore.requestWithoutAuthentication(request);
            if (res.length === 0) {
              // new user
              request.body = {
                operation: "sql",
                sql: `INSERT INTO dev.users (id, name, score) VALUES ('${id}', '${username}', '1')`,
              };
              await hdbCore.requestWithoutAuthentication(request);
            } else {
              // old user
              request.body = {
                operation: "sql",
                sql: `UPDATE dev.users SET score = ${
                  res[0].score + 1
                }  WHERE id = ${id}`,
              };
              await hdbCore.requestWithoutAuthentication(request);
            }
            const jokeId = nanoid();
            const joke = myBody.data.options[0].value;
            request.body = {
              operation: "sql",
              sql: `INSERT INTO dev.jokes (id, joke, person_id) VALUE ('${jokeId}', '${joke}', '${id}')`,
            };
            await hdbCore.requestWithoutAuthentication(request);
            const newScore = res.length === 0 ? 1 : res[0].score + 1;

            return {
              type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
              data: {
                content: `<@${id}> says:\n*${joke}* \n<@${id}>'s score is now: **${newScore}**`,
                embeds: [
                  {
                    type: "rich",
                    image: {
                      url: "https://res.cloudinary.com/geekysrm/image/upload/v1632951540/rofl.gif",
                    },
                  },
                ],
              },
            };

          case TOP.name.toLowerCase():
            request.body = {
              operation: "sql",
              sql: `SELECT * FROM dev.users ORDER BY score DESC LIMIT 1`,
            };

            const topResponse = await hdbCore.requestWithoutAuthentication(
              request
            );
            const top = topResponse[0];
            return {
              type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
              data: {
                content: `**@${top.name}** is topping the list with score **${top.score}**. \nSee his programming jokes with */listjoke ${top.name}*`,
              },
            };

          case LIST_JOKES.name.toLowerCase():
            const selectedUser = myBody.data.options[0].value.toString();
            request.body = {
              operation: "sql",
              sql: `SELECT joke FROM dev.jokes WHERE person_id = ${selectedUser} LIMIT 5`,
            };

            const jokes = await hdbCore.requestWithoutAuthentication(request);
            let contentString =
              jokes.length === 0
                ? "User has not posted any jokes 😕"
                : "Here are the jokes posted by that user:\n";
            jokes.forEach(({ joke }) => {
              contentString += `- **${joke}**\n`;
            });
            return {
              type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
              data: {
                content: contentString,
              },
            };

          default:
            return {
              type: 4,
              data: {
                content: `Invalid type. Please check the command.`,
              },
            };
        }
      } else {
        return {
          type: 4,
          data: {
            content: `Invalid type. Please check the command.`,
          },
        };
      }
    },
  });
};
