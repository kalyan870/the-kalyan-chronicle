import type { DigestState } from '../components/DailyDigestSection';
import {
  FALLBACK_COMMITS,
  FALLBACK_SUBSTACK_POSTS,
  FEATURED_PROJECTS,
  KALYAN_PROFILE,
} from './chronicleData';

export const STATIC_DIGEST: DigestState = {
  fetchedAt: 'curated archive',
  githubSource: 'fallback',
  substackSource: 'fallback',
  profile: {
    login: 'kalyan870',
    name: KALYAN_PROFILE.name,
    bio: KALYAN_PROFILE.headline,
    publicRepos: 56,
    followers: 0,
    avatarUrl: 'https://github.com/kalyan870.png',
    htmlUrl: 'https://github.com/kalyan870',
  },
  repos: FEATURED_PROJECTS.slice(0, 4).map((project) => ({
    name: new URL(project.repoUrl).pathname.split('/').filter(Boolean).at(-1) || project.id,
    description: project.summary,
    language: project.stack[0] || 'Multiple',
    stars: 0,
    updatedAt: 'Curated archive',
    url: project.repoUrl,
  })),
  latestProjects: FEATURED_PROJECTS,
  commits: FALLBACK_COMMITS,
  substackPosts: FALLBACK_SUBSTACK_POSTS,
};
