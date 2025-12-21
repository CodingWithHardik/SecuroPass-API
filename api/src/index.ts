import { Elysia } from "elysia";
import { registerFileRoutes } from "../handler/index"
import { join } from "path"
import "dotenv/config";

const app = new Elysia();

registerFileRoutes(app, join(__dirname, ""))

app.get("/", ({ redirect }) => {
  const url: string = process.env.MAIN_WEBSITE_URL || "";
  if (!url?.length) return "OK"
  return redirect(url);
});

app.listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);