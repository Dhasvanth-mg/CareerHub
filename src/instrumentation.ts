import type { Instrumentation } from "next";

/**
 * Logs unhandled server errors as one structured line, so they are searchable in the host's logs.
 * Deliberately records only the error name, the digest, the route and the method. Never request
 * bodies, headers, cookies or the error message (which can echo resume or job text).
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const err = error as { name?: string; digest?: string };
  console.error(
    JSON.stringify({
      level: "error",
      msg: "unhandled request error",
      name: err.name ?? "Error",
      digest: err.digest,
      path: request.path.split("?")[0],
      method: request.method,
      routeType: context.routeType,
      routePath: context.routePath,
    }),
  );
};
