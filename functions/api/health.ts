interface Env {
  SCHEDULE_SECRET?: string;
  PUZZLE_EPOCH?: string;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const hasSecret = Boolean(context.env.SCHEDULE_SECRET);
  return new Response(
    JSON.stringify({
      status: "ok",
      edgeRuntime: "cloudflare-pages-functions",
      secretBound: hasSecret,
      epoch: context.env.PUZZLE_EPOCH ?? "unset",
    }),
    {
      headers: { "Content-Type": "application/json" },
    }
  );
};
