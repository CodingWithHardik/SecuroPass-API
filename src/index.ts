import { Elysia } from "elysia";
import { registerFileRoutes } from "../handler/index"
import { join } from "path"
import "dotenv/config";

const app = new Elysia();

await registerFileRoutes(app, join(__dirname, ""))

app.get("/", ({ redirect }: { redirect: (url: string) => void }) => {
  const url: string = process.env.MAIN_WEBSITE_URL || "";
  if (!url?.length) return "OK"
  return redirect(url);
});

app.listen(process.env.PORT || 3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);