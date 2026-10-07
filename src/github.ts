import { Buffer } from 'node:buffer'

export interface GitHubFile {
  name: string
  path: string
  sha: string
  size: number
  content: string
  encoding: string
}

export interface GitHubDirEntry {
  name: string
  path: string
  sha: string
  type: 'file' | 'dir'
  size: number
}

export class GitHubApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public body?: string
  ) {
    super(`GitHub API error: ${status} ${statusText}${body ? ` - ${body}` : ''}`)
    this.name = 'GitHubApiError'
  }
}

const USER_AGENT = 'initx-plugin-cp'

function encodePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/')
}

export class GitHubClient {
  constructor(
    private repo: string,
    private token: string,
    private branch: string = 'main'
  ) {
    this.validateRepo(repo)
  }

  private validateRepo(repo: string): void {
    if (!repo.includes('/')) {
      throw new Error(`Invalid repo format: "${repo}". Expected "owner/repo".`)
    }
  }

  private apiUrl(path: string): string {
    const [owner, repoName] = this.repo.split('/', 2)
    return `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}/contents/${encodePath(path)}?ref=${encodeURIComponent(this.branch)}`
  }

  private headers(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': USER_AGENT
    }
  }

  async getFile(path: string): Promise<GitHubFile | null> {
    const res = await fetch(this.apiUrl(path), { headers: this.headers() })
    if (res.status === 404)
      return null
    if (!res.ok) {
      throw new GitHubApiError(res.status, res.statusText, await res.text())
    }
    const data = await res.json() as GitHubFile
    if (data.type !== 'file') {
      throw new GitHubApiError(res.status, res.statusText, `Path "${path}" is not a file.`)
    }
    return data
  }

  async listDir(path: string): Promise<GitHubDirEntry[]> {
    const res = await fetch(this.apiUrl(path), { headers: this.headers() })
    if (res.status === 404)
      return []
    if (!res.ok) {
      throw new GitHubApiError(res.status, res.statusText, await res.text())
    }
    const data = await res.json()
    if (!Array.isArray(data)) {
      throw new GitHubApiError(res.status, res.statusText, `Path "${path}" is not a directory.`)
    }
    return data as GitHubDirEntry[]
  }

  async putFile(
    path: string,
    content: string,
    message?: string,
    sha?: string
  ): Promise<void> {
    const body = {
      message: message ?? `cp: update ${path}`,
      content: Buffer.from(content, 'utf8').toString('base64'),
      branch: this.branch,
      ...(sha ? { sha } : {})
    }
    const res = await fetch(this.apiUrl(path), {
      method: 'PUT',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    if (!res.ok) {
      throw new GitHubApiError(res.status, res.statusText, await res.text())
    }
  }

  async deleteFile(path: string, sha: string, message?: string): Promise<void> {
    const body = {
      message: message ?? `cp: delete ${path}`,
      sha,
      branch: this.branch
    }
    const res = await fetch(this.apiUrl(path), {
      method: 'DELETE',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    if (!res.ok) {
      throw new GitHubApiError(res.status, res.statusText, await res.text())
    }
  }

  decodeContent(file: GitHubFile): string {
    const cleaned = file.content.replace(/\n/g, '')
    return Buffer.from(cleaned, file.encoding || 'base64').toString('utf8')
  }
}
