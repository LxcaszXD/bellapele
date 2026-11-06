import { ZodError } from "zod";
import { assertOrigin, assertCsrf } from "@/lib/clinic/security";
import {
  customerSession,
  customerLogin,
  customerRegister,
  customerForgot,
  customerReset,
  customerLogout,
} from "@/lib/customer/auth";
import { customerService } from "@/lib/customer/service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };
async function handle(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  try {
    const { path } = await context.params;
    const mutation = !["GET", "HEAD"].includes(request.method);
    if (mutation) assertOrigin(request);
    if (path[0] === "auth" && request.method === "POST") {
      if (path[1] === "login" || path[1] === "register") {
        const result = await (
          path[1] === "login" ? customerLogin : customerRegister
        )(request);
        return Response.json(
          { csrfToken: result.csrfToken },
          {
            status: path[1] === "register" ? 201 : 200,
            headers: { ...headers, "Set-Cookie": result.cookie },
          },
        );
      }
      if (path[1] === "forgot")
        return Response.json(await customerForgot(request), { headers });
      if (path[1] === "reset")
        return Response.json(await customerReset(request), { headers });
    }
    const user = await customerSession(request);
    if (mutation) assertCsrf(request, user.csrfToken);
    if (path.join("/") === "auth/session" && request.method === "GET")
      return Response.json(user, { headers });
    if (path.join("/") === "auth/logout" && request.method === "POST")
      return Response.json(
        { ok: true },
        {
          headers: { ...headers, "Set-Cookie": await customerLogout(request) },
        },
      );
    return Response.json(await customerService(request, path, user), {
      headers,
    });
  } catch (e) {
    if (e instanceof ZodError)
      return Response.json(
        { error: e.issues.map((x) => x.message).join("; ") },
        { status: 422, headers },
      );
    if (e instanceof Error && "status" in e)
      return Response.json(
        { error: e.message },
        { status: Number(e.status), headers },
      );
    console.error("customer_request_failed", {
      code: (e as { code?: string }).code,
    });
    return Response.json(
      { error: "Não foi possível concluir. Tente novamente." },
      { status: 500, headers },
    );
  }
}
export {
  handle as GET,
  handle as POST,
  handle as PATCH,
  handle as DELETE,
  handle as PUT,
};
