import websocket from "@fastify/websocket"
import type { FastifyInstance } from "fastify"
import type { ExtensionConnection } from "./2_Connection.js"

export function registerExtensionBridge(
  app: FastifyInstance,
  {
    connection,
    token,
    path = "/extension",
  }: {
    connection: ExtensionConnection
    token: string
    path?: string
  },
) {
  app.register(websocket, { options: { maxPayload: 48 * 1024 * 1024 } })
  app.register(async scope => {
    scope.get(
      path,
      {
        websocket: true,
        onRequest: async (request, reply) => {
          const host = new URL(`http://${request.headers.host}`).hostname
          if (
            !["127.0.0.1", "localhost", "[::1]"].includes(host) ||
            request.headers["sec-websocket-protocol"] !== `bewpp-${token}` ||
            !/^chrome-extension:\/\/[a-p]{32}$/.test(request.headers.origin ?? "")
          ) {
            return reply.code(403).send({ error: "Authorized local extension connections only." })
          }
        },
      },
      socket => connection.attach(socket),
    )
  })
}
