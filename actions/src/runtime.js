function splitArgs(args) {
  return args ? args.split(/\s+/).filter(Boolean) : [];
}

function resolveProviderUrl({ inputProviderUrl = "", env = process.env } = {}) {
  return inputProviderUrl || env.GIT_PROVIDER_URL || env.GITEA_SERVER_URL || "";
}

function buildProductionArgs(command, args = "") {
  return ["-y", "@spaceflow/cli", command, ...splitArgs(args), "--ci"];
}

module.exports = {
  buildProductionArgs,
  resolveProviderUrl,
  splitArgs,
};
