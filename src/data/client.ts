import { ensureConfig } from '../config'
import { GitHubClient } from '../github'

export function createGitHubClient(): GitHubClient {
  const cfg = ensureConfig()
  return new GitHubClient(cfg.repo, cfg.token, cfg.branch)
}
