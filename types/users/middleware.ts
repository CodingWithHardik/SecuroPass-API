import { Context } from "elysia"

export type UserFields = { userId: String, user: any, device: any }
export type UserContext = Context & UserFields