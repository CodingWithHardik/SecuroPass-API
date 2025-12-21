import { t, Static } from "elysia";
const UserSchema = t.Object({
  name: t.String(),
  id: t.Number()
})
export const post = {
  handler: ({ body }: { body: Static<typeof UserSchema> }) => {
    return { created: true, user: body };
  },
  schema: {
    body: UserSchema
  }
};