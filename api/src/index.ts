import { Elysia } from "elysia";
import { registerFileRoutes } from "../handler/index"
import { join } from "path"

const app = new Elysia();

registerFileRoutes(app, join(__dirname, ""))

app.get("/", () => {
  return "Hello Running on SecuroPass!";
});

app.listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);